const saveServers = require('../utils/saveServers');

module.exports = (bot, userState, servers) => {
    // Fungsi untuk memulai mode tambah server
    const startAddServer = (chatId) => {
        userState[chatId] = { action: 'add_server' };
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Kembali', callback_data: 'back_to_start' }],
            ],
        };

        bot.sendMessage(chatId, 'Masukkan detail server dalam format:\n\nNama Host PathPrivateKey Domain\n\nContoh:\nServerBaru 192.168.1.3 /path/to/private/key/id_rsa example.com', { reply_markup: JSON.stringify(keyboard) });
    };

    // Perintah /addserver
    bot.onText(/\/addserver/, (msg) => {
        const chatId = msg.chat.id;
        startAddServer(chatId);
    });

    // Tangani callback query (tombol "➕ Tambah Server")
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data === 'add_server') {
            startAddServer(chatId);
        }
    });

    // Tangani pesan teks (detail server yang dikirim pengguna)
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (userState[chatId] && userState[chatId].action === 'add_server') {
            const details = text.split(' ');
            if (details.length !== 4) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'back_to_start' }],
                    ],
                };

                bot.sendMessage(chatId, 'Format tidak valid. Pastikan format:\n\nNama Host PathPrivateKey Domain\n\nContoh:\nServerBaru 192.168.1.3 /path/to/private/key/id_rsa example.com', { reply_markup: JSON.stringify(keyboard) });
                delete userState[chatId];
                return;
            }

            const [name, host, privateKey, domain] = details;
            servers.push({
                name,
                host,
                port: 22, // Port diisi otomatis dengan 22
                username: 'root', // Username diisi otomatis dengan root
                privateKey,
                domain, // Tambahkan domain ke objek server
            });
            saveServers(servers);

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: 'back_to_start' }],
                ],
            };

            bot.sendMessage(chatId, `Server "${name}" dengan domain "${domain}" telah ditambahkan.\n\nDetail:\n- Host: ${host}\n- Port: 22\n- Username: root`, { reply_markup: JSON.stringify(keyboard) });
            delete userState[chatId];
        }
    });
};