const fs = require('fs');
module.exports = (bot) => {
    // Baca database admin
    const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));

    // Fungsi untuk menampilkan menu start (admin utama)
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
                [
                    { text: '👤 Manage Admin', callback_data: 'menu_admin' },
                ],
                [
                    { text: '📢 Broadcast Pesan', callback_data: 'start_broadcast' },
                ],
            ],
        };

        const message = `
Selamat Datang 
di WENDI STORE New Bot! 🚀
Anda dapat menggunakan tombol 
di bawah untuk memilih perintah:
- 📋 Pilih Server
- ➕ Tambah Server
- ❌ Hapus Server
- 👤 Manage Admin
- 📢 Broadcast
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
        const adminData = admins.find(admin => admin.id === userId);
        const isAdmin = adminData !== undefined;
        const isPrimaryAdmin = isAdmin && admins[0].id === userId;

        if (!isAdmin) {
            return bot.sendMessage(chatId, `ID Anda: ${userId}\n\nJika ingin mendaftar, berikan ID ini ke @wendivpn`);
        }

        if (isPrimaryAdmin) {
            startCommand(chatId);
        } else {
            bot.sendMessage(
                chatId, 
                'Selamat Datang Admin!\n\n' +
                'Gunakan perintah /menu untuk memilih server.\n' +
                'Atau /help untuk melihat panduan.'
            );
        }
    });

    // Tangani callback query (tombol "🔙 Kembali ke Start")
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        // Cek apakah pengguna adalah admin
        const adminData = admins.find(admin => admin.id === userId);
        const isAdmin = adminData !== undefined;
        const isPrimaryAdmin = isAdmin && admins[0].id === userId;

        if (!isAdmin) {
            return bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke bot ini.');
        }

        if (data === 'back_to_start') {
            if (isPrimaryAdmin) {
                startCommand(chatId);
            } else {
                bot.sendMessage(
                    chatId,
                    'Kembali ke menu utama.\n\n' +
                    'Gunakan perintah /menu untuk memilih server.'
                );
            }
        }
    });
};