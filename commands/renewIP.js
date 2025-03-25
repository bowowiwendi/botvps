const { exec } = require('child_process');

// Fungsi untuk melihat daftar member
const viewIPMembers = (vpsHost, callback) => {
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

        const formattedOutput = `📋 *DAFTAR MEMBER AUTOSCRIPT* 📋\n\n` +
                              "```\n" +
                              stdout +
                              "\n```";

        callback(null, formattedOutput);
    });
};

// Fungsi untuk renew IP
const renewIP = (vpsHost, username, exp, callback) => {
    const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renew-ip`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal memperbarui IP: ${stderr}`);
            return;
        }
        
        callback(`✅ User \`${username}\` berhasil diperbarui:\n` +
                 `- Masa Aktif: \`${exp}\` Hari\n` +
                 `- IP Baru telah diaktifkan`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('renew_ip_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                viewIPMembers(server.host, (error, result) => {
                    if (error) {
                        bot.sendMessage(chatId, error);
                        return;
                    }

                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown'
                    }).then(() => {
                        bot.sendMessage(chatId, 
                            'Masukkan data untuk perbarui IP:\n' +
                            'Format: <username> <masa_aktif_hari>\n' +
                            'Contoh: user1 30');

                        bot.once('message', async (msg) => {
                            const [username, exp] = msg.text.split(' ');
                            
                            if (!username || !exp || isNaN(exp)) {
                                await bot.sendMessage(chatId, 
                                    'Format salah! Gunakan format:\n' +
                                    '<username> <masa_aktif_hari>\n' +
                                    'Contoh: user1 30');
                                return;
                            }

                            renewIP(server.host, username, exp, (result) => {
                                const keyboard = {
                                    inline_keyboard: [
                                        [{ 
                                            text: '🔙 Kembali ke Server', 
                                            callback_data: `select_server_${serverIndex}` 
                                        }],
                                        [{
                                            text: '🔄 Lihat Daftar Member',
                                            callback_data: `renew_ip_${serverIndex}`
                                        }]
                                    ]
                                };

                                bot.sendMessage(chatId, result, {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                });
                            });
                        });
                    });
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 
                'Terjadi kesalahan. Pastikan:\n' +
                '1. Format input benar\n' +
                '2. Server aktif\n' +
                '3. Koneksi stabil');
        }
    });
};