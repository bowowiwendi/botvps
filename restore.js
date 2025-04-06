const fs = require('fs');
const path = require('path');
const https = require('https'); // Menggunakan modul https bawaan Node.js

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

// Fungsi utama untuk handle restore
async function handleRestore(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Verifikasi admin
    const admins = readAdmins();
    const isAdmin = admins.some(admin => admin.id === userId);
    if (!isAdmin) {
        return bot.sendMessage(chatId, 'Anda tidak memiliki izin untuk melakukan ini.');
    }

    // Cek apakah ada dokumen yang dilampirkan
    if (!msg.reply_to_message || !msg.reply_to_message.document) {
        return bot.sendMessage(chatId, 'Silakan reply pesan ini ke file backup yang ingin direstore.\nContoh: /restore [reply ke file backup]');
    }

    const file = msg.reply_to_message.document;
    
    // Validasi file backup
    if (!file.file_name.includes('backup') || 
        (!file.file_name.includes('admins') && !file.file_name.includes('servers'))) {
        return bot.sendMessage(chatId, 'File tidak valid. Harap gunakan file backup yang benar.');
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
    
    bot.sendMessage(chatId, `Anda yakin ingin merestore data dari file ${file.file_name}?`, {
        reply_markup: keyboard
    });
}

async function performRestore(bot, fileId, userId, originalChatId) {
    try {
        const fileInfo = await bot.getFile(fileId);
        
        // Menentukan jenis file
        const fileType = fileInfo.file_path.includes('admins') ? 'admins' : 
                         fileInfo.file_path.includes('servers') ? 'servers' : null;
        
        if (!fileType) {
            return { success: false, message: 'File backup tidak valid.' };
        }

        // Membuat URL file
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
        
        // Mengunduh file menggunakan https
        const fileContent = await downloadFile(fileUrl);

        // Validasi JSON
        try {
            JSON.parse(fileContent);
        } catch (e) {
            return { success: false, message: 'File backup tidak valid (format JSON salah).' };
        }

        // Backup file saat ini sebelum ditimpa
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `${fileType}-pre-restore-${timestamp}.json`;
        if (fs.existsSync(`${fileType}.json`)) {
            fs.copyFileSync(`${fileType}.json`, backupFilename);
        }

        // Menulis file baru
        fs.writeFileSync(`${fileType}.json`, fileContent);

        return { 
            success: true, 
            message: `✅ Data ${fileType} berhasil direstore dari backup.`,
            details: `File asli telah dibackup sebagai ${backupFilename}`
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

    // Handle callback query
    bot.on('callback_query', async (query) => {
        if (query.data.startsWith('confirm_restore_')) {
            const fileId = query.data.split('_')[2];
            const chatId = query.message.chat.id;
            const userId = query.from.id;
            
            try {
                const result = await performRestore(bot, fileId, userId, chatId);
                
                bot.sendMessage(chatId, result.message);
                if (result.details) {
                    bot.sendMessage(chatId, result.details);
                }
                
                if (result.error) {
                    console.error('Error Restore:', result.error);
                }
                
                // Edit pesan asli
                bot.editMessageText(`Proses restore untuk file telah selesai.`, {
                    chat_id: chatId,
                    message_id: query.message.message_id
                });
            } catch (error) {
                console.error('Error proses restore:', error);
                bot.sendMessage(chatId, 'Terjadi kesalahan sistem saat memproses file.');
                bot.editMessageText('Restore gagal karena error sistem.', {
                    chat_id: chatId,
                    message_id: query.message.message_id
                });
            }
        }
        
        if (query.data === 'cancel_restore') {
            const chatId = query.message.chat.id;
            bot.editMessageText('Restore dibatalkan.', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        }
    });
};