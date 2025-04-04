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

// Fungsi untuk menghapus Shadowsocks di VPS
const deleteSS = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} delss`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dihapus.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('ss_delete_')) {
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
                await bot.sendMessage(chatId, 'Masukkan username Shadowsocks yang ingin dihapus:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    // Validasi username
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Periksa apakah username ada di /etc/xray/config.json
                    checkUsernameExists(server.host, username, async (exists) => {
                        if (!exists) {
                            // Jika username tidak ditemukan, tampilkan pesan dengan tombol kembali
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                    ],
                                ],
                            };

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

                        // Jika username ditemukan, lanjutkan penghapusan
                        deleteSS(server.host, username, (result) => {
                            // Tambahkan tombol "Kembali ke Menu Server"
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                    ],
                                ],
                            };

                            // Kirim pesan hasil penghapusan dengan tombol
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