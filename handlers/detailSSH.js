const { exec } = require('child_process');

// Function to view SSH details (converted to async/await)
const viewSSHDetails = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /var/www/html/ssh-${username}.txt"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil detail SSH.\nPastikan file /var/www/html/ssh-${username}.txt ada di server.`);
                return;
            }

            const formattedOutput = `🔍 *DETAIL SSH* 🔍\n\n` +
                                 "```\n" +
                                 stdout +
                                 "\n```";

            resolve(formattedOutput);
        });
    });
};

// Function to check user in /etc/shadow (converted to async/await)
const checkUserInShadow = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(false); // User not found
            } else {
                resolve(true); // User found
            }
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('detail_ssh_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, '❌ Server tidak ditemukan.');
                    return;
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username SSH yang ingin dilihat detailnya:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text.trim();
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong.');
                        return;
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { 
                                    text: '🔙 Kembali', 
                                    callback_data: `list_member_${serverIndex}` 
                                },
                            ],
                        ],
                    };

                    try {
                        // Periksa apakah user ada
                        const userExists = await checkUserInShadow(server.host, username);
                        
                        if (!userExists) {
                            await bot.sendMessage(
                                chatId, 
                                `❌ User \`${username}\` tidak ditemukan.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                }
                            );
                            return;
                        }

                        // Ambil detail SSH
                        const result = await viewSSHDetails(server.host, username);
                        
                        await bot.sendMessage(
                            chatId, 
                            result, 
                            {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            }
                        );

                    } catch (error) {
                        console.error('Error:', error);
                        await bot.sendMessage(
                            chatId, 
                            error,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            }
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};