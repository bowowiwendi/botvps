const { exec } = require('child_process');

// Fungsi untuk melihat member SSH
const viewVLEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        // Validasi input
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('Error: VPS host tidak valid.');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#&" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${stderr}`);
                return;
            }

            // Format hasil menjadi lebih menarik
            const formattedOutput = `📋 *DAFTAR MEMBER VLE* 📋\n\n` +
                                    "```\n" +
                                    stdout +
                                    "\n```";

            resolve(formattedOutput);
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('vle_list_')) {
                const serverIndex = data.split('_')[2];

                // Validasi serverIndex
                if (isNaN(serverIndex) || serverIndex < 0 || serverIndex >= servers.length) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                const server = servers[serverIndex];

                // Panggil fungsi viewVLEMembers
                const result = await viewVLEMembers(server.host);

                // Tambahkan tombol "Kembali ke Pemilihan Server"
                const keyboard = {
                    inline_keyboard: [
                        [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                        ],
                    ],
                };

                // Kirim pesan dengan tombol
                await bot.sendMessage(chatId, result, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};