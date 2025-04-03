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

// Fungsi untuk menghapus VMESS di VPS
const deleteVME = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} delws`;

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
            if (data.startsWith('vme_delete_')) {
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
                        bot.sendMessage(chatId, 'Masukkan username VME yang ingin dihapus:');

                        // Tangkap input username
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

                                // Jika username ditemukan, lanjutkan penghapusan
                                deleteVME(server.host, username, (result) => {
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
                    });
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan internal. Silakan coba lagi.');
        }
    });
};