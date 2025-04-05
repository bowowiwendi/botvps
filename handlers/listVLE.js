const { exec } = require('child_process');

// Fungsi untuk melihat member VLESS (async/await)
const viewVLEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('❌ VPS host tidak valid');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#&" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
                return;
            }

            const output = stdout.trim();
            
            // Cek jika daftar kosong
            if (!output) {
                reject('📭 Daftar member VLESS kosong');
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER VLESS* 📋\n\n` +
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
            if (data.startsWith('vle_list_')) {
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
                    // Panggil fungsi viewVLEMembers
                    const result = await viewVLEMembers(server.host);
                    
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