const fs = require('fs');
module.exports = (bot) => {
    // Baca database admin
    const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));

    // Fungsi untuk menampilkan menu start
    const startCommand = (chatId) => {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📋 Pilih Server', callback_data: 'list_servers' },
                ],
                [
                    { text: '➕ Tambah Server', callback_data: 'add_server' },
                ],
                [
                    { text: '❌ Hapus Server', callback_data: 'delete_server' },
                ],
                [                    { text: '👤 Manage Admin', callback_data: 'menu_admin' },
                ],
                [                    { text: '📢 Broadcast Pesan', callback_data: 'start_broadcast' },
                ],
            ],
        };

        const message = `
Selamat datang di VPS Manager Bot! 🚀
**WENDIVPN STORE**
Anda dapat menggunakan tombol di bawah untuk memilih perintah:
- 📋 Pilih Server: Daftar Server.
- ➕ Tambah Server: Tambahkan server baru.
- ❌ Hapus Server: Hapus server .
        `;

        bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
        });
    };

    // Perintah /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Cek apakah pengguna adalah admin
        const isAdmin = admins.some(admin => admin.id === userId);

        if (isAdmin) {
            startCommand(chatId);
        } else {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke bot ini.');
        }
    });

    // Tangani callback query (tombol "🔙 Kembali ke Start")
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        // Cek apakah pengguna adalah admin
        const isAdmin = admins.some(admin => admin.id === userId);

        if (data === 'back_to_start' && isAdmin) {
            startCommand(chatId);
        } else if (!isAdmin) {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke bot ini.');
        }
    });
};