const { exec } = require('child_process');

// Fungsi untuk melihat member SSH
const viewVMEMembers = (vpsHost, callback) => {
    // Validasi input
    if (!vpsHost || typeof vpsHost !== 'string') {
        callback('Error: VPS host tidak valid.');
        return;
    }

    const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^###" | cut -d " " -f 2-3 | sort | uniq | nl`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER VME* 📋\n\n` +
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

        try {
            if (data.startsWith('vme_list_')) {
                const serverIndex = data.split('_')[2];

                // Validasi serverIndex
                if (isNaN(serverIndex) || serverIndex < 0 || serverIndex >= servers.length) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                const server = servers[serverIndex];

                // Panggil fungsi viewVMEMembers
                viewVMEMembers(server.host, (error, result) => {
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
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan internal. Silakan coba lagi.');
        }
    });
};