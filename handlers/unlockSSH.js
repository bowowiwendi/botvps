const { exec } = require('child_process');

// Function to view SSH members (you might want to define this if it's not already defined)
const viewSSHMembers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} bot-member-ssh`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }
        const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                              "```\n" +
                              stdout +
                              "\n```";
        callback(null, formattedOutput);
    });
};

// Function to unlock SSH user
const unlockSSH = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} user-unlock.sh`;
    exec(command, (error, stdout, stderr) => {
        callback(`✅ User \`${username}\` berhasil dibuka.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('unlock_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }
            
            // First show the list of SSH members
            viewSSHMembers(server.host, async (error, result) => {
                if (error) {
                    await bot.sendMessage(chatId, error);
                    return;
                }

                // Send the member list
                await bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });

                // Ask for username input
                await bot.sendMessage(chatId, 'Masukkan username SSH yang ingin dibuka:');

                // Set up a one-time message listener
                bot.once('message', async (msg) => {
                    // Check if the message comes from the same chat
                    if (msg.chat.id !== chatId) return;
                    
                    const username = msg.text.trim();

                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Call the unlock function
                    unlockSSH(server.host, username, async (result) => {
                        // Create back button
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                ],
                            ],
                        };

                        // Send the result with back button
                        await bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        });
                    });
                });
            });
        }
    });
};