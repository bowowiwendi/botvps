const { exec } = require('child_process');

// Fungsi untuk melihat detail SSH
const viewSSHDetails = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "cat /var/www/html/ssh-${username}.txt"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: Gagal mengambil detail SSH. Pastikan file /var/www/html/ssh-${username}.txt ada di server.`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `🔍 *DETAIL SSH* 🔍\n\n` +
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

        if (data.startsWith('detail_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // Validasi server
            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username SSH:');

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

                    // Kirim pesan dengan tombol
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};