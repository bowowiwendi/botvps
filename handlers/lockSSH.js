const { exec } = require('child_process');

// Fungsi untuk mengecek daftar user yang terkunci
const getLockedSSHUsers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/shadow | grep '^[^:]*:!!' | cut -d: -f1 | nl 2>/dev/null"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([]);
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Fungsi untuk mengecek status user
const checkUserStatus = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '^${username}:' /etc/shadow | grep -q '!!' && echo 'locked' || echo 'unlocked'"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback('error');
        } else {
            callback(stdout.trim());
        }
    });
};

// Fungsi untuk mengunci SSH di VPS
const lockSSH = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "passwd -l ${username} && usermod -e 1 ${username}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengunci: ${stderr}`);
            } else {
                resolve(`✅ User \`${username}\` berhasil dikunci`);
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
                getLockedSSHUsers(server.host, async (lockedUsers) => {
                    if (lockedUsers.length > 0) {
                        await bot.sendMessage(chatId, 
                            `📋 *Daftar User SSH Terkunci:*\n\n\`\`\`\n${lockedUsers.join('\n')}\n\`\`\``, 
                            { 
                                parse_mode: 'Markdown',
                                reply_markup: backButton
                            }
                        );
                    }

                    // Minta input username
                    await bot.sendMessage(chatId, '🔒 Masukkan username SSH yang ingin dikunci:', {
                        reply_markup: backButton
                    });

                    // Tangkap input pengguna
                    bot.once('message', async (msg) => {
                        if (msg.chat.id !== chatId) return;
                        
                        const username = msg.text.trim();
                        
                        if (!username) {
                            await bot.sendMessage(chatId, '❌ Username tidak boleh kosong', {
                                reply_markup: backButton
                            });
                            return;
                        }

                        try {
                            // Verifikasi status user
                            checkUserStatus(server.host, username, async (status) => {
                                if (status === 'error') {
                                    await bot.sendMessage(chatId, 
                                        `❌ User \`${username}\` tidak ditemukan`, 
                                        {
                                            parse_mode: 'Markdown',
                                            reply_markup: backButton
                                        }
                                    );
                                    return;
                                }

                                if (status === 'locked') {
                                    await bot.sendMessage(chatId, 
                                        `⚠️ User \`${username}\` sudah terkunci`, 
                                        {
                                            parse_mode: 'Markdown',
                                            reply_markup: backButton
                                        }
                                    );
                                    return;
                                }

                                // Proses mengunci
                                const result = await lockSSH(server.host, username);
                                await bot.sendMessage(chatId, result, {
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton
                                });
                            });
                        } catch (error) {
                            await bot.sendMessage(chatId, error, {
                                reply_markup: backButton
                            });
                        }
                    });
                });
            } catch (error) {
                await bot.sendMessage(chatId, '❌ Gagal memproses permintaan', {
                    reply_markup: backButton
                });
            }
        }
    });
};