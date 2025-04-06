const fs = require('fs');
const path = require('path');

// Backup configuration
let backupConfig = {
    autoBackupEnabled: false,
    lastBackupTime: null,
    backupInterval: 12 * 60 * 60 * 1000 // 12 hours in milliseconds
};

// Load backup config if exists
try {
    const configData = fs.readFileSync('backupConfig.json', 'utf8');
    backupConfig = {...backupConfig, ...JSON.parse(configData)};
} catch (error) {
    console.log('No backup config found, using defaults');
}

// Save backup config
function saveBackupConfig() {
    fs.writeFileSync('backupConfig.json', JSON.stringify(backupConfig, null, 2));
}

// Function to perform actual backup
async function performBackup(bot, userId = null) {
    try {
        const mainAdmin = getMainAdmin();
        if (!mainAdmin) {
            return { success: false, message: 'Admin utama tidak ditemukan.' };
        }

        // Read files to backup
        const adminsData = fs.readFileSync('admins.json', 'utf8');
        const serversData = fs.readFileSync('servers.json', 'utf8');
        
        // Create timestamped filenames
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const adminsFilename = `admins-backup-${timestamp}.json`;
        const serversFilename = `servers-backup-${timestamp}.json`;
        
        // Send files to main admin
        await bot.sendDocument(mainAdmin.id, Buffer.from(adminsData), {}, {
            filename: adminsFilename,
            contentType: 'application/json'
        });
        
        await bot.sendDocument(mainAdmin.id, Buffer.from(serversData), {}, {
            filename: serversFilename,
            contentType: 'application/json'
        });
        
        // Update last backup time
        backupConfig.lastBackupTime = new Date().toISOString();
        saveBackupConfig();
        
        return { 
            success: true, 
            message: '✅ Backup data telah dikirim ke admin utama.',
            notifyMainAdmin: `📦 Backup data ${userId ? 'manual' : 'otomatis'} diterima (${new Date().toLocaleString()})`
        };
    } catch (error) {
        console.error('Backup failed:', error);
        return { success: false, message: '❌ Gagal melakukan backup. Silakan coba lagi.' };
    }
}

// Auto-backup scheduler
let backupIntervalId = null;
let messageHandlers = new Map();

function cleanupMessageHandlers(bot) {
    messageHandlers.forEach((handler, chatId) => {
        bot.removeListener('message', handler);
        messageHandlers.delete(chatId);
    });
}

function setupAutoBackup(bot) {
    // Clear existing interval if any
    if (backupIntervalId) {
        clearInterval(backupIntervalId);
        backupIntervalId = null;
    }

    // Setup new interval if auto-backup is enabled
    if (backupConfig.autoBackupEnabled) {
        // Calculate time until next backup (either noon or midnight)
        const now = new Date();
        const hours = now.getHours();
        let nextBackup;
        
        if (hours < 12) {
            nextBackup = new Date(now);
            nextBackup.setHours(12, 0, 0, 0);
        } else {
            nextBackup = new Date(now);
            nextBackup.setDate(nextBackup.getDate() + 1);
            nextBackup.setHours(0, 0, 0, 0);
        }
        
        const initialDelay = nextBackup - now;
        
        setTimeout(() => {
            performBackup(bot).then(result => {
                if (result.success && result.notifyMainAdmin) {
                    const mainAdmin = getMainAdmin();
                    if (mainAdmin) {
                        bot.sendMessage(mainAdmin.id, result.notifyMainAdmin);
                    }
                }
            });
            
            backupIntervalId = setInterval(() => {
                performBackup(bot).then(result => {
                    if (result.success && result.notifyMainAdmin) {
                        const mainAdmin = getMainAdmin();
                        if (mainAdmin) {
                            bot.sendMessage(mainAdmin.id, result.notifyMainAdmin);
                        }
                    }
                });
            }, backupConfig.backupInterval);
        }, initialDelay);
    }
}

// Main module
module.exports = (bot) => {
    // Setup auto-backup on startup
    setupAutoBackup(bot);

    // Handle callback queries
    bot.on('callback_query', async (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const messageId = query.message.message_id;

        // Verify admin
        const admins = readAdmins();
        const isAdmin = admins.some(admin => admin.id === userId);
        if (!isAdmin) {
            return bot.answerCallbackQuery(query.id, { 
                text: 'Anda tidak memiliki izin untuk melakukan ini.', 
                show_alert: true 
            });
        }

        // Cleanup previous handlers
        cleanupMessageHandlers(bot);

        switch (data) {
            case 'backup_menu':
                showBackupMenu(bot, chatId);
                break;
                
            case 'backup_now':
                handleBackupNow(bot, chatId, userId, messageId);
                break;
                
            case 'toggle_autobackup':
                toggleAutoBackup(bot, chatId, messageId);
                break;
                
            case 'backup_status':
                showBackupStatus(bot, chatId);
                break;
                
            case 'confirm_backup':
                handleConfirmBackup(bot, chatId, userId);
                break;
                
            case 'cancel_backup':
                bot.sendMessage(chatId, 'Backup dibatalkan.');
                break;
        }
    });

    // Handle /backup command
    bot.onText(/\/backup/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        // Verify admin
        const admins = readAdmins();
        const isAdmin = admins.some(admin => admin.id === userId);
        
        if (!isAdmin) {
            return bot.sendMessage(chatId, 'Anda tidak memiliki izin untuk melakukan ini.');
        }
        
        showBackupMenu(bot, chatId);
    });
};

// Show main backup menu
function showBackupMenu(bot, chatId) {
    const autoBackupStatus = backupConfig.autoBackupEnabled ? '🟢 AKTIF' : '🔴 MATI';
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📦 Kirim Sekarang', callback_data: 'backup_now' },
                { text: `⏱ Auto Backup: ${autoBackupStatus}`, callback_data: 'toggle_autobackup' }
            ],
            [
                { text: 'ℹ Status Backup', callback_data: 'backup_status' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '📂 *Menu Backup Data*\n\nPilih opsi yang tersedia:', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Handle immediate backup request
function handleBackupNow(bot, chatId, userId) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Ya,', callback_data: 'confirm_backup' },
                { text: '❌ Batal', callback_data: 'cancel_backup' }
            ]
        ]
    };

    bot.sendMessage(chatId, 'Anda yakin ingin mengirim backup data sekarang?', {
        reply_markup: keyboard
    });
}

// Handle backup confirmation
async function handleConfirmBackup(bot, chatId, userId) {
    const result = await performBackup(bot, userId);
    bot.sendMessage(chatId, result.message);
    
    if (result.success && result.notifyMainAdmin) {
        const mainAdmin = getMainAdmin();
        if (mainAdmin) {
            bot.sendMessage(mainAdmin.id, result.notifyMainAdmin);
        }
    }
}

// Toggle auto-backup feature
function toggleAutoBackup(bot, chatId, messageId) {
    backupConfig.autoBackupEnabled = !backupConfig.autoBackupEnabled;
    saveBackupConfig();
    
    // Restart scheduler
    setupAutoBackup(bot);
    
    const status = backupConfig.autoBackupEnabled ? 'diaktifkan' : 'dimatikan';
    const autoBackupStatus = backupConfig.autoBackupEnabled ? '🟢 AKTIF' : '🔴 MATI';
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📦 Kirim Sekarang', callback_data: 'backup_now' },
                { text: `⏱ Auto: ${autoBackupStatus}`, callback_data: 'toggle_autobackup' }
            ],
            [
                { text: 'ℹ Status', callback_data: 'backup_status' }
            ]
        ]
    };
    
    bot.editMessageText(
        `📂 *Menu Backup Data*\n\nAuto backup telah ${status}. \n\nBackup otomatis akan dilakukan 2x sehari (12:00 dan 24:00).`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
}

// Show backup status information
function showBackupStatus(bot, chatId) {
    const autoBackupStatus = backupConfig.autoBackupEnabled ? '🟢 AKTIF' : '🔴 MATI';
    const lastBackup = backupConfig.lastBackupTime 
        ? new Date(backupConfig.lastBackupTime).toLocaleString() 
        : 'Belum pernah dilakukan';
    
    const statusMessage = `📊 *Status Backup*\n\n` +
                         `🔘 Auto Backup: ${autoBackupStatus}\n` +
                         `⏰ Jadwal: 2x sehari (12:00 dan 24:00)\n` +
                         `🕒 Backup Terakhir: ${lastBackup}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔙 Kembali ke Menu', callback_data: 'backup_menu' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, statusMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Helper functions
function readAdmins() {
    try {
        return JSON.parse(fs.readFileSync('admins.json', 'utf8'));
    } catch (error) {
        console.error('Gagal membaca file admins.json:', error);
        return [];
    }
}

function getMainAdmin() {
    const admins = readAdmins();
    return admins.find(admin => admin.isMain) || admins[0];
}