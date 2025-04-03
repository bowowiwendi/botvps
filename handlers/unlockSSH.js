const { exec } = require('child_process');

// Function to unlock SSH user
const unlockSSH = (vpsHost, username, callback) => {
    // First check if user exists in /etc/shadow
    const checkCommand = `ssh root@${vpsHost} "grep -q '^${username}:' /etc/shadow && echo 'exists' || echo 'not_exists'"`;
    
    exec(checkCommand, (checkError, checkStdout, checkStderr) => {
        if (checkError) {
            return callback(`❌ Gagal memeriksa user: ${checkError.message}`);
        }
        
        if (checkStdout.includes('not_exists')) {
            return callback(`❌ User \`${username}\` tidak ditemukan.`);
        }
        
        // If user exists, proceed with unlocking
        const unlockCommand = `printf "${username}" | ssh root@${vpsHost} user-unlock.sh`;
        exec(unlockCommand, (unlockError, unlockStdout, unlockStderr) => {
            if (unlockError) {
                return callback(`❌ Gagal membuka user: ${unlockError.message}`);
            }
            callback(`✅ User \`${username}\` berhasil dibuka.`);
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('unlock_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            //     return;
            // }
            
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
                        reply_markup: keyboard,
                        parse_mode: 'Markdown'
                    });
                });
            });
        }
    });
};