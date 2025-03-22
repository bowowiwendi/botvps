const executeCommand = require('../ssh/executeCommand');

module.exports = (bot, userState, servers) => {
    // Tangani callback query (ketika tombol ditekan)
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('select_server_')) {
            const serverIndex = data.split('_')[2]; // Ambil index server dari callback_data
            const server = servers[serverIndex];

            if (!server) {
                bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Simpan server yang dipilih ke state pengguna
            userState[chatId] = { server };

            // Minta perintah dari pengguna
            bot.sendMessage(chatId, `Anda memilih server ${server.name}. Silakan ketik perintah yang ingin dijalankan:`);
        }
    });

    // Tangani pesan teks (perintah yang dikirim pengguna)
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // Cek apakah pengguna sedang dalam mode memilih perintah
        if (userState[chatId] && userState[chatId].server) {
            const server = userState[chatId].server;
            const command = text;

            // Jalankan perintah SSH
            executeCommand(server, command, (err, output) => {
                if (err) {
                    bot.sendMessage(chatId, err);
                } else {
                    bot.sendMessage(chatId, `Output dari ${server.name}:\n${output}`);
                }

                // Hapus state pengguna setelah perintah selesai
                delete userState[chatId];
            });
        }
    });
};