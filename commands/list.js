const showServerList = (bot, chatId, servers) => {
    const keyboard = servers.map((server, index) => [
        {
            text: server.name,
            callback_data: `select_server_${index}`,
        },
    ]);
    keyboard.push([{ text: '🔙 Kembali', callback_data: 'back_to_start' }]);
    
    const message = `
Selamat datang di VPS Manager Bot! 🚀
WENDIVPN STORE
Daftar Harga
Server SG Perbulan/10k 2 Devices
Server SG Perbulan/15k STB
Server ID Perbulan/15k 2 Devices
Server ID Perbulan/20k STB
Note: SG=Singapore & ID=Indonesia
by @WENDIVPN
Pilih server:`;

    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
};

module.exports = (bot, servers) => {
    // Perintah /listserver
    bot.onText(/\/menu/, (msg) => {
        const chatId = msg.chat.id;
        showServerList(bot, chatId, servers);
    });

    // Tangani callback query (ketika server dipilih)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;

        if (data.startsWith('select_server_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Tampilkan menu tombol untuk server yang dipilih
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: ' SSH', callback_data: `ssh_${serverIndex}` },
                    ],
                    [
                        { text: ' V2RAY', callback_data: `v2ray_${serverIndex}` },
                    ],
                    [
                        { text: 'Setting', callback_data: `Setting_${serverIndex}` },
                    ],
                    [
                        { text: '🔙 Kembali', callback_data: 'list_servers' },
                    ],
                ],
            };
            const message = `
📋 Keterangan Server yang Dipilih:
- Nama: ${server.name}
- Host: ${server.host}
- Domain: ${server.domain}
by @WENDIVPN
`;
            await bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
            });
        } else if (data.startsWith('ssh_')) {
            const serverIndex = data.split('_')[1];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Hapus pesan lama
            await bot.deleteMessage(chatId, messageId);

            // Tampilkan sub menu SSH
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: 'Create SSH', callback_data: `create_ssh_${serverIndex}` },
                        { text: 'Trial SSH', callback_data: `trial_ssh_${serverIndex}` },
                    ],
                    [
                        { text: 'Delete SSH', callback_data: `delete_ssh_${serverIndex}` },
                        { text: 'List SSH', callback_data: `list_member_${serverIndex}` },
                    ],
                    [
                        { text: 'Renew SSH', callback_data: `renew_ssh_${serverIndex}` },
                        { text: 'Detail SSH', callback_data: `detail_ssh_${serverIndex}` },
                    ],
                    [
                        { text: 'Lock SSH', callback_data: `lock_ssh_${serverIndex}` },
                        { text: 'Unlock SSH', callback_data: `unlock_ssh_${serverIndex}` },
                    ],              
                    [
                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                    ],
                ],
            };
            
            const message = `
📋 Keterangan Server yang Dipilih:
- Nama: ${server.name}
- Host: ${server.host}
- Domain: ${server.domain}
by @WENDIVPN
`;
            await bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
            });
        } else if (data === 'list_servers') {
            // Hapus pesan lama
            await bot.deleteMessage(chatId, messageId);
            showServerList(bot, chatId, servers);
        }
    });
};


   