const { exec } = require('child_process');

// Fungsi untuk melihat member SSH
const viewSSHMembers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} bot-member-ssh`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                                "```\n" +
                                stdout +
                                "\n```";

        callback(null, formattedOutput);
    });
};

// Fungsi untuk melihat detail SSH
const viewSSHDetails = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "cat /var/www/html/ssh-${username}.txt"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: Gagal mengambil detail SSH. Pastikan file /var/www/html/ssh-${username}.txt ada di server.`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `🔍 *DETAIL SSH* 🔍\n\n` +
                               "```\n" +
                               stdout +
                               "\n```";

        callback(null, formattedOutput);
    });
};

// Fungsi untuk mengecek user pada file /etc/shadow
const checkUserInShadow = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // User tidak ditemukan
            callback(null, false); // false berarti user tidak ada
            return;
        }

        // User ditemukan
        callback(null, true); // true berarti user ada
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('list_member_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Panggil fungsi viewSSHMembers
            viewSSHMembers(server.host, (error, result) => {
                if (error) {
                    bot.sendMessage(chatId, error);
                    return;
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
        } else if (data.startsWith('detail_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // Validasi server
            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username SSH:');

            // Tangkap input username
            bot.once('message', async (msg) => {
                const username = msg.text;

                // Validasi username
                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                // Panggil fungsi checkUserInShadow
                checkUserInShadow(server.host, username, (error, userExists) => {
                    if (error) {
                        bot.sendMessage(chatId, 'Terjadi kesalahan saat mengecek user.');
                        return;
                    }

                    if (!userExists) {
                        // Jika user tidak ada
                        bot.sendMessage(chatId, `User *${username}* tidak ditemukan.`, {
                            parse_mode: 'Markdown',
                        });
                        return;
                    }

                    // Jika user ada, lanjutkan proses pengambilan detail SSH
                    viewSSHDetails(server.host, username, (error, result) => {
                        if (error) {
                            bot.sendMessage(chatId, error);
                            return;
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
            });
        }
    });
};