const saveServers = require('../utils/saveServers');

module.exports = (bot, userState, servers) => {
    // Fungsi untuk memulai mode hapus server
    const startDeleteServer = (chatId) => {
        const keyboard = servers.map((server, index) => [
            {
                text: server.name,
                callback_data: `delete_server_${index}`,
            },
        ]);

        // Tambahkan tombol "Back to Start" di bawah list server
        keyboard.push([
            {
                text: '🔙 Kembali',
                callback_data: 'back_to_start',
            },
        ]);

        bot.sendMessage(chatId, 'Pilih server yang ingin dihapus:', {
            reply_markup: {
                inline_keyboard: keyboard,
            },
        });
    };

    // Perintah /delserver
    bot.onText(/\/delserver/, (msg) => {
        const chatId = msg.chat.id;
        startDeleteServer(chatId);
    });

    // Tangani callback query (tombol "❌ Hapus Server" dan "Back to Start")
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data === 'delete_server') {
            startDeleteServer(chatId);
        } else if (data.startsWith('delete_server_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            servers.splice(serverIndex, 1);
            saveServers(servers);

            // Kirim pesan konfirmasi penghapusan beserta tombol "Back to Start"
            bot.sendMessage(chatId, `Server "${server.name}" telah dihapus.`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🔙 Kembali',
                                callback_data: 'back_to_start',
                            },
                        ],
                    ],
                },
            });
        } 
    });
};