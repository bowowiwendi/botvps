const { exec } = require('child_process');

// Fungsi untuk renew SSH di VPS
const renewSSH = (vpsHost, username, exp, callback) => {
    const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renewssh`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil direnew \`${exp}\` Hari.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('renew_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input username dan masa aktif dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username dan masa aktif (dalam hari) yang ingin direnew (format: username masa_aktif):');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const input = msg.text.split(' ');
                const [username, exp] = input;

                if (!username || !exp || isNaN(exp)) {
                    await bot.sendMessage(chatId, 'Format input salah. Silakan masukkan username dan masa aktif (dalam hari).');
                    return;
                }

                // Panggil fungsi renewSSH
                renewSSH(server.host, username, exp, (result) => {
                    // Tambahkan tombol "Kembali ke Menu Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Kirim pesan hasil renew dengan tombol
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};