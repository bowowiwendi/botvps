const { exec } = require('child_process');

// Fungsi untuk memeriksa apakah username ada di /etc/shadow
const checkUsernameInShadow = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow"`;

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

// Fungsi untuk menghapus SSH di VPS
const deleteSSH = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} delssh`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal menghapus user \`${username}\`: ${stderr}`);
        } else {
            callback(`✅ User \`${username}\` berhasil dihapus.`);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('delete_ssh_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Minta input username dari pengguna
                await bot.sendMessage(chatId, 'Masukkan username SSH yang ingin dihapus:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    // Validasi username
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Periksa apakah username ada di /etc/shadow
                    checkUsernameInShadow(server.host, username, async (exists) => {
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                ],
                            ],
                        };

                        if (!exists) {
                            // Jika username tidak ditemukan
                            await bot.sendMessage(
                                chatId, 
                                `❌ User \`${username}\` tidak ada.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                }
                            );
                            return;
                        }

                        // Jika username ditemukan, lanjutkan penghapusan
                        deleteSSH(server.host, username, (result) => {
                            // Kirim pesan hasil penghapusan dengan tombol
                            bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard,
                            });
                        });
                    });
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};