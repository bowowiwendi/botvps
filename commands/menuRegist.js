const showIPSubmenu = (chatId, serverIndex) => {
    return {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '➕ Regist IP', callback_data: `register_ip_${serverIndex}` },
                ],
                [
                    { text: '🔄 Renew IP', callback_data: `renew_ip_${serverIndex}` }
                ],
                [
                    { text: '🗑 Delete IP', callback_data: `delete_ip_${serverIndex}` },
                ],
                [
                    { text: '📋 List IP', callback_data: `list_ip_${serverIndex}` }
                ],
                [
                    { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }
                ]
            ]
        }
    };
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('regist_')) {
                const serverIndex = data.split('_')[1];
                await bot.sendMessage(chatId, '🛠 Regist Autoscript', showIPSubmenu(chatId, serverIndex));
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};