const { exec } = require('child_process');

// Fungsi untuk mendapatkan daftar akun yang terkunci dari /etc/xray/.lock.db
const getLockedAccounts = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/xray/.lock.db"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // Jika file tidak ditemukan atau error
            callback([]);
        } else {
            // Ambil daftar username yang terkunci
            const lockedAccounts = stdout.split('\n').filter(Boolean);
            callback(lockedAccounts);
        }
    });
};

// Fungsi untuk memeriksa apakah username ada di /etc/xray/.lock.db
const checkUserLocked = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/.lock.db"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // Jika username tidak ditemukan
            callback(false);
        } else {
            // Jika username ditemukan
            callback(true);
        }
    });
};

// Fungsi untuk membuka kunci akun VME di VPS
const unlockVME = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} unlock-vm`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dibuka.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('vme_unlock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            //     return;
            // }

            // Tampilkan daftar akun yang terkunci
            getLockedAccounts(server.host, (lockedAccounts) => {
                if (lockedAccounts.length === 0) {
                    bot.sendMessage(chatId, 'Tidak ada akun yang terkunci.');
                    return;
                }

                // Format daftar akun yang terkunci
                const lockedAccountsMessage = `
🔒 *Daftar Akun yang Terkunci:*
\`\`\`
${lockedAccounts.join('\n')}
\`\`\`
                `;

                // Kirim daftar akun yang terkunci
                bot.sendMessage(chatId, lockedAccountsMessage, {
                    parse_mode: 'Markdown',
                });

                // Minta input username dari pengguna
                bot.sendMessage(chatId, 'Masukkan username VME yang ingin dibuka:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;

                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Periksa apakah username ada di /etc/xray/.lock.db
                    checkUserLocked(server.host, username, (isLocked) => {
                        if (!isLocked) {
                            // Jika username tidak ditemukan di file .lock.db
                            bot.sendMessage(chatId, `❌ User \`${username}\` tidak terkunci.`);
                            return;
                        }

                        // Jika username ditemukan, lanjutkan proses membuka kunci
                        unlockVME(server.host, username, (result) => {
                            // Tambahkan tombol "Kembali ke Menu Server"
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                    ],
                                ],
                            };

                            // Kirim pesan hasil membuka kunci dengan tombol
                            bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard,
                            });
                        });
                    });
                });
            });
        }
    });
};