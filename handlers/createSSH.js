const { Client } = require('ssh2');
const fs = require('fs');

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
            if (stdout.trim()) {
                // Jika username ditemukan
                callback(null, true);
            } else {
                // Jika username tidak ditemukan
                callback(null, false);
            }
        });
    });
};

// Fungsi untuk membuat SSH di VPS menggunakan ssh2
const createSSH = (vpsHost, username, password, limitDevice, activePeriod, privateKeyPath, callback) => {
    const conn = new Client();

    let privateKey;
    try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8'); // Baca file private key
    } catch (error) {
        console.error('Error reading private key file:', error.message);
        return callback(new Error('❌ Gagal membaca file private key.'));
    }

    conn.on('ready', () => {
        // Cek apakah username sudah ada di /etc/shadow
        checkUserInShadow(conn, username, (err, exists) => {
            if (err) {
                conn.end();
                return callback(new Error('❌ Gagal memeriksa username di /etc/shadow.'));
            }

            if (exists) {
                conn.end();
                return callback(new Error(`❌ Username \`${username}\` sudah ada. Silakan gunakan username lain.`));
            }

            // Jika username belum ada, lanjutkan pembuatan SSH
            conn.exec(`createssh ${username} ${password} ${limitDevice} ${activePeriod}`, (err, stream) => {
                if (err) {
                    conn.end();
                    return callback(err);
                }

                let stdout = '';
                stream.on('data', (data) => {
                    stdout += data.toString();
                }).on('close', (code, signal) => {
                    conn.end();

                    try {
                        // Parse output JSON
                        const output = JSON.parse(stdout);

                        // Ambil domain dari output JSON
                        const domain = output.domain;

                        // Data SSH yang dihasilkan
                        const sshData = {
                            username: username,
                            password: password,
                            domain: domain, // Domain diambil dari output JSON
                            expired: `${activePeriod} hari`,
                            ip_limit: limitDevice,
                        };

                        // Hasilkan pesan dengan format yang diinginkan
                        const message = `🌟 *AKUN SSH PREMIUM* 🌟\n\n` +
                                        `🔹 *Informasi Akun*\n` +
                                        generateSSHMessage(sshData);

                        callback(null, message);
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
        privateKey: privateKey, // Gunakan privateKey sebagai kunci SSH
    });
};

// Fungsi untuk menghasilkan pesan SSH
const generateSSHMessage = (sshData) => {
    return `
┌─────────────────────
│ *Username* : \`${sshData.username}\`
│ *Password* : \`${sshData.password}\`
└─────────────────────
┌─────────────────────
│ *Domain*   : \`${sshData.domain}\`
│ *Port TLS* : \`443\`
│ *Port HTTP*: \`80\`
│ *OpenSSH*  : \`22\`
│ *UdpSSH*   : \`1-65535\`
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

        if (data.startsWith('create_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            const privateKeyPath = server.privateKey;

            // Minta input dari pengguna
            await bot.sendMessage(chatId, 'Masukkan detail SSH (format: username password limit_device masa_aktif):');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const input = msg.text.split(' ');
                const [username, password, limitDevice, activePeriod] = input;

                if (!username || !password || !limitDevice || !activePeriod) {
                    await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                    return;
                }

                // Panggil fungsi createSSH
                createSSH(server.host, username, password, limitDevice, activePeriod, privateKeyPath, (error, result) => {
                    if (error) {
                        return bot.sendMessage(chatId, error.message);
                    }

                    // Tambahkan tombol "Kembali ke Pemilihan Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Kirim pesan dengan tombol
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};