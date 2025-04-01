const fs = require('fs');

// Load servers data
let servers = [];
try {
    servers = JSON.parse(fs.readFileSync('./servers.json'));
} catch (err) {
    servers = [];
}

// User state management
const userStates = {};

module.exports = (bot) => {
    // Handle /server command
    bot.onText(/\/server/, (msg) => {
        showMainMenu(msg.chat.id);
    });

    // Callback query handler
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const messageId = query.message.message_id;

        if (data === 'server') {
            showMainMenu(chatId);
        } else if (data === 'list') {
            listServers(chatId);
        } else if (data === 'add_server') {
            addServerStep1(chatId);
        } else if (data === 'delete_server') {
            deleteServerStep1(chatId);
        } else if (data === 'edit_server') {
            editServerStep1(chatId);
        } else if (data.startsWith('delete_')) {
            const index = parseInt(data.split('_')[1]);
            deleteServerConfirm(chatId, index);
        } else if (data.startsWith('confirm_delete_')) {
            const index = parseInt(data.split('_')[2]);
            deleteServerFinal(chatId, index);
        } else if (data.startsWith('edit_select_')) {
            const index = parseInt(data.split('_')[2]);
            editServerStep2(chatId, index);
        } else if (data.startsWith('edit_field_')) {
            const parts = data.split('_');
            const index = parseInt(parts[2]);
            const field = parts[3];
            editServerStep3(chatId, index, field);
        } else if (data === 'cancel_operation') {
            cancelOperation(chatId);
        }

        bot.answerCallbackQuery(query.id);
    });

    // Handle all messages
    bot.on('message', (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;
        
        const chatId = msg.chat.id;
        const state = userStates[chatId] || {};
        const text = msg.text;

        // Handle add server process
        if (state.mode === 'add_server') {
            if (state.step === 'name') {
                userStates[chatId].tempServer = { name: text };
                userStates[chatId].step = 'host';
                bot.sendMessage(chatId, '🌐 Masukkan host/ip server:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                        ]
                    }
                });
            } 
            else if (state.step === 'host') {
                userStates[chatId].tempServer.host = text;
                userStates[chatId].step = 'port';
                bot.sendMessage(chatId, '🔌 Masukkan port server (default 22):', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                        ]
                    }
                });
            }
            else if (state.step === 'port') {
                userStates[chatId].tempServer.port = text ? parseInt(text) : 22;
                userStates[chatId].step = 'username';
                bot.sendMessage(chatId, '👤 Masukkan username:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                        ]
                    }
                });
            }
            else if (state.step === 'username') {
                userStates[chatId].tempServer.username = text;
                userStates[chatId].step = 'domain';
                bot.sendMessage(chatId, '🌍 Masukkan domain (opsional, kosongkan jika tidak ada):', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                        ]
                    }
                });
            }
            else if (state.step === 'domain') {
                if (text) userStates[chatId].tempServer.domain = text;
                userStates[chatId].step = 'harga';
                bot.sendMessage(chatId, '💰 Masukkan harga akun (contoh: 100000):', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                        ]
                    }
                });
            }
            else if (state.step === 'harga') {
                userStates[chatId].tempServer.harga = text;
                
                // Save the new server
                servers.push(userStates[chatId].tempServer);
                fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
                
                delete userStates[chatId];
                bot.sendMessage(chatId, '🎉✅ Server berhasil ditambahkan!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                        ]
                    }
                });
            }
        }
        // Handle edit server value
        else if (state.mode === 'edit_server_value') {
            const newValue = text;
            const serverIndex = state.selectedServer;
            const field = state.selectedField;
            
            // Update value
            servers[serverIndex][field] = field === 'port' ? parseInt(newValue) || 22 : newValue;
            
            // Save to file
            fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
            
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ ${field} berhasil diupdate!`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                    ]
                }
            });
        }
    });

    // Main menu
    function showMainMenu(chatId) {
        delete userStates[chatId];
        bot.sendMessage(chatId, '🖥️🤖 Bot Manajemen Server\n\nPilih perintah:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 List Server', callback_data: 'list' }],
                    [{ text: '➕ Tambah Server', callback_data: 'add_server' }],
                    [{ text: '🗑️ Hapus Server', callback_data: 'delete_server' }],
                    [{ text: '✏️ Edit Server', callback_data: 'edit_server' }],
                    [{ text: '🔙 Kembali', callback_data: 'back_to_start' }]
                ]
            }
        });
    }

    // List all servers
    function listServers(chatId) {
        if (servers.length === 0) {
            return bot.sendMessage(chatId, '📭 Daftar Server Kosong', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                    ]
                }
            });
        }

        let message = '📋✨ Daftar Server:\n\n';
        servers.forEach((server, index) => {
            message += `🔹 ${index + 1}. ${server.name}\n`;
            message += `   🌐 Host: ${server.host}\n`;
            message += `   🔌 Port: ${server.port || '22'}\n`;
            message += `   👤 Username: ${server.username}\n`;
            message += `   🌍 Domain: ${server.domain || '-'}\n`;
            message += `   💰 Harga: Rp ${server.harga || '0'}\n\n`;
        });
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                ]
            }
        });
    }

    // Add server - step 1
    function addServerStep1(chatId) {
        userStates[chatId] = {
            mode: 'add_server',
            step: 'name'
        };
        
        bot.sendMessage(chatId, '📛 Masukkan nama server:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                ]
            }
        });
    }

    // Delete server - step 1: select server
    function deleteServerStep1(chatId) {
        if (servers.length === 0) {
            return bot.sendMessage(chatId, '📭 Tidak ada server yang bisa dihapus.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                    ]
                }
            });
        }

        const buttons = servers.map((server, index) => {
            return [{ text: `🗑️ ${index + 1}. ${server.name}`, callback_data: `delete_${index}` }];
        });

        buttons.push([{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]);

        bot.sendMessage(chatId, '🗑️ Pilih server yang ingin dihapus:', {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    // Delete server - confirmation
    function deleteServerConfirm(chatId, index) {
        const server = servers[index];
        bot.sendMessage(chatId, `⚠️ Anda yakin ingin menghapus server "${server.name}"?`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Ya, Hapus', callback_data: `confirm_delete_${index}` },
                        { text: '❌ Tidak', callback_data: 'delete_server' }
                    ],
                    [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                ]
            }
        });
    }

    // Delete server - final step
    function deleteServerFinal(chatId, index) {
        const deletedServer = servers.splice(index, 1)[0];
        fs.writeFileSync('./servers.json', JSON.stringify(servers, null, 2));
        
        bot.sendMessage(chatId, `🎉✅ Server "${deletedServer.name}" berhasil dihapus!`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                ]
            }
        });
    }

    // Edit server - step 1: select server
    function editServerStep1(chatId) {
        if (servers.length === 0) {
            return bot.sendMessage(chatId, '📭 Tidak ada server yang bisa diedit.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                    ]
                }
            });
        }

        const buttons = servers.map((server, index) => {
            return [{ text: `✏️ ${index + 1}. ${server.name}`, callback_data: `edit_select_${index}` }];
        });

        buttons.push([{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]);

        bot.sendMessage(chatId, '✏️ Pilih server yang ingin diedit:', {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    // Edit server - step 2: select field
    function editServerStep2(chatId, index) {
        const server = servers[index];
        userStates[chatId] = {
            mode: 'edit_server_field',
            selectedServer: index
        };
        
        bot.sendMessage(chatId, `✏️ Edit server "${server.name}":\n\nPilih field yang ingin diedit:`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📛 Nama', callback_data: `edit_field_${index}_name` },
                        { text: '🌐 Host', callback_data: `edit_field_${index}_host` }
                    ],
                    [
                        { text: '🔌 Port', callback_data: `edit_field_${index}_port` },
                        { text: '👤 Username', callback_data: `edit_field_${index}_username` }
                    ],
                    [
                        { text: '🌍 Domain', callback_data: `edit_field_${index}_domain` },
                        { text: '💰 Harga', callback_data: `edit_field_${index}_harga` }
                    ],
                    [
                        { text: '🔙 Kembali ke Menu', callback_data: 'server' }
                    ]
                ]
            }
        });
    }

    // Edit server - step 3: enter new value
    function editServerStep3(chatId, index, field) {
        userStates[chatId] = {
            mode: 'edit_server_value',
            selectedServer: index,
            selectedField: field
        };
        
        const fieldNames = {
            name: 'nama',
            host: 'host/ip',
            port: 'port',
            username: 'username',
            domain: 'domain',
            harga: 'harga'
        };
        
        bot.sendMessage(chatId, `✏️ Masukkan nilai baru untuk ${fieldNames[field]}:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Batalkan', callback_data: 'cancel_operation' }]
                ]
            }
        });
    }

    // Cancel operation
    function cancelOperation(chatId) {
        delete userStates[chatId];
        bot.sendMessage(chatId, '❌ Operasi dibatalkan.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Kembali ke Menu', callback_data: 'server' }]
                ]
            }
        });
    }
};