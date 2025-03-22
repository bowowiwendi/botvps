const { exec } = require('child_process');

// Fungsi untuk menghapus SSH di VPS
const deleteVLE = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} delvless`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dihapus.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('vle_delete_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username VLE yang ingin dihapus:');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const username = msg.text;

                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                // Panggil fungsi deleteSSH
                deleteVLE(server.host, username, (result) => {
                    // Tambahkan tombol "Kembali ke Menu Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali ke Menu Server', callback_data: `select_server_${serverIndex}` },
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
        }
    });
};