const { exec } = require('child_process');

// Fungsi untuk melihat daftar member SSH
const viewVMEMembers = (vpsHost, callback) => {
    // Validasi input
    if (!vpsHost || typeof vpsHost !== 'string') {
        callback('Error: VPS host tidak valid.');
        return;
    }

    const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^###" | cut -d " " -f 2-3 | sort | uniq | nl`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER VME* 📋\n\n` +
                                "```\n" +
                                stdout +
                                "\n```";

        callback(null, formattedOutput);
    });
};

// Fungsi untuk melihat detail SSH
const viewSSHDetails = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "cat /var/www/html/vmess-${username}.txt"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: Gagal mengambil detail VME. Pastikan file /var/www/html/vmess-${username}.txt ada di server.`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `🔍 *DETAIL VME* 🔍\n\n` +
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
            if (data.startsWith('vme_detail_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                // if (!server) {
                //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                //     return;
                // }

                // Tampilkan daftar VME terlebih dahulu
                viewVMEMembers(server.host, (error, result) => {
                    if (error) {
                        bot.sendMessage(chatId, error);
                        return;
                    }

                    // Kirim daftar VME ke pengguna
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                    }).then(() => {
                        // Minta input username dari pengguna setelah menampilkan daftar
                        bot.sendMessage(chatId, 'Masukkan username VME untuk melihat detail:');

                        // Tangkap input username
                        bot.once('message', async (msg) => {
                            const username = msg.text;

                            // Validasi username
                            if (!username) {
                                await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                                return;
                            }

                            // Panggil fungsi viewSSHDetails
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
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan internal. Silakan coba lagi.');
        }
    });
};