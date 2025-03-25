const { exec } = require('child_process');

// Fungsi untuk registrasi IP baru
const registerIP = (vpsHost, ip, username, exp, callback) => {
    const command = `ssh root@${vpsHost} "register-ip ${ip} ${username} ${exp}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal registrasi IP:\nIP: ${ip}\nUser: ${username}\nMasa aktif: ${exp} hari\nError: ${stderr}`);
        } else {
            callback(`✅ Registrasi berhasil:\n\n` +
                   `🔹 IP: \`${ip}\`\n` +
                   `🔹 User: \`${username}\`\n` +
                   `🔹 Masa aktif: \`${exp}\` hari`);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('register_ip_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Langsung minta input IP tanpa menampilkan list member
                bot.sendMessage(chatId, 'Masukkan IP address:');
                
                let ip, username, exp;
                
                // Tangkap input IP
                bot.once('message', (msg) => {
                    ip = msg.text.trim();
                    
                    // Validasi IP
                    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                        bot.sendMessage(chatId, 'Format IP tidak valid. Contoh: 123.123.123.123', {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                                ]
                            }
                        });
                        return;
                    }
                    
                    // Minta input username
                    bot.sendMessage(chatId, 'Masukkan username:');
                    
                    // Tangkap input username
                    bot.once('message', (msg) => {
                        username = msg.text.trim();
                        
                        // Validasi username
                        if (!username || username.length < 3) {
                            bot.sendMessage(chatId, 'Username minimal 3 karakter', {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                                    ]
                                }
                            });
                            return;
                        }
                        
                        // Minta input masa aktif
                        bot.sendMessage(chatId, 'Masukkan masa aktif (dalam hari):');
                        
                        // Tangkap input masa aktif
                        bot.once('message', async (msg) => {
                            exp = msg.text.trim();
                            
                            // Validasi masa aktif
                            if (!exp || isNaN(exp)) {
                                await bot.sendMessage(chatId, 'Masa aktif harus angka (dalam hari)', {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                                        ]
                                    }
                                });
                                return;
                            }
                            
                            // Konfirmasi dengan tombol Ya/Tidak
                            const confirmationMessage = `Konfirmasi registrasi:\n\n` +
                                                       `IP: ${ip}\n` +
                                                       `User: ${username}\n` +
                                                       `Masa aktif: ${exp} hari`;
                            
                            bot.sendMessage(chatId, confirmationMessage, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: '✅ Ya', callback_data: `confirm_register_${serverIndex}_${ip}_${username}_${exp}` },
                                            { text: '❌ Tidak', callback_data: `cancel_register_${serverIndex}` }
                                        ]
                                    ]
                                }
                            });
                        });
                    });
                });
            }
            // Handle konfirmasi
            else if (data.startsWith('confirm_register_')) {
                const parts = data.split('_');
                const serverIndex = parts[2];
                const ip = parts[3];
                const username = parts[4];
                const exp = parts[5];
                const server = servers[serverIndex];

                // Proses registrasi
                registerIP(server.host, ip, username, exp, (result) => {
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                            ]
                        }
                    });
                });
            }
            // Handle pembatalan
            else if (data.startsWith('cancel_register_')) {
                const serverIndex = data.split('_')[2];
                bot.sendMessage(chatId, 'Registrasi dibatalkan', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan internal. Silakan coba lagi.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'main_menu' }]
                    ]
                }
            });
        }
    });
};