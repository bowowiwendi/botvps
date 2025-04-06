const fs = require('fs');
const path = require('path');
const https = require('https');

// Fungsi untuk membaca data admin
function readAdmins() {
    try {
        const adminsPath = path.join(__dirname, 'admins.json');
        if (fs.existsSync(adminsPath)) {
            const data = fs.readFileSync(adminsPath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error membaca file admin:', error);
        return [];
    }
}

// Fungsi untuk mengunduh file menggunakan https
function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                resolve(data);
            });
            
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Fungsi untuk mendapatkan admin utama (pertama dalam list)
function getMainAdmin() {
    const admins = readAdmins();
    return admins.length > 0 ? admins[0] : null;
}

// Fungsi untuk menampilkan menu restore
function showRestoreMenu(bot, chatId) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📤 Upload File Backup', callback_data: 'upload_backup' }
            ],
            [
                { text: '❌ Batal', callback_data: 'cancel_restore' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '🔄 *Menu Restore Data*\n\nSilakan pilih opsi berikut:', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Fungsi utama untuk handle restore
async function handleRestore(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Verifikasi admin
    const admins = readAdmins();
    const isAdmin = admins.some(admin => admin.id === userId);
    if (!isAdmin) {
        return bot.sendMessage(chatId, '⛔ Anda tidak memiliki izin untuk melakukan ini.');
    }

    showRestoreMenu(bot, chatId);
}

// Fungsi untuk memproses file backup
async function processBackupFile(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Verifikasi admin
    const admins = readAdmins();
    const isAdmin = admins.some(admin => admin.id === userId);
    if (!isAdmin) {
        return bot.sendMessage(chatId, '⛔ Anda tidak memiliki izin untuk melakukan ini.');
    }

    // Cek apakah ada dokumen yang dilampirkan
    if (!msg.document) {
        return bot.sendMessage(chatId, '📄 Silakan lampirkan file backup yang ingin direstore.\n\nFormat nama file harus mengandung:\n- "backup"\n- "admins" atau "servers"');
    }

    const file = msg.document;
    
    // Validasi file backup
    if (!file.file_name.includes('backup') || 
        (!file.file_name.includes('admins') && !file.file_name.includes('servers'))) {
        return bot.sendMessage(chatId, '❌ File tidak valid. Format nama file harus mengandung:\n- "backup"\n- "admins" atau "servers"');
    }

    // Membuat keyboard konfirmasi
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Ya, Restore', callback_data: `confirm_restore_${file.file_id}` },
                { text: '❌ Batal', callback_data: 'cancel_restore' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, `⚠️ *Konfirmasi Restore* \n\nAnda yakin ingin merestore data dari file:\n\`${file.file_name}\`?`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function performRestore(bot, fileId, userId, originalChatId) {
    try {
        const fileInfo = await bot.getFile(fileId);
        const mainAdmin = getMainAdmin();
        
        // Menentukan jenis file
        const fileType = fileInfo.file_path.includes('admins') ? 'admins' : 
                         fileInfo.file_path.includes('servers') ? 'servers' : null;
        
        if (!fileType) {
            return { success: false, message: '❌ File backup tidak valid.' };
        }

        // Membuat URL file
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
        
        // Mengunduh file backup baru
        const fileContent = await downloadFile(fileUrl);

        // Validasi JSON
        let parsedData;
        try {
            parsedData = JSON.parse(fileContent);
        } catch (e) {
            return { success: false, message: '❌ File backup tidak valid (format JSON salah).' };
        }

        // Validasi struktur data
        if (!Array.isArray(parsedData)) {
            return { success: false, message: '❌ Struktur data backup tidak valid (harus berupa array).' };
        }

        // Kirim file asli ke admin sebelum diubah
        if (fs.existsSync(path.join(__dirname, `${fileType}.json`))) {
            const currentFileContent = fs.readFileSync(path.join(__dirname, `${fileType}.json`), 'utf8');
            
            if (mainAdmin) {
                await bot.sendDocument(
                    mainAdmin.id,
                    Buffer.from(currentFileContent),
                    {},
                    {
                        filename: `${fileType}-backup-before-restore.json`,
                        contentType: 'application/json'
                    }
                );
                
                await bot.sendMessage(
                    mainAdmin.id,
                    `⚠️ *Backup Before Restore*\n\nFile ${fileType}.json akan diganti dengan data baru.\n\n` +
                    `Restore dilakukan oleh: ${userId}\n` +
                    `Pada chat: ${originalChatId}`,
                    { parse_mode: 'Markdown' }
                );
            }
        }

        // Menulis file baru
        fs.writeFileSync(
            path.join(__dirname, `${fileType}.json`),
            JSON.stringify(parsedData, null, 2)
        );

        return { 
            success: true, 
            message: `✅ Data ${fileType} berhasil direstore dari backup.`,
            fileType: fileType
        };
    } catch (error) {
        console.error('Gagal melakukan restore:', error);
        return { 
            success: false, 
            message: '❌ Gagal melakukan restore. Silakan coba lagi.',
            error: error.message 
        };
    }
}

module.exports = (bot) => {
    // Handle command /restore
    bot.onText(/\/restore/, (msg) => {
        handleRestore(bot, msg);
    });

    // Handle dokumen yang dikirim setelah memilih upload backup
    bot.on('message', (msg) => {
        if (msg.document && msg.reply_to_message && 
            msg.reply_to_message.text && 
            msg.reply_to_message.text.includes('Upload File Backup')) {
            processBackupFile(bot, msg);
        }
    });

    // Handle callback query
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const messageId = query.message.message_id;

        try {
            // Menu utama restore
            if (query.data === 'upload_backup') {
                await bot.answerCallbackQuery(query.id);
                const reply = await bot.sendMessage(chatId, '📤 Silakan upload file backup Anda sekarang.', {
                    reply_markup: {
                        force_reply: true
                    }
                });
                return;
            }
            
            // Konfirmasi restore
            if (query.data.startsWith('confirm_restore_')) {
                await bot.answerCallbackQuery(query.id, { text: 'Memproses restore...' });
                const fileId = query.data.split('_')[2];
                
                const result = await performRestore(bot, fileId, userId, chatId);
                
                if (result.success) {
                    await bot.sendMessage(chatId, result.message);
                    
                    // Edit pesan asli
                    await bot.editMessageText(`✅ *Restore ${result.fileType} Selesai*`, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    });
                } else {
                    await bot.sendMessage(chatId, result.message);
                    if (result.error) {
                        console.error('Error Restore:', result.error);
                    }
                    
                    await bot.editMessageText(`❌ Restore Gagal`, {
                        chat_id: chatId,
                        message_id: messageId
                    });
                }
                return;
            }
            
            // Batal restore
            if (query.data === 'cancel_restore') {
                await bot.answerCallbackQuery(query.id, { text: 'Restore dibatalkan' });
                await bot.editMessageText('❌ Restore dibatalkan', {
                    chat_id: chatId,
                    message_id: messageId
                });
                return;
            }
            
        } catch (error) {
            console.error('Error callback query:', error);
            await bot.answerCallbackQuery(query.id, { text: 'Terjadi kesalahan sistem' });
            await bot.sendMessage(chatId, '⚠️ Terjadi kesalahan sistem. Silakan coba lagi.');
        }
    });
};