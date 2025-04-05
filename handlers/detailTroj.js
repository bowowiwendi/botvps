const { exec } = require('child_process');

// Fungsi untuk melihat daftar member Trojan (async/await)
const viewTrojMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('❌ VPS host tidak valid.');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#!" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
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

// Fungsi untuk memeriksa username (async/await)
const checkUsernameExists = async (vpsHost, username) => {
    return new Promise((resolve) => {
        const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

        exec(command, (error) => {
            resolve(!error); // Return true if exists, false if not
        });
    });
};

// Fungsi untuk melihat detail Trojan (async/await)
const viewTrojDetails = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /var/www/html/trojan-${username}.txt"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil detail Trojan.\nPastikan file /var/www/html/trojan-${username}.txt ada di server.`);
                return;
            }

            const formattedOutput = `🔍 *DETAIL TROJAN* 🔍\n\n` +
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
            if (data.startsWith('troj_detail_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, '❌ Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar member Trojan
                try {
                    const listResult = await viewTrojMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    console.error('Error:', error);
                    await bot.sendMessage(chatId, '❌ Gagal mendapatkan daftar member Trojan.');
                    return;
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username Trojan untuk melihat detail:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text.trim();
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong.');
                        return;
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    try {
                        // Periksa username
                        const exists = await checkUsernameExists(server.host, username);
                        
                        if (!exists) {
                            await bot.sendMessage(
                                chatId, 
                                `❌ User \`${username}\` tidak ada.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                }
                            );
                            return;
                        }

                        // Ambil detail Trojan
                        const detailResult = await viewTrojDetails(server.host, username);
                        
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
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};