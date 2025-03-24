const { exec } = require('child_process');

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

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

// Fungsi untuk mengunci akun Shadowsocks di VPS
const lockSS = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} lock-ss`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dikunci.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('ss_lock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            //     return;
            // }

            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username SS yang ingin dikunci:');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const username = msg.text;

                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                // Periksa apakah username ada di /etc/xray/config.json
                checkUsernameExists(server.host, username, (exists) => {
                    if (!exists) {
                        // Jika username tidak ditemukan
                        bot.sendMessage(chatId, `❌ User \`${username}\` tidak ada.`);
                        return;
                    }

                    // Jika username ditemukan, lanjutkan proses mengunci
                    lockSS(server.host, username, (result) => {
                        // Tambahkan tombol "Kembali ke Menu Server"
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                ],
                            ],
                        };

                        // Kirim pesan hasil penguncian dengan tombol
                        bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        });
                    });
                });
            });
        }
    });
};