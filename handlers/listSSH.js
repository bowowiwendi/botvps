const { exec } = require('child_process');

// Fungsi untuk melihat member SSH
const viewSSHMembers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} bot-member-ssh`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal mengambil daftar member SSH. Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                              "```\n" +
                              stdout.trim() +  // trim() untuk menghapus whitespace berlebih
                              "\n```";

        callback(null, formattedOutput);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('list_member_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, '❌ Server tidak ditemukan.');
                return;
            }

            // Panggil fungsi viewSSHMembers
            viewSSHMembers(server.host, async (error, result) => {
                // Tambahkan tombol "Kembali ke Pemilihan Server"
                const keyboard = {
                    inline_keyboard: [
                        [
                            { 
                                text: '🔙 Kembali', 
                                callback_data: `select_server_${serverIndex}` 
                            },
                        ],
                    ],
                };

                // Kirim pesan dengan tombol
                await bot.sendMessage(chatId, result, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                });
            });
        }
    });
};