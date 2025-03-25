const { exec } = require('child_process');

// Fungsi untuk mendapatkan daftar akun yang terkunci
const getLockedAccounts = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/xray/.lock.db 2>/dev/null | grep '^###' | cut -d ' ' -f 2-3 | sort | uniq | nl"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([]);
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Fungsi untuk memeriksa apakah username terkunci
const checkUserLocked = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep -w '${username}' /etc/xray/.lock.db 2>/dev/null"`;
    
    exec(command, (error, stdout) => {
        callback(!error && stdout.trim() !== '');
    });
};
// Fungsi untuk membuka kunci akun
const unlockVME = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "unlock-vm '${username}'"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal membuka kunci: ${stderr}`);
        } else {
            callback(`✅ Berhasil membuka kunci \`${username}\``);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const serverIndex = data.split('_')[2];
        const server = servers[serverIndex];

        if (!server) {
            await bot.sendMessage(chatId, '❌ Server tidak ditemukan', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'main_menu' }]
                    ]
                }
            });
            return;
        }

        if (data.startsWith('vme_unlock_')) {
            getLockedAccounts(server.host, async (accounts) => {
                const backButton = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                    ]
                };

                if (accounts.length === 0) {
                    await bot.sendMessage(chatId, '🔓 Tidak ada akun yang terkunci', {
                        reply_markup: backButton
                    });
                    return;
                }

                await bot.sendMessage(chatId, 
                    `🔒 *Daftar Akun Terkunci:*\n\n\`\`\`\n${accounts.join('\n')}\n\`\`\`\nMasukkan username:`, 
                    { parse_mode: 'Markdown' }
                );

                const listenerId = `unlock_${chatId}_${Date.now()}`;
                
                bot.once(listenerId, async (msg) => {
                    if (msg.chat.id !== chatId) return;
                    
                    const username = msg.text.trim();
                    
                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong', {
                            reply_markup: backButton
                        });
                        return;
                    }

                    checkUserLocked(server.host, username, async (isLocked) => {
                        if (!isLocked) {
                            await bot.sendMessage(chatId, 
                                `❌ User \`${username}\` tidak terkunci`, 
                                { 
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton 
                                }
                            );
                            return;
                        }

                        unlockVME(server.host, username, async (result) => {
                            await bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: backButton
                            });
                        });
                    });
                });

                bot.on('message', (msg) => {
                    if (msg.text && msg.chat.id === chatId) {
                        bot.emit(listenerId, msg);
                    }
                });
            });
        }
    });
};