const { exec } = require('child_process');

// Simplified function to reboot server
const rebootServer = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} reboot`;

    exec(command, (error) => {
        if (error) {
            callback(`❌ Gagal me-reboot server ${vpsHost}`);
            return;
        }
        callback(null, `🔄 Server ${vpsHost} sedang direboot...`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('reboot_')) {
            const serverIndex = data.split('_')[1];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, '❌ Server tidak ditemukan');
                return;
            }

            rebootServer(server.host, (error, result) => {
                const message = error || result;
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                    ]
                };

                bot.sendMessage(chatId, message, { reply_markup: keyboard });
            });
        }
    });
};