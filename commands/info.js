const { exec } = require('child_process');

// Fungsi untuk melihat member SSH
const viewSSHMembers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} bot-vps-info`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *INFO VPS ${vpsHost}* 📋\n\n` +
                                "```\n" +
                                stdout +
                                "\n```";

        callback(null, formattedOutput);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('info_vps_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Panggil fungsi viewSSHMembers
            viewSSHMembers(server.host, (error, result) => {
                if (error) {
                    bot.sendMessage(chatId, error);
                    return;
                }

                // Tambahkan tombol "Kembali ke Pemilihan Server"
                const keyboard = {
                    inline_keyboard: [
                        [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                        ],
                    ],
                };

                // Kirim pesan dengan tombol
                bot.sendMessage(chatId, result, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                });
            });
        }
    });
};