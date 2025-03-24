const { exec } = require('child_process');

// Fungsi untuk melihat daftar member Shadowsocks
const viewSSMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        // Validasi input
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

            // Format hasil menjadi lebih menarik
            const formattedOutput = `📋 *DAFTAR MEMBER SHADOWSOCKS* 📋\n\n` +
                                    "```\n" +
                                    stdout +
                                    "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // Jika username tidak ditemukan
            callback(false);
        } else {
            // Jika username ditemukan
            callback(true);
        }
    });
};

// Fungsi untuk melihat detail Shadowsocks
const viewSSHDetails = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "cat /var/www/html/shadowsocks-${username}.txt"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: Gagal mengambil detail Shadowsocks. Pastikan file /var/www/html/shadowsocks-${username}.txt ada di server.`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `🔍 *DETAIL SHADOWSOCKS* 🔍\n\n` +
                               "```\n" +
                               stdout +
                               "\n```";

        callback(null, formattedOutput);
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

                // Tampilkan daftar Shadowsocks terlebih dahulu
                const listResult = await viewSSMembers(server.host);

                // Kirim daftar Shadowsocks ke pengguna
                await bot.sendMessage(chatId, listResult, {
                    parse_mode: 'Markdown',
                });

                // Minta input username dari pengguna setelah menampilkan daftar
                await bot.sendMessage(chatId, 'Masukkan username Shadowsocks untuk melihat detail:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;

                    // Validasi username
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Periksa apakah username ada di /etc/xray/config.json
                    checkUsernameExists(server.host, username, (exists) => {
                        if (!exists) {
                            // Jika username tidak ditemukan
                            bot.sendMessage(chatId, `❌ User \`${username}\` tidak ada.`);
                            return;
                        }

                        // Jika username ditemukan, lanjutkan mengambil detail
                        viewSSHDetails(server.host, username, (error, result) => {
                            if (error) {
                                bot.sendMessage(chatId, error);
                                return;
                            }

                            // Tambahkan tombol "Kembali ke Pemilihan Server"
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                    ],
                                ],
                            };

                            // Kirim pesan detail dengan tombol
                            bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard,
                            });
                        });
                    });
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};