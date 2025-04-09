const { exec } = require('child_process');

// Fungsi untuk sanitasi input username
const sanitizeUsername = (username) => {
    // Hanya izinkan karakter alfanumerik, underscore, dan tanda hubung
    return username.replace(/[^a-zA-Z0-9_-]/g, '');
};

// Fungsi untuk mengecek daftar user yang terkunci
const getLockedSSHUsers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/shadow | grep '^[^:]*:!!' | cut -d: -f1 | nl 2>/dev/null"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([], stderr || 'Tidak ada user terkunci atau terjadi kesalahan');
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Fungsi untuk mengecek status user
const checkUserStatus = (vpsHost, username, callback) => {
    const sanitizedUsername = sanitizeUsername(username);
    const command = `ssh root@${vpsHost} "grep '^${sanitizedUsername}:' /etc/shadow | grep -q '!!' && echo 'locked' || echo 'unlocked'"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback('error', stderr || 'Gagal memeriksa status user');
        } else {
            callback(stdout.trim());
        }
    });
};

// Fungsi untuk mengunci SSH di VPS
const lockSSH = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const sanitizedUsername = sanitizeUsername(username);
        const command = `ssh root@${vpsHost} "passwd -l ${sanitizedUsername} && usermod -e 1 ${sanitizedUsername}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengunci: ${stderr}`);
            } else {
                resolve(`✅ User \`${sanitizedUsername}\` berhasil dikunci`);
            }
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('lock_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            
            // Tombol kembali yang konsisten
            const backButton = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                ]
            };

            try {
                // Tampilkan daftar user terkunci terlebih dahulu
                await new Promise((resolve) => {
                    getLockedSSHUsers(server.host, async (lockedUsers, error) => {
                        if (error && lockedUsers.length === 0) {
                            await bot.sendMessage(chatId, error, {
                                reply_markup: backButton,
                                parse_mode: 'Markdown'
                            });
                        } else if (lockedUsers.length > 0) {
                            await bot.sendMessage(chatId, 
                                `📋 *Daftar User SSH Terkunci:*\n\n\`\`\`\n${lockedUsers.join('\n')}\n\`\`\``,
                                { parse_mode: 'Markdown' }
                            );
                        }
                        resolve();
                    });
                });

                // Minta input username
                await bot.sendMessage(chatId, '🔒 Masukkan username SSH yang ingin dikunci:', {
                    parse_mode: 'Markdown'
                });

                // Tangkap input pengguna
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

                    try {
                        // Verifikasi status user
                        await new Promise((resolve) => {
                            checkUserStatus(server.host, username, async (status, errorMsg) => {
                                if (status === 'error') {
                                    await bot.sendMessage(chatId, 
                                        `❌ User \`${sanitizeUsername(username)}\` tidak ditemukan: ${errorMsg}`, 
                                        {
                                            parse_mode: 'Markdown',
                                            reply_markup: backButton
                                        }
                                    );
                                    return resolve();
                                }

                                if (status === 'locked') {
                                    await bot.sendMessage(chatId, 
                                        `⚠️ User \`${sanitizeUsername(username)}\` sudah terkunci`, 
                                        {
                                            parse_mode: 'Markdown',
                                            reply_markup: backButton
                                        }
                                    );
                                    return resolve();
                                }

                                // Proses mengunci
                                const result = await lockSSH(server.host, username);
                                await bot.sendMessage(chatId, result, {
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton
                                });
                                resolve();
                            });
                        });
                    } catch (error) {
                        await bot.sendMessage(chatId, error, {
                            reply_markup: backButton,
                            parse_mode: 'Markdown'
                        });
                    }
                });
            } catch (error) {
                await bot.sendMessage(chatId, `❌ Gagal memproses permintaan: ${error}`, {
                    reply_markup: backButton,
                    parse_mode: 'Markdown'
                });
            }
        }
    });
};