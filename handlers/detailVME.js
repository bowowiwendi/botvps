const { exec } = require('child_process');

// Fungsi untuk melihat daftar member VMESS (async/await)
const viewVMEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('❌ VPS host tidak valid');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^###" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER VMESS* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk melihat detail VMESS (async/await)
const viewVMEDetails = async (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /var/www/html/vmess-${username}.txt"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil detail VMESS\nPastikan file /var/www/html/vmess-${username}.txt ada`);
                return;
            }

            const formattedOutput = `🔍 *DETAIL VMESS* 🔍\n\n` +
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
            if (data.startsWith('vme_detail_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, '❌ Server tidak ditemukan');
                    return;
                }

                // Tampilkan daftar member VMESS
                try {
                    const listResult = await viewVMEMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    console.error('Error:', error);
                    await bot.sendMessage(chatId, '❌ Gagal mendapatkan daftar member VMESS');
                    return;
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username VMESS untuk melihat detail:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text.trim();
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong');
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
                        // Ambil detail VMESS
                        const detailResult = await viewVMEDetails(server.host, username);
                        
                        await bot.sendMessage(
                            chatId, 
                            detailResult, 
                            {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            }
                        );

                    } catch (error) {
                        console.error('Error:', error);
                        await bot.sendMessage(
                            chatId, 
                            error,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            }
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi');
        }
    });
};