const { exec } = require('child_process');

// Fungsi untuk sanitasi input username
const sanitizeUsername = (username) => {
    // Hanya izinkan karakter alfanumerik, underscore, dan tanda hubung
    return username.replace(/[^a-zA-Z0-9_-]/g, '');
};

// Function to check locked SSH users
const getLockedSSHUsers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/shadow | grep '^[^:]*:!!' | cut -d: -f1 | nl"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([], stderr || 'Tidak ada user terkunci atau terjadi kesalahan');
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Function to unlock SSH user
const unlockSSH = (vpsHost, username, callback) => {
    const sanitizedUsername = sanitizeUsername(username);

    // First check if user exists and is locked
    const checkCommand = `ssh root@${vpsHost} "grep '^${sanitizedUsername}:' /etc/shadow | grep -q '!!' && echo 'locked' || echo 'not_locked'"`;
    
    exec(checkCommand, (checkError, checkStdout, checkStderr) => {
        if (checkError) {
            return callback(`❌ Gagal memeriksa status user: ${checkStderr}`);
        }
        
        if (checkStdout.trim() === 'not_locked') {
            return callback(`❌ User \`${sanitizedUsername}\` tidak terkunci atau tidak ditemukan.`);
        }
        
        // If user is locked, proceed with unlocking
        const unlockCommand = `ssh root@${vpsHost} "passwd -u ${sanitizedUsername} && usermod -e '' ${sanitizedUsername}"`;
        exec(unlockCommand, (unlockError, unlockStdout, unlockStderr) => {
            if (unlockError) {
                return callback(`❌ Gagal membuka kunci user: ${unlockStderr}`);
            }
            callback(`✅ User \`${sanitizedUsername}\` berhasil dibuka.`);
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
            getLockedSSHUsers(server.host, async (lockedUsers, error) => {
                if (error || lockedUsers.length === 0) {
                    await bot.sendMessage(chatId, error || '🔓 Tidak ada user SSH yang terkunci', {
                        reply_markup: backButton,
                        parse_mode: 'Markdown'
                    });
                    return;
                }

                // Send locked users list as separate message
                await bot.sendMessage(chatId, 
                    `📋 *Daftar User SSH Terkunci:*\n\n\`\`\`\n${lockedUsers.join('\n')}\n\`\`\``,
                    { parse_mode: 'Markdown' }
                );

                // Step 2: Ask for username input
                await bot.sendMessage(chatId, 
                    '🔓 Masukkan username SSH yang ingin dibuka:',
                    { parse_mode: 'Markdown' }
                );

                // Step 3: Handle user input
                bot.once('message', async (msg) => {
                    if (msg.chat.id !== chatId) return;
                    
                    const username = msg.text.trim();
                    
                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong', {
                            reply_markup: backButton,
                            parse_mode: 'Markdown'
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