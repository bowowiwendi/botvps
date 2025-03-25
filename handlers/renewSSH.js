const { exec } = require('child_process');

const renewSSH = (vpsHost, username, exp, callback) => {
    const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renewssh`;

    exec(command, (error, stdout, stderr) => {
        callback(error 
            ? `❌ Gagal renew user \`${username}\`. Error: ${stderr}`
            : `✅ User \`${username}\` berhasil direnew \`${exp}\` Hari.`
        );
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const { message, data } = query;
        const chatId = message.chat.id;

        // Handle renew SSH callback
        if (data.startsWith('renew_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            
            if (!server) return await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            
            await bot.sendMessage(chatId, 'Masukkan username dan masa aktif (dalam hari) yang ingin direnew (format: username masa_aktif):');
            
            const onMessage = async (msg) => {
                if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) return;
                
                bot.removeListener('message', onMessage);
                const [username, exp] = msg.text.split(' ');
                
                if (!username || !exp || isNaN(exp)) {
                    return await bot.sendMessage(chatId, 'Format input salah. Contoh: user1 30');
                }
                
                renewSSH(server.host, username, exp, async (result) => {
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };
                    
                    await bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                });
            };
            
            bot.on('message', onMessage);
        }
    });
};