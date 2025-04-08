const fs = require('fs');
const path = require('path');
const https = require('https');

// Fungsi utilitas
const readAdmins = () => {
    const adminsPath = path.join(__dirname, 'admins.json');
    try {
        return fs.existsSync(adminsPath) ? JSON.parse(fs.readFileSync(adminsPath, 'utf8')) : [];
    } catch (error) {
        console.error('Error membaca admins:', error);
        return [];
    }
};

const downloadFile = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
};

const getMainAdmin = () => readAdmins()[0] || null;

// Fungsi untuk menampilkan menu restore
const showRestoreMenu = (bot, chatId) => {
    bot.sendMessage(chatId, '🔄 *Restore Data*\nPilih opsi:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📤 Upload Backup', callback_data: 'upload_backup' }],
                [{ text: '❌ Batal', callback_data: 'cancel_restore' }]
            ]
        }
    });
};

// Handler utama untuk /restore
const handleRestore = (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!readAdmins().some(admin => admin.id === userId)) {
        return bot.sendMessage(chatId, '⛔ Akses ditolak.');
    }
    showRestoreMenu(bot, chatId);
};

// Proses file backup
const processBackupFile = (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!readAdmins().some(admin => admin.id === userId)) {
        return bot.sendMessage(chatId, '⛔ Akses ditolak.');
    }

    const file = msg.document;
    if (!file || !file.file_name.includes('backup') || 
        (!file.file_name.includes('admins') && !file.file_name.includes('servers'))) {
        return bot.sendMessage(chatId, '❌ File tidak valid. Nama harus mengandung "backup" dan "admins" atau "servers".');
    }

    bot.sendMessage(chatId, `⚠️ *Konfirmasi*\nRestore dari \`${file.file_name}\`?`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Ya', callback_data: `confirm_restore_${file.file_id}` }],
                [{ text: '❌ Batal', callback_data: 'cancel_restore' }]
            ]
        }
    });
};

// Melakukan restore
const performRestore = async (bot, fileId, userId, chatId) => {
    try {
        const fileInfo = await bot.getFile(fileId);
        const fileType = fileInfo.file_path.includes('admins') ? 'admins' : 
                         fileInfo.file_path.includes('servers') ? 'servers' : null;
        if (!fileType) throw new Error('File tidak valid');

        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
        const fileContent = await downloadFile(fileUrl);
        const parsedData = JSON.parse(fileContent);
        if (!Array.isArray(parsedData)) throw new Error('Struktur data tidak valid');

        const mainAdmin = getMainAdmin();
        const filePath = path.join(__dirname, `${fileType}.json`);
        if (fs.existsSync(filePath) && mainAdmin) {
            const currentData = fs.readFileSync(filePath, 'utf8');
            await bot.sendDocument(mainAdmin.id, Buffer.from(currentData), {}, {
                filename: `${fileType}-backup-before-restore.json`,
                contentType: 'application/json'
            });
            await bot.sendMessage(mainAdmin.id, 
                `⚠️ *Backup Before Restore*\nFile ${fileType}.json diganti.\nOleh: ${userId}\nChat: ${chatId}`,
                { parse_mode: 'Markdown' }
            );
        }

        fs.writeFileSync(filePath, JSON.stringify(parsedData, null, 2));
        return { success: true, message: `✅ ${fileType} berhasil direstore.`, fileType };
    } catch (error) {
        console.error('Gagal restore:', error);
        return { success: false, message: `❌ Gagal restore: ${error.message}` };
    }
};

// Ekspor modul
module.exports = (bot) => {
    bot.onText(/\/restore/, (msg) => handleRestore(bot, msg));

    bot.on('message', (msg) => {
        if (msg.document && msg.reply_to_message?.text?.includes('Upload Backup')) {
            processBackupFile(bot, msg);
        }
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const messageId = query.message.message_id;

        try {
            if (query.data === 'upload_backup') {
                await bot.answerCallbackQuery(query.id);
                await bot.sendMessage(chatId, '📤 Upload file backup Anda.', { reply_markup: { force_reply: true } });
            } else if (query.data.startsWith('confirm_restore_')) {
                await bot.answerCallbackQuery(query.id, { text: 'Memproses...' });
                const fileId = query.data.split('_')[2];
                const result = await performRestore(bot, fileId, userId, chatId);

                await bot.sendMessage(chatId, result.message);
                await bot.editMessageText(result.success ? `✅ *Restore ${result.fileType} Selesai*` : '❌ Restore Gagal', {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            } else if (query.data === 'cancel_restore') {
                await bot.answerCallbackQuery(query.id, { text: 'Dibatalkan' });
                await bot.editMessageText('❌ Restore dibatalkan', { chat_id: chatId, message_id: messageId });
            }
        } catch (error) {
            console.error('Error callback:', error);
            await bot.answerCallbackQuery(query.id, { text: 'Terjadi kesalahan' });
            await bot.sendMessage(chatId, '⚠️ Kesalahan sistem.');
        }
    });
};