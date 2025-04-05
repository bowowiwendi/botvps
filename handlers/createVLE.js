const { Client } = require('ssh2');
const fs = require('fs');

// Fungsi untuk membaca data admin
const getAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync('./admins.json'));
    } catch (err) {
        return [];
    }
};

// Fungsi untuk membaca data server
const getServers = () => {
    try {
        return JSON.parse(fs.readFileSync('./servers.json'));
    } catch (err) {
        return [];
    }
};

// Fungsi untuk update saldo admin
const updateAdminBalance = (adminId, amount) => {
    const admins = getAdmins();
    const adminIndex = admins.findIndex(a => a.id === adminId);
    
    if (adminIndex !== -1) {
        admins[adminIndex].balance = (admins[adminIndex].balance || 0) + amount;
        fs.writeFileSync('./admins.json', JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
};

const addToMainAdminBalance = (amount) => {
    const admins = getAdmins();
    const mainAdmin = admins.find(a => a.is_main);
    
    if (mainAdmin) {
        mainAdmin.balance = (mainAdmin.balance || 0) + amount;
        fs.writeFileSync('./admins.json', JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
};

// Fungsi untuk mengirim laporan ke admin utama
const sendReportToMainAdmin = async (bot, reportData) => {
    const admins = getAdmins();
    if (admins.length === 0) return;

    const mainAdmin = admins.find(a => a.is_main);
    if (!mainAdmin) return;

    const reportMessage = `
📢 *Laporan Pembuatan Akun Baru* 📢

👤 *Admin*: ${reportData.adminName} (ID: ${reportData.adminId})
🖥️ *Server*: ${reportData.serverName}
📛 *Username*: ${reportData.username}
🔒 *Tipe*: VLESS
💰 *Harga*: ${reportData.isMainAdmin ? 'GRATIS (Main Admin)' : 'Rp ' + reportData.price.toLocaleString()}
📅 *Waktu*: ${new Date().toLocaleString()}
    `;

    await bot.sendMessage(mainAdmin.id, reportMessage, { parse_mode: 'Markdown' });
};

// Fungsi untuk membaca file /etc/xray/config.json dan memeriksa username
const checkUsernameExists = async (vpsHost, username, privateKeyPath) => {
    const conn = new Client();
    let privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    const command = `cat /etc/xray/config.json | grep '"${username}"'`;

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject('❌ Gagal menjalankan perintah di server.');
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });

                stream.on('close', () => {
                    conn.end();
                    resolve(data.includes(username));
                });
            });
        });

        conn.on('error', (err) => {
            reject('❌ Gagal terhubung ke server.');
        });

        conn.connect(sshConfig);
    });
};

// Fungsi untuk membuat VLESS
const createVless = async (vpsHost, username, quota, ipLimit, activePeriod, domain, privateKeyPath) => {
    const conn = new Client();
    let privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    const command = `createvless ${username} ${quota} ${ipLimit} ${activePeriod}`;

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject('❌ Gagal menjalankan perintah di server.');
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });

                stream.on('close', () => {
                    conn.end();
                    try {
                        const vlessData = JSON.parse(data);
                        vlessData.domain = domain;
                        resolve(vlessData);
                    } catch (error) {
                        reject('❌ Gagal memproses output dari server.');
                    }
                });
            });
        });

        conn.on('error', (err) => {
            reject('❌ Gagal terhubung ke server.');
        });

        conn.connect(sshConfig);
    });
};

// Fungsi untuk menghasilkan pesan VLESS
const generateVlessMessage = (vlessData) => {
    return `
🌟 *AKUN VLE PREMIUM* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${vlessData.username}\`
│ *Domain*   : \`${vlessData.domain}\`
│ *Port TLS* : \`443\`
│ *Port HTTP*: \`80\`
│ *Security* : \`None\`
│ *Network*  : \`Websocket (WS)\`
│ *Path*     : \`/vless\`
│ *Path GRPC*: \`vless-grpc\`
└─────────────────────
🔐 *URL VLE TLS*
\`\`\`
${vlessData.vless_tls_link}
\`\`\`
🔓 *URL VLE HTTP*
\`\`\`
${vlessData.vless_nontls_link}
\`\`\`
🔒 *URL VLE GRPC*
\`\`\`
${vlessData.vless_grpc_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${vlessData.expired}\`
│ Quota: \`${vlessData.quota === '0 GB' ? 'Unlimited' : vlessData.quota}\`
│  Limit: \`${vlessData.ip_limit === '0' ? 'Unlimited' : vlessData.ip_limit}\`
└─────────────────────
Save Account Link: [Save Account](https://${vlessData.domain}:81/vless-${vlessData.username}.txt)
✨ Selamat menggunakan layanan kami! ✨
    `;
};

// Fungsi untuk membuat keyboard kembali
const createBackKeyboard = (serverIndex) => {
    return {
        inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
        ]
    };
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('vle_create_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            const domain = server.domain;
            const privateKeyPath = server.privateKey;
            const serverPrice = server.harga || 0;

            // Dapatkan data admin
            const admins = getAdmins();
            const admin = admins.find(a => a.id === from.id);

            if (!admin) {
                await bot.sendMessage(chatId, '❌ Anda tidak terdaftar sebagai admin!', {
                    reply_markup: createBackKeyboard(serverIndex)
                });
                return;
            }

            const isMainAdmin = admin.is_main === true;
            
            // Cek saldo admin hanya jika bukan main admin
            if (!isMainAdmin && (admin.balance || 0) < serverPrice) {
                await bot.sendMessage(chatId, 
                    `❌ Saldo Anda tidak mencukupi! Harga server ini Rp ${serverPrice.toLocaleString()}\nSaldo Anda: Rp ${(admin.balance || 0).toLocaleString()}`, 
                    { reply_markup: createBackKeyboard(serverIndex) }
                );
                return;
            }

            if (isMainAdmin) {
                await bot.sendMessage(chatId, 'Masukkan detail VLE (format: username quota ip_limit masa_aktif):');
            } else {
                await bot.sendMessage(chatId, 'Cukup masukkan username \nFormat: username');
            }

            const messageHandler = async (msg) => {
                bot.removeListener('message', messageHandler);

                let username, quota, ipLimit, activePeriod;
                
                if (isMainAdmin) {
                    const input = msg.text.split(' ');
                    [username, quota, ipLimit, activePeriod] = input;
                    
                    if (!username || !quota || !ipLimit || !activePeriod) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.', {
                            reply_markup: createBackKeyboard(serverIndex)
                        });
                        return;
                    }
                } else {
                    username = msg.text.trim();
                    quota = '1000';
                    ipLimit = '2';
                    activePeriod = '30';
                    
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong. Silakan coba lagi.', {
                            reply_markup: createBackKeyboard(serverIndex)
                        });
                        return;
                    }
                }

                try {
                    // Cek username
                    const usernameExists = await checkUsernameExists(server.host, username, privateKeyPath);
                    if (usernameExists) {
                        await bot.sendMessage(chatId, `❌ Username "${username}" sudah ada.`, {
                            reply_markup: createBackKeyboard(serverIndex)
                        });
                        return;
                    }

                    // Buat VLESS
                    const vlessData = await createVless(server.host, username, quota, ipLimit, activePeriod, domain, privateKeyPath);

                    // Update saldo admin hanya jika bukan main admin
                    if (!isMainAdmin) {
                        // Kurangi saldo admin yang membuat
                        updateAdminBalance(admin.id, -serverPrice);
                        // Tambahkan saldo ke admin utama
                        addToMainAdminBalance(serverPrice);
                    }

                    // Kirim laporan ke admin utama
                    await sendReportToMainAdmin(bot, {
                        adminId: admin.id,
                        adminName: `${admin.first_name} ${admin.last_name || ''}`.trim(),
                        serverName: server.name,
                        username: username,
                        price: serverPrice,
                        isMainAdmin: isMainAdmin
                    });

                    // Kirim hasil ke user
                    const message = generateVlessMessage(vlessData);
                    await bot.sendMessage(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: createBackKeyboard(serverIndex)
                    });

                } catch (error) {
                    await bot.sendMessage(chatId, error, {
                        reply_markup: createBackKeyboard(serverIndex)
                    });
                }
            };

            bot.once('message', messageHandler);
        }
    });
};