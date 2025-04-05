const { exec } = require('child_process');

// Fungsi untuk melihat member SSH (async/await)
const viewSSHMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} bot-member-ssh`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member SSH\n${stderr}`);
                return;
            }

            const output = stdout.trim();
            
            // Cek jika daftar kosong
            if (!output) {
                reject('📭 Daftar member SSH kosong');
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                                 "```\n" +
                                 output +
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
            if (data.startsWith('list_member_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, '❌ Server tidak ditemukan');
                    return;
                }

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

                try {
                    // Panggil fungsi viewSSHMembers
                    const result = await viewSSHMembers(server.host);
                    
                    await bot.sendMessage(
                        chatId, 
                        result, 
                        {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        }
                    );

                } catch (error) {
                    // Kirim pesan error dengan tombol kembali
                    await bot.sendMessage(
                        chatId, 
                        error,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        }
                    );
                }
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi');
        }
    });
};