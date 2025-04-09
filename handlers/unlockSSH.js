const { exec } = require('child_process');

// Function to check locked SSH users
const getLockedSSHUsers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/shadow | grep '^[^:]*:!!' | cut -d: -f1 | nl"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([]);
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Function to unlock SSH user
const unlockSSH = (vpsHost, username, callback) => {
    // First check if user exists and is locked
    const checkCommand = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow | grep -q '!!' && echo 'locked' || echo 'not_locked'"`;
    
    exec(checkCommand, (checkError, checkStdout, checkStderr) => {
        if (checkError) {
            return callback(`❌ Gagal memeriksa status user: ${checkStderr}`);
        }
        
        if (checkStdout.includes('not_locked')) {
            return callback(`❌ User \`${username}\` tidak terkunci.`);
        }
        
        // If user is locked, proceed with unlocking
        const unlockCommand = `ssh root@${vpsHost} "passwd -u ${username} && usermod -e '' ${username}"`;
        exec(unlockCommand, (unlockError, unlockStdout, unlockStderr) => {
            if (unlockError) {
                return callback(`❌ Gagal membuka kunci user: ${unlockStderr}`);
            }
            callback(`✅ User \`${username}\` berhasil dibuka.`);
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const serverIndex = data.split('_')[2];
        const server = servers[serverIndex];

        if (data.startsWith('unlock_ssh_')) {
            // Consistent back button
            const backButton = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                ]
            };

            // Step 1: Show list of locked users
            getLockedSSHUsers(server.host, async (lockedUsers) => {
                if (lockedUsers.length === 0) {
                    await bot.sendMessage(chatId, '🔓 Tidak ada user SSH yang terkunci', {
                        reply_markup: backButton
                    });
                    return;
                }

                // Send locked users list as separate message
                await bot.sendMessage(chatId, 
                    `📋 *Daftar User SSH Terkunci:*\n\n\`\`\`\n${lockedUsers.join('\n')}\n\`\`\``
                );

                // Step 2: Ask for username input
                await bot.sendMessage(chatId, 
                    '🔓 Masukkan username SSH yang ingin dibuka:'
                );

                // Step 3: Handle user input
                bot.once('message', async (msg) => {
                    if (msg.chat.id !== chatId) return;
                    
                    const username = msg.text.trim();
                    
                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong', {
                            reply_markup: backButton
                        });
                        return;
                    }

                    // Step 4: Verify and unlock
                    unlockSSH(server.host, username, async (result) => {
                        await bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: backButton
                        });
                    });
                });
            });
        }
    });
};