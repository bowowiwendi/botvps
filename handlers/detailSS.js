const { exec } = require('child_process');

// Fungsi untuk melihat daftar member Shadowsocks
const viewSSMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('Error: VPS host tidak valid.');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#!!" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${stderr}`);
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER SHADOWSOCKS* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa username
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(false);
        } else {
            callback(true);
        }
    });
};

// Fungsi untuk melihat detail Shadowsocks
const viewSSHDetails = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /var/www/html/shadowsocks-${username}.txt"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: Gagal mengambil detail Shadowsocks.\nPastikan file /var/www/html/shadowsocks-${username}.txt ada di server.`);
                return;
            }

            const formattedOutput = `🔍 *DETAIL SHADOWSOCKS* 🔍\n\n` +
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
            if (data.startsWith('ss_detail_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar member Shadowsocks
                try {
                    const listResult = await viewSSMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    console.error('Error:', error);
                    await bot.sendMessage(chatId, 'Gagal mendapatkan daftar member Shadowsocks.');
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username Shadowsocks untuk melihat detail:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Periksa username
                    checkUsernameExists(server.host, username, async (exists) => {
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

                        // Ambil detail Shadowsocks
                        try {
                            const detailResult = await viewSSHDetails(server.host, username);
                            await bot.sendMessage(chatId, detailResult, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            });
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
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};