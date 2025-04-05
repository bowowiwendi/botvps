const { exec } = require('child_process');

// Fungsi untuk melihat daftar member VLESS (async/await)
const viewVLEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('❌ VPS host tidak valid');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#&" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER VLESS* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa username (async/await)
const checkUsernameExists = async (vpsHost, username) => {
    return new Promise((resolve) => {
        const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

        exec(command, (error) => {
            resolve(!error); // true jika ada, false jika tidak
        });
    });
};

// Fungsi untuk melihat detail VLESS (async/await)
const viewVLEDetails = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /var/www/html/vless-${username}.txt"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil detail VLESS\nPastikan file /var/www/html/vless-${username}.txt ada`);
                return;
            }

            const formattedOutput = `🔍 *DETAIL VLESS* 🔍\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";

            resolve(formattedOutput);
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('vle_detail_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, '❌ Server tidak ditemukan');
                    return;
                }

                // Tampilkan daftar member VLESS
                try {
                    const listResult = await viewVLEMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    console.error('Error:', error);
                    await bot.sendMessage(chatId, '❌ Gagal mendapatkan daftar member VLESS');
                    return;
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username VLESS untuk melihat detail:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text.trim();
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong');
                        return;
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { 
                                    text: '🔙 Kembali', 
                                    callback_data: `select_server_${serverIndex}` 
                                },
                            ],
                        ],
                    };

                    try {
                        // Periksa username
                        const exists = await checkUsernameExists(server.host, username);
                        
                        if (!exists) {
                            await bot.sendMessage(
                                chatId, 
                                `❌ User \`${username}\` tidak ada`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                }
                            );
                            return;
                        }

                        // Ambil detail VLESS
                        const detailResult = await viewVLEDetails(server.host, username);
                        
                        await bot.sendMessage(
                            chatId, 
                            detailResult, 
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
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi');
        }
    });
};