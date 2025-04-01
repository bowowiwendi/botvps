const fs = require('fs');
const saveAdmins = require('../utils/saveAdmins');

module.exports = (bot, userState = {}) => {
    // Helper functions
    const getAdmins = () => {
        try {
            return JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        } catch (error) {
            console.error('Error reading admins:', error);
            return [];
        }
    };

    const isAdmin = (userId) => {
        const admins = getAdmins();
        return admins.some(admin => admin.id === userId);
    };

    const isMainAdmin = (userId) => {
        const admins = getAdmins();
        return admins.some(admin => admin.id === userId && admin.is_main === true);
    };

    const admins = getAdmins();
    const firstAdmin = admins.length > 0 ? admins[0] : null;

    // Fungsi untuk menampilkan menu admin
    const showAdminMenu = (chatId) => {
        const menuAdmin = `
🛠️ *Menu Admin*:
1. Tambah admin baru
2. Hapus admin
3. Lihat daftar admin
4. Isi saldo admin
5. Kelola admin utama`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ Tambah Admin', callback_data: 'addadmin' }],
                [{ text: '➖ Hapus Admin', callback_data: 'deladmin' }],
                [{ text: '💳 Isi Saldo', callback_data: 'topup_admin' }],
                [{ text: '📋 Daftar Admin', callback_data: 'listadmin' }],
                [{ text: '👑 Admin Utama', callback_data: 'manage_main_admin' }],
                [{ text: '🔙 Kembali', callback_data: 'back_to_start' }]
            ]
        };

        bot.sendMessage(chatId, menuAdmin, { 
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify(keyboard) 
        });
    };

    // Fungsi untuk menampilkan daftar admin untuk pengaturan admin utama
    const showAdminListForMainAdmin = (chatId) => {
        const admins = getAdmins();
        const keyboard = {
            inline_keyboard: [
                ...admins.map((admin, index) => [{
                    text: `${admin.is_main ? '✅ ' : '❌ '} ${admin.name} (${admin.id})`,
                    callback_data: `toggle_main_${index}`
                }]),
                [{ text: '🔙 Kembali', callback_data: 'menu_admin' }]
            ]
        };

        bot.sendMessage(chatId, 'Pilih admin untuk dijadikan/singkirkan sebagai admin utama:', {
            reply_markup: JSON.stringify(keyboard)
        });
    };

    // Fungsi untuk toggle status admin utama
    const toggleMainAdmin = (adminIndex) => {
        const admins = getAdmins();
        
        // Jika admin ini akan dijadikan utama, reset semua status utama lainnya
        if (!admins[adminIndex].is_main) {
            admins.forEach(admin => {
                admin.is_main = false;
            });
        }
        
        // Toggle status admin yang dipilih
        admins[adminIndex].is_main = !admins[adminIndex].is_main;
        saveAdmins(admins);
        
        return admins[adminIndex];
    };

    // Fungsi untuk menampilkan daftar admin untuk topup
    const showAdminListForTopup = (chatId) => {
        const admins = getAdmins();
        const keyboard = {
            inline_keyboard: [
                ...admins.map((admin, index) => [{
                    text: `${admin.name} (Saldo: ${admin.saldo || 0}) ${admin.is_main ? '👑' : ''}`,
                    callback_data: `select_admin_${index}`
                }]),
                [{ text: '🔙 Kembali', callback_data: 'menu_admin' }]
            ]
        };

        bot.sendMessage(chatId, 'Pilih admin untuk topup:', {
            reply_markup: JSON.stringify(keyboard)
        });
    };

    // Fungsi untuk mengirim notifikasi topup
    const sendTopupNotifications = async ({ admin, amount, chatId, msg }) => {
        try {
            // Kirim notifikasi ke admin penerima topup
            await bot.sendMessage(
                admin.id,
                `💳 Anda menerima topup ${amount}\n` +
                `Saldo baru: ${admin.saldo}`
            );
        } catch (error) {
            console.log('Gagal mengirim notifikasi ke penerima');
        }

        // Kirim notifikasi ke admin pertama (jika bukan diri sendiri)
        if (firstAdmin && firstAdmin.id !== msg.from.id) {
            try {
                await bot.sendMessage(
                    firstAdmin.id,
                    `📢 NOTIFIKASI TOPUP\n\n` +
                    `Admin pelaksana: ${msg.from.first_name} (ID: ${msg.from.id})\n` +
                    `Penerima: ${admin.name} (ID: ${admin.id})\n` +
                    `Jumlah: ${amount}\n` +
                    `Saldo baru penerima: ${admin.saldo}\n\n` +
                    `Waktu: ${new Date().toLocaleString()}`
                );
            } catch (error) {
                console.error('Gagal mengirim notifikasi ke admin pertama:', error);
                await bot.sendMessage(chatId, '❌ Gagal mengirim notifikasi', {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{
                            text: '🔙 Menu Admin',
                            callback_data: 'menu_admin'
                        }]]
                    })
                });
            }
        }
    };

    // Command handlers
    bot.onText(/\/addadmin/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(msg.from.id)) {
            return bot.sendMessage(chatId, '❌ Akses ditolak: Hanya untuk admin');
        }

        userState[chatId] = { action: 'add_admin' };
        bot.sendMessage(chatId, 'Masukkan ID Telegram admin baru:', {
            reply_markup: JSON.stringify({
                inline_keyboard: [[{ text: '🔙 Batalkan', callback_data: 'menu_admin' }]]
            })
        });
    });

    bot.onText(/\/topup/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(msg.from.id)) {
            return bot.sendMessage(chatId, '❌ Akses ditolak: Hanya untuk admin');
        }
        showAdminListForTopup(chatId);
    });

    // Callback query handler
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;
        const messageId = query.message.message_id;

        if (!isAdmin(userId)) {
            return bot.answerCallbackQuery(query.id, { 
                text: '❌ Akses ditolak', 
                show_alert: true 
            });
        }

        try {
            const admins = getAdmins();
            
            switch (data) {
                case 'addadmin':
                    userState[chatId] = { action: 'add_admin' };
                    await bot.editMessageText('Masukkan ID Telegram admin baru:', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Batalkan', callback_data: 'menu_admin' }]]
                        }
                    });
                    break;

                case 'deladmin':
                    const deleteButtons = admins.map((admin, index) => [{
                        text: `${admin.name} (@${admin.username || 'no-username'}) ${admin.is_main ? '👑' : ''}`,
                        callback_data: `delete_admin_${index}`
                    }]);
                    
                    deleteButtons.push([{ text: '🔙 Kembali', callback_data: 'menu_admin' }]);
                    
                    await bot.editMessageText('🗑️ Pilih admin yang akan dihapus:', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: { inline_keyboard: deleteButtons }
                    });
                    break;

                case 'listadmin':
                    const adminButtons = admins.map(admin => [{
                        text: `${admin.is_main ? '👑 ' : ''}${admin.name} (@${admin.username || 'no-username'})`,
                        callback_data: `admin_detail_${admin.id}`
                    }]);
                    
                    adminButtons.push([{ text: '🔙 Kembali', callback_data: 'menu_admin' }]);
                    
                    await bot.editMessageText('📋 Daftar Admin\nPilih untuk melihat detail:', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: { inline_keyboard: adminButtons }
                    });
                    break;

                case 'manage_main_admin':
                    if (!isMainAdmin(userId)) {
                        return bot.answerCallbackQuery(query.id, {
                            text: 'Hanya admin utama yang bisa mengatur ini',
                            show_alert: true
                        });
                    }
                    showAdminListForMainAdmin(chatId);
                    break;

                case data.match(/^toggle_main_/)?.input:
                    if (!isMainAdmin(userId)) {
                        return bot.answerCallbackQuery(query.id, {
                            text: 'Hanya admin utama yang bisa mengatur ini',
                            show_alert: true
                        });
                    }
                    
                    const toggleIndex = parseInt(data.split('_')[2]);
                    const toggledAdmin = toggleMainAdmin(toggleIndex);
                    
                    await bot.editMessageText(
                        `Status admin utama untuk ${toggledAdmin.name} telah diubah menjadi ${toggledAdmin.is_main ? '✅ Aktif' : '❌ Nonaktif'}`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: {
                                inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'manage_main_admin' }]]
                            }
                        }
                    );
                    break;

                case data.match(/^admin_detail_/)?.input:
                    const adminId = parseInt(data.split('_')[2]);
                    const detailAdmin = admins.find(a => a.id === adminId);
                    
                    if (!detailAdmin) {
                        return bot.answerCallbackQuery(query.id, {
                            text: 'Admin tidak ditemukan',
                            show_alert: true
                        });
                    }
                    
                    const detailText = `
📋 Detail Admin:
Nama: ${detailAdmin.name}
Username: @${detailAdmin.username || 'no-username'}
ID: ${detailAdmin.id}
Status: ${detailAdmin.is_main ? '👑 Admin Utama' : 'Admin Biasa'}
Saldo: ${detailAdmin.saldo || 0}`;
                    
                    await bot.editMessageText(detailText, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ 
                                    text: '💳 Isi Saldo', 
                                    callback_data: `select_admin_${admins.findIndex(a => a.id === adminId)}` 
                                }],
                                isMainAdmin(userId) ? [{
                                    text: detailAdmin.is_main ? '❌ Batalkan Admin Utama' : '👑 Jadikan Admin Utama',
                                    callback_data: `toggle_main_${admins.findIndex(a => a.id === adminId)}`
                                }] : [],
                                [{ 
                                    text: '🗑️ Hapus Admin', 
                                    callback_data: `delete_admin_${admins.findIndex(a => a.id === adminId)}` 
                                }],
                                [{ 
                                    text: '🔙 Kembali', 
                                    callback_data: 'listadmin' 
                                }]
                            ].filter(Boolean) // Hapus array kosong jika ada
                        }
                    });
                    break;

                case 'topup_admin':
                    showAdminListForTopup(chatId);
                    break;

                case data.match(/^delete_admin_/)?.input:
                    const deleteIndex = parseInt(data.split('_')[2]);
                    if (deleteIndex >= 0 && deleteIndex < admins.length) {
                        const deletedAdmin = admins[deleteIndex];
                        
                        // Cek jika admin yang dihapus adalah admin utama
                        if (deletedAdmin.is_main) {
                            return bot.answerCallbackQuery(query.id, {
                                text: 'Tidak bisa menghapus admin utama!',
                                show_alert: true
                            });
                        }
                        
                        admins.splice(deleteIndex, 1);
                        await saveAdmins(admins);
                        
                        await bot.editMessageText(`Admin ${deletedAdmin.name} telah dihapus`, {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: {
                                inline_keyboard: [[{ text: '🔙 Menu Admin', callback_data: 'menu_admin' }]]
                            }
                        });
                    }
                    break;

                case data.match(/^select_admin_/)?.input:
                    const topupIndex = parseInt(data.split('_')[2]);
                    if (topupIndex >= 0 && topupIndex < admins.length) {
                        userState[chatId] = {
                            action: 'topup_admin',
                            adminIndex: topupIndex
                        };
                        
                        await bot.editMessageText(
                            `Masukkan jumlah saldo untuk ${admins[topupIndex].name}:\n\nContoh: 50000`, 
                            {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: {
                                    inline_keyboard: [[{ text: '🔙 Batalkan', callback_data: 'menu_admin' }]]
                                }
                            }
                        );
                    }
                    break;

                case 'menu_admin':
                    showAdminMenu(chatId);
                    break;
            }
            
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Callback error:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '⚠️ Terjadi error',
                show_alert: true
            });
        }
    });

    // Message handler
    bot.on('message', async (msg) => {
        if (msg.text?.startsWith('/')) return;
        
        const chatId = msg.chat.id;
        const text = msg.text;
        const state = userState[chatId];

        if (!state) return;

        try {
            if (state.action === 'add_admin') {
                const newAdminId = parseInt(text);
                if (isNaN(newAdminId)) {
                    return bot.sendMessage(chatId, '❌ ID harus berupa angka', {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_admin' }]]
                        })
                    });
                }

                const admins = getAdmins();
                if (admins.some(a => a.id === newAdminId)) {
                    return bot.sendMessage(chatId, '❌ Admin sudah terdaftar', {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_admin' }]]
                        })
                    });
                }

                try {
                    const userInfo = await bot.getChat(newAdminId);
                    const isFirstAdmin = admins.length === 0;
                    
                    admins.push({
                        id: newAdminId,
                        username: userInfo.username,
                        name: userInfo.first_name || 'No Name',
                        saldo: 0,
                        is_main: isFirstAdmin // Jadikan admin utama jika ini admin pertama
                    });
                    
                    await saveAdmins(admins);
                    
                    bot.sendMessage(chatId, 
                        `✅ Admin baru ditambahkan:\n\n` +
                        `Nama: ${userInfo.first_name}\n` +
                        `Username: @${userInfo.username || 'no-username'}\n` +
                        `ID: ${newAdminId}\n` +
                        `Status: ${isFirstAdmin ? '👑 Admin Utama' : 'Admin Biasa'}`, {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[{ text: '🔙 Menu Admin', callback_data: 'menu_admin' }]]
                        })
                    });
                } catch (error) {
                    bot.sendMessage(chatId, '❌ Gagal mendapatkan info pengguna', {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_admin' }]]
                        })
                    });
                }

            } else if (state.action === 'topup_admin') {
                const amount = parseInt(text.replace(/\D/g, ''));
                if (isNaN(amount)) {
                    return bot.sendMessage(chatId, '❌ Jumlah tidak valid', {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_admin' }]]
                        })
                    });
                }

                const admins = getAdmins();
                const admin = admins[state.adminIndex];
                
                admin.saldo = (admin.saldo || 0) + amount;
                await saveAdmins(admins);

                await sendTopupNotifications({
                    admin,
                    amount,
                    chatId,
                    msg
                });

                await bot.sendMessage(chatId, `✅ Topup ${amount} berhasil untuk ${admin.name}`, {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{ text: '🔙 Menu Admin', callback_data: 'menu_admin' }]]
                    })
                });
            }

            delete userState[chatId];
        } catch (error) {
            console.error('Message handler error:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan', {
                reply_markup: JSON.stringify({
                    inline_keyboard: [[{ text: '🔙 Menu Admin', callback_data: 'menu_admin' }]]
                })
            });
        }
    });

    return {
        showAdminMenu,
        showAdminListForTopup,
        sendTopupNotifications,
        isMainAdmin,
        getAdmins
    };
};