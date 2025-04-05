const { exec } = require('child_process');

const viewTrojMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('❌ VPS host tidak valid');
            return;
        }

        const command = `ssh root@${vpsHost} "cat /etc/xray/config.json | grep '^#!' | cut -d ' ' -f 2-3 | sort | uniq | nl 2>/dev/null"`;

        exec(command, (error, stdout, stderr) => {
            if (error || !stdout.trim()) {
                reject('❌ Gagal mendapatkan daftar member');
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER TROJAN* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";
            resolve(formattedOutput);
        });
    });
};

const checkUsernameExists = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "grep -w '${username}' /etc/xray/config.json 2>/dev/null"`;
        
        exec(command, (error, stdout) => {
            resolve(!error && stdout.trim() !== '');
        });
    });
};

const lockTroj = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "lock-tr '${username}'"`;
        
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

        if (data.startsWith('troj_lock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            
            // Tombol kembali yang konsisten
            const backButton = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                ]
            };

            try {
                // Tampilkan daftar member terlebih dahulu
                const listResult = await viewTrojMembers(server.host);
                await bot.sendMessage(chatId, listResult, {
                    parse_mode: 'Markdown',
                    reply_markup: backButton
                });

                // Minta input username
                await bot.sendMessage(chatId, '🔒 Masukkan username Trojan yang ingin dikunci:', {
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
                        // Verifikasi username
                        const exists = await checkUsernameExists(server.host, username);
                        if (!exists) {
                            await bot.sendMessage(chatId, 
                                `❌ User \`${username}\` tidak ditemukan`, 
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton
                                }
                            );
                            return;
                        }

                        // Proses mengunci
                        const result = await lockTroj(server.host, username);
                        await bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: backButton
                        });
                    } catch (error) {
                        await bot.sendMessage(chatId, error, {
                            reply_markup: backButton
                        });
                    }
                });
            } catch (error) {
                await bot.sendMessage(chatId, error, {
                    reply_markup: backButton
                });
            }
        }
    });
};