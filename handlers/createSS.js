const { Client } = require('ssh2');
const fs = require('fs');

// Fungsi untuk membaca data admin
const getAdmins = () => {
    try {
        const admins = JSON.parse(fs.readFileSync('./admins.json'));
        // Ensure there's always a main admin
        if (!admins.some(a => a.is_main)) {
            admins[0].is_main = true;
            fs.writeFileSync('./admins.json', JSON.stringify(admins, null, 2));
        }
        return admins;
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

// Fungsi untuk mengirim laporan ke admin utama
const sendReportToMainAdmin = async (bot, reportData) => {
    const admins = getAdmins();
    const mainAdmin = admins.find(a => a.is_main);
    if (!mainAdmin) return;

    const reportMessage = `
📢 *Laporan Pembuatan Akun Baru* 📢

👤 *Admin*: ${reportData.adminName} (ID: ${reportData.adminId})
🖥️ *Server*: ${reportData.serverName}
📛 *Username*: ${reportData.username}
🔒 *Tipe*: Shadowsocks
💰 *Harga*: ${reportData.isMainAdmin ? 'GRATIS (Main Admin)' : 'Rp ' + reportData.price.toLocaleString()}
📅 *Waktu*: ${new Date().toLocaleString()}
    `;

    await bot.sendMessage(mainAdmin.id, reportMessage, { parse_mode: 'Markdown' });
};

// Fungsi untuk memeriksa username
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

// Fungsi untuk membuat Shadowsocks
const createShadowsocks = async (vpsHost, username, quota, ipLimit, activePeriod, domain, privateKeyPath) => {
    const conn = new Client();
    let privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    const command = `createshadowsocks ${username} ${quota} ${ipLimit} ${activePeriod}`;

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
                        const ssData = JSON.parse(data);
                        ssData.domain = domain;
                        resolve(ssData);
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

// Fungsi untuk menghasilkan pesan Shadowsocks
const generateShadowsocksMessage = (ssData) => {
    return `
🌟 *AKUN SHADOW PREMIUM* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${ssData.username}\`
│ *Domain*   : \`${ssData.domain}\`
│ *Port*     : \`${ssData.port}\`
│ *Password* : \`${ssData.password}\`
│ *Method*   : \`${ssData.method}\`
│ *Protocol* : \`${ssData.protocol}\`
│ *OBFS*     : \`${ssData.obfs}\`
└─────────────────────
🔐 *URL SHADOW*
\`\`\`
${ssData.ss_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${ssData.expired}\`
│ Quota: \`${ssData.quota === '0 GB' ? 'Unlimited' : ssData.quota}\`
│  Limit: \`${ssData.ip_limit === '0' ? 'Unlimited' : ssData.ip_limit}\`
└─────────────────────
Save Account Link: [Save Account](https://${ssData.domain}:81/shadowsocks-${ssData.username}.txt)
✨ Selamat menggunakan layanan kami! ✨
    `;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('ss_create_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            const domain = server.domain;
            const privateKeyPath = server.privateKey;
            const serverPrice = server.harga || 0;

            // Dapatkan data admin
            const admins = getAdmins();
            const admin = admins.find(a => a.id === from.id);

            if (!admin) {
                await bot.sendMessage(chatId, '❌ Anda tidak terdaftar sebagai admin!');
                return;
            }

            const isMainAdmin = admin.is_main === true;
            
            // Cek saldo admin hanya jika bukan main admin
            if (!isMainAdmin && (admin.balance || 0) < serverPrice) {
                await bot.sendMessage(chatId, `❌ Saldo Anda tidak mencukupi! Harga server ini Rp ${serverPrice.toLocaleString()}\nSaldo Anda: Rp ${(admin.balance || 0).toLocaleString()}`);
                return;
            }

            if (isMainAdmin) {
                await bot.sendMessage(chatId, 'Masukkan detail Shadow (format: username quota ip_limit masa_aktif):');
            } else {
                await bot.sendMessage(chatId, 'Masukkan username untuk Shadow (quota: 1000GB, IP Limit: 2, Masa Aktif: 30 hari)\nFormat: username');
            }

            const messageHandler = async (msg) => {
                bot.removeListener('message', messageHandler);

                let username, quota, ipLimit, activePeriod;
                
                if (isMainAdmin) {
                    const input = msg.text.split(' ');
                    [username, quota, ipLimit, activePeriod] = input;
                    
                    if (!username || !quota || !ipLimit || !activePeriod) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                        return;
                    }
                } else {
                    username = msg.text.trim();
                    quota = '1000';
                    ipLimit = '2';
                    activePeriod = '30';
                    
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong. Silakan coba lagi.');
                        return;
                    }
                }

                try {
                    // Cek username
                    const usernameExists = await checkUsernameExists(server.host, username, privateKeyPath);
                    if (usernameExists) {
                        await bot.sendMessage(chatId, `❌ Username "${username}" sudah ada.`);
                        return;
                    }

                    // Buat akun Shadowsocks
                    const ssData = await createShadowsocks(server.host, username, quota, ipLimit, activePeriod, domain, privateKeyPath);

                    // Update saldo admin hanya jika bukan main admin
                    if (!isMainAdmin) {
                        updateAdminBalance(admin.id, -serverPrice);
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
                    const message = generateShadowsocksMessage(ssData);
                    const keyboard = {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                        ],
                    };

                    await bot.sendMessage(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });

                } catch (error) {
                    await bot.sendMessage(chatId, `❌ Error: ${error}`);
                }
            };

            bot.once('message', messageHandler);
        }
    });
};