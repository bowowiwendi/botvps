const { exec } = require('child_process');

// Function to view SSH details
const viewSSHDetails = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "cat /var/www/html/ssh-${username}.txt"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: Gagal mengambil detail SSH. Pastikan file /var/www/html/ssh-${username}.txt ada di server.`);
            return;
        }

        // Format output
        const formattedOutput = `🔍 *DETAIL SSH* 🔍\n\n` +
                              "```\n" +
                              stdout +
                              "\n```";

        callback(null, formattedOutput);
    });
};

// Function to check user in /etc/shadow
const checkUserInShadow = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(null, false); // User not found
            return;
        }
        callback(null, true); // User found
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('detail_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            await bot.sendMessage(chatId, 'Masukkan username SSH yang ingin dilihat detailnya:');

            // Use a unique identifier for the message listener
            const listenerId = `detail_ssh_${chatId}_${Date.now()}`;
            
            const messageHandler = async (msg) => {
                // Check if message is from the same chat
                if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) {
                    return;
                }

                // Remove listener after use
                bot.removeListener('message', messageHandler);

                const username = msg.text.trim();

                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                checkUserInShadow(server.host, username, async (error, userExists) => {
                    if (error) {
                        await bot.sendMessage(chatId, 'Terjadi kesalahan saat mengecek user.');
                        return;
                    }

                    if (!userExists) {
                        await bot.sendMessage(chatId, `User *${username}* tidak ditemukan.`, {
                            parse_mode: 'Markdown',
                        });
                        return;
                    }

                    viewSSHDetails(server.host, username, async (error, result) => {
                        if (error) {
                            await bot.sendMessage(chatId, error);
                            return;
                        }

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { 
                                        text: '🔙 Kembali ke Daftar', 
                                        callback_data: `list_member_${serverIndex}` 
                                    },
                                ],
                            ],
                        };

                        await bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        });
                    });
                });
            };

            bot.on('message', messageHandler);
        }
    });
};