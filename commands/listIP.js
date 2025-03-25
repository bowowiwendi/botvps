const { exec } = require('child_process');

// Fungsi untuk melihat daftar member SSH
const viewVMEMembers = (vpsHost, callback) => {
    // Validasi input
    if (!vpsHost || typeof vpsHost !== 'string') {
        callback('Error: VPS host tidak valid.');
        return;
    }

    const command = `ssh root@${vpsHost} curl -sS https://raw.githubusercontent.com/bowowiwendi/ipvps/main/ip | grep '^###' | cut -d ' ' -f 2-4 | sort | uniq | nl`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER AUTOSCRIPT* 📋\n\n` +
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
            if (data.startsWith('list_ip_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar member
                viewVMEMembers(server.host, (error, result) => {
                    if (error) {
                        bot.sendMessage(chatId, error);
                        return;
                    }

                    // Tambahkan tombol "Kembali ke Menu Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Kirim daftar member ke pengguna
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