const fs = require('fs');
const saveAdmins = require('../utils/saveAdmins'); // Pastikan fungsi ini sudah didefinisikan

module.exports = (bot, userState = {}) => {
    // Fungsi untuk menampilkan menu admin
    const showAdminMenu = (chatId) => {
        const menuAdmin = `
Daftar Menu Admin:
1. /addadmin - Tambah admin baru.
Format: /addadmin <ID>
Contoh: /addadmin 123456789
2. /deladmin - Hapus admin.
Pilih admin yang ingin dihapus dari daftar.
3. /listadmin - Lihat daftar admin.
4. /detailadmin - Lihat detail admin yang sedang aktif.`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Tambah Admin', callback_data: 'addadmin' },
                    { text: 'Hapus Admin', callback_data: 'deladmin' },
                ],
                [
                    { text: 'Daftar Admin', callback_data: 'listadmin' },
                    { text: 'Detail Admin', callback_data: 'detailadmin' },
                ],
                [
                  { text: '🔙 Kembali', callback_data: 'back_to_start' }
                ],
            ],
        };

        bot.sendMessage(chatId, menuAdmin, { reply_markup: JSON.stringify(keyboard) });
    };

    // Perintah /detailadmin
    bot.onText(/\/detailadmin/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const isAdmin = admins.some(admin => admin.id === userId);

        if (isAdmin) {
            const admin = admins.find(admin => admin.id === userId);
            const detailAdmin = `
📋 Detail Admin:
- Nama: ${admin.name}
- Username: ${admin.username}
- ID: ${admin.id}`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                ],
            };

            bot.sendMessage(chatId, detailAdmin, { reply_markup: JSON.stringify(keyboard) });
        } else {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke perintah ini.');
        }
    });

    // Perintah /listadmin
    bot.onText(/\/listadmin/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const isAdmin = admins.some(admin => admin.id === userId);

        if (isAdmin) {
            const adminList = admins.map(admin => `- ${admin.name} (${admin.username})`).join('\n');
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                ],
            };

            bot.sendMessage(chatId, `Daftar Admin:\n${adminList}`, { reply_markup: JSON.stringify(keyboard) });
        } else {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke perintah ini.');
        }
    });

    // Perintah /deladmin
    bot.onText(/\/deladmin/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const isAdmin = admins.some(admin => admin.id === userId);

        if (isAdmin) {
            const keyboard = admins.map((admin, index) => [
                {
                    text: `${admin.name} (${admin.username})`,
                    callback_data: `delete_admin_${index}`,
                },
            ]);

            keyboard.push([{ text: '🔙 Kembali', callback_data: 'menu_admin' }]);

            bot.sendMessage(chatId, 'Pilih admin yang ingin dihapus:', {
                reply_markup: { inline_keyboard: keyboard },
            });
        } else {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke perintah ini.');
        }
    });

    // Perintah /addadmin
    bot.onText(/\/addadmin/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const isAdmin = admins.some(admin => admin.id === userId);

        if (isAdmin) {
            userState[chatId] = { action: 'add_admin' };
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                ],
            };

            bot.sendMessage(chatId, 'Masukkan ID Telegram admin baru:', { reply_markup: JSON.stringify(keyboard) });
        } else {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke perintah ini.');
        }
    });

    // Tangani callback query
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const isAdmin = admins.some(admin => admin.id === userId);

        if (!isAdmin) {
            bot.sendMessage(chatId, 'Maaf, Anda tidak memiliki akses ke perintah ini.');
            return;
        }

        switch (true) {
            case data === 'addadmin':
                // Set state untuk menambahkan admin
                userState[chatId] = { action: 'add_admin' };
                const keyboardAddAdmin = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                    ],
                };

                bot.sendMessage(chatId, 'Masukkan ID Telegram admin baru:', { reply_markup: JSON.stringify(keyboardAddAdmin) });
                break;

            case data === 'deladmin':
                // Tampilkan daftar admin untuk dihapus
                const keyboardDelAdmin = admins.map((admin, index) => [
                    {
                        text: `${admin.name} (${admin.username})`,
                        callback_data: `delete_admin_${index}`,
                    },
                ]);

                keyboardDelAdmin.push([{ text: '🔙 Kembali', callback_data: 'menu_admin' }]);

                bot.sendMessage(chatId, 'Pilih admin yang ingin dihapus:', {
                    reply_markup: { inline_keyboard: keyboardDelAdmin },
                });
                break;

            case data.startsWith('delete_admin_'):
                const adminIndex = parseInt(data.split('_')[2], 10);
                if (adminIndex >= 0 && adminIndex < admins.length) {
                    const admin = admins[adminIndex];
                    admins.splice(adminIndex, 1);
                    saveAdmins(admins);

                    const keyboardDeleteAdmin = {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                        ],
                    };

                    bot.sendMessage(chatId, `Admin "${admin.name}" (${admin.username}) telah dihapus.`, { reply_markup: JSON.stringify(keyboardDeleteAdmin) });
                } else {
                    bot.sendMessage(chatId, 'Admin yang dipilih tidak valid.');
                }
                break;

            case data === 'listadmin':
                const adminList = admins.map(admin => `- ${admin.name} (${admin.username})`).join('\n');
                const keyboardListAdmin = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                    ],
                };

                bot.sendMessage(chatId, `Daftar Admin:\n${adminList}`, { reply_markup: JSON.stringify(keyboardListAdmin) });
                break;

            case data === 'detailadmin':
                const admin = admins.find(admin => admin.id === userId);
                const detailAdmin = `
📋 Detail Admin:
- Nama: ${admin.name}
- Username: ${admin.username}
- ID: ${admin.id}`;

                const keyboardDetailAdmin = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                    ],
                };

                bot.sendMessage(chatId, detailAdmin, { reply_markup: JSON.stringify(keyboardDetailAdmin) });
                break;

            case data === 'menu_admin':
                bot.answerCallbackQuery(query.id);
                showAdminMenu(chatId);
                break;
        }
    });

    // Tangani pesan teks (untuk /addadmin)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (userState[chatId] && userState[chatId].action === 'add_admin') {
            const newAdminId = parseInt(text);

            if (isNaN(newAdminId)) {
                bot.sendMessage(chatId, 'ID tidak valid. Harap masukkan angka ID Telegram.');
                delete userState[chatId];
                return;
            }

            try {
                const userInfo = await bot.getChat(newAdminId);
                const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));

                const isAdminExists = admins.some(admin => admin.id === newAdminId);
                if (isAdminExists) {
                    bot.sendMessage(chatId, `Admin dengan ID ${newAdminId} sudah terdaftar.`);
                    delete userState[chatId];
                    return;
                }

                admins.push({
                    id: newAdminId,
                    username: userInfo.username || 'tidak ada username',
                    name: userInfo.first_name || 'tidak ada nama',
                });
                saveAdmins(admins);

                const keyboardAddAdminSuccess = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: 'menu_admin' }],
                    ],
                };

                bot.sendMessage(chatId, `Admin baru telah ditambahkan:\n\nID: ${newAdminId}\nUsername: ${userInfo.username || 'tidak ada username'}\nNama: ${userInfo.first_name || 'tidak ada nama'}`, { reply_markup: JSON.stringify(keyboardAddAdminSuccess) });
            } catch (error) {
                bot.sendMessage(chatId, `Gagal mendapatkan informasi pengguna dengan ID ${newAdminId}. Pastikan ID valid dan bot sudah berinteraksi dengan pengguna tersebut.`);
            }

            delete userState[chatId];
        }
    });
};