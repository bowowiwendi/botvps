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
    const mainAdmin = admins.find(a => a.is_main);
    if (!mainAdmin) return;

    const reportMessage = `
📢 *Laporan Pembuatan Akun Baru* 📢

👤 *Admin*: ${reportData.adminName} (ID: ${reportData.adminId})
🖥️ *Server*: ${reportData.serverName}
📛 *Username*: ${reportData.username}
🔒 *Tipe*: SSH
💰 *Harga*: ${reportData.isMainAdmin ? 'GRATIS (Main Admin)' : 'Rp ' + reportData.price.toLocaleString()}
📅 *Waktu*: ${new Date().toLocaleString()}
    `;

    await bot.sendMessage(mainAdmin.id, reportMessage, { parse_mode: 'Markdown' });
};

// Fungsi untuk memeriksa apakah username ada di /etc/shadow
const checkUserInShadow = (conn, username, callback) => {
    conn.exec(`grep '^${username}:' /etc/shadow`, (err, stream) => {
        if (err) {
            return callback(err);
        }

        let stdout = '';
        stream.on('data', (data) => {
            stdout += data.toString();
        }).on('close', (code, signal) => {
            callback(null, !!stdout.trim());
        });
    });
};

// Fungsi untuk membuat SSH di VPS
const createSSH = (vpsHost, username, password, limitDevice, activePeriod, privateKeyPath, callback) => {
    const conn = new Client();

    let privateKey;
    try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    } catch (error) {
        console.error('Error reading private key file:', error.message);
        return callback(new Error('❌ Gagal membaca file private key.'));
    }

    conn.on('ready', () => {
        checkUserInShadow(conn, username, (err, exists) => {
            if (err) {
                conn.end();
                return callback(new Error('❌ Gagal memeriksa username di /etc/shadow.'));
            }

            if (exists) {
                conn.end();
                return callback(new Error(`❌ Username \`${username}\` sudah ada.`));
            }

            conn.exec(`createssh ${username} ${password} ${limitDevice} ${activePeriod}`, (err, stream) => {
                if (err) {
                    conn.end();
                    return callback(err);
                }

                let stdout = '';
                stream.on('data', (data) => {
                    stdout += data.toString();
                }).on('close', () => {
                    conn.end();

                    try {
                        const output = JSON.parse(stdout);
                        callback(null, {
                            username: username,
                            password: password,
                            domain: output.domain,
                            expired: output.expired,
                            ip_limit: limitDevice
                        });
                    } catch (parseError) {
                        callback(parseError);
                    }
                });
            });
        });
    }).connect({
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    });
};

// Fungsi untuk menghasilkan pesan SSH
const generateSSHMessage = (sshData) => {
    return `
🌟 *AKUN SSH PREMIUM* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${sshData.username}\`
│ *Password* : \`${sshData.password}\`
└─────────────────────
┌─────────────────────
│ *Domain*   : \`${sshData.domain}\`
│ *Port TLS* : \`${sshData.domain}:443@${sshData.username}:${sshData.password} \`
│ *Port HTTP*: \`${sshData.domain}:80@${sshData.username}:${sshData.password} \`
│ *OpenSSH*  : \`${sshData.domain}:22@${sshData.username}:${sshData.password} \`
│ *UdpSSH*   : \`${sshData.domain}:1-65535@${sshData.username}:${sshData.password} \`
│ *DNS*      : \`443, 53, 22\`
│ *Dropbear* : \`443, 109\`
│ *SSH WS*   : \`80\`
│ *SSH SSL WS*: \`443\`
│ *SSL/TLS*  : \`443\`
│ *OVPN SSL* : \`443\`
│ *OVPN TCP* : \`1194\`
│ *OVPN UDP* : \`2200\`
│ *BadVPN UDP*: \`7100, 7300, 7300\`
└─────────────────────
WSS Payload      : 
\`\`\`
GET wss://BUG.COM/ HTTP/1.1
Host: ${sshData.domain}
Upgrade: websocket
\`\`\`
OpenVPN Link     : [Download OpenVPN](https://${sshData.domain}:81/allovpn.zip)
Save Account Link: [Save Account](https://${sshData.domain}:81/ssh-${sshData.username}.txt)
───────────────────────
┌─────────────────────
│ Expires: \`${sshData.expired}\`
│ IP Limit: \`${sshData.ip_limit}\`
└─────────────────────
    `;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('create_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
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
                await bot.sendMessage(chatId, 'Masukkan detail SSH (format: username password limit_device masa_aktif):');
            } else {
                await bot.sendMessage(chatId, 'Cukup Masukkan username dan password untuk SSH \nFormat: username password');
            }

            bot.once('message', async (msg) => {
                let username, password, limitDevice, activePeriod;
                
                if (isMainAdmin) {
                    const input = msg.text.split(' ');
                    [username, password, limitDevice, activePeriod] = input;
                    
                    if (!username || !password || !limitDevice || !activePeriod) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                        return;
                    }
                } else {
                    const input = msg.text.split(' ');
                    [username, password] = input;
                    limitDevice = '2';
                    activePeriod = '30';
                    
                    if (!username || !password) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                        return;
                    }
                }

                createSSH(server.host, username, password, limitDevice, activePeriod, privateKeyPath, async (error, sshData) => {
                    if (error) {
                        return await bot.sendMessage(chatId, error.message);
                    }

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
                    const message = generateSSHMessage(sshData);
                    const keyboard = {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                        ],
                    };

                    await bot.sendMessage(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};