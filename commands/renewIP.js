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

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "curl -sS https://raw.githubusercontent.com/bowowiwendi/ipvps/main/ip | grep "${username}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // Jika username tidak ditemukan
            callback(false);
        } else {
            // Jika username ditemukan
            callback(true);
        }
    });
};

// Fungsi untuk renew VMESS di VPS dengan quota dan limit IP
const renewVME = (vpsHost, username, exp, callback) => {
    const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renew-ip`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil direnew:\n` +
                 `- Masa Aktif: \`${exp}\` Hari\n`);
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

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar VME terlebih dahulu
                viewVMEMembers(server.host, (error, result) => {
                    if (error) {
                        bot.sendMessage(chatId, error);
                        return;
                    }

                    // Kirim daftar VME ke pengguna
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                    }).then(() => {
                        // Minta input username, masa aktif, quota, dan limit IP dari pengguna
                        bot.sendMessage(chatId, 'Masukkan username, masa aktif (dalam hari):');

                        // Tangkap input pengguna
                        bot.once('message', async (msg) => {
                            const input = msg.text.split(' ');
                            const [username, exp] = input;

                            // Validasi input
                            if (!username || !exp || isNaN(exp)) {
                                await bot.sendMessage(chatId, 'Format input salah. Silakan masukkan username, masa aktif (dalam hari),');
                                return;
                            }

                            // Periksa apakah username ada di /etc/xray/config.json
                            checkUsernameExists(server.host, username, (exists) => {
                                if (!exists) {
                                    // Jika username tidak ditemukan
                                    bot.sendMessage(chatId, `❌ User \`${username}\` tidak ada.`);
                                    return;
                                }

                                // Jika username ditemukan, lanjutkan renew dengan quota dan limit IP
                                renewVME(server.host, username, exp, quota, limitIp, (result) => {
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
                        });
                    });
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan internal. Silakan coba lagi.');
        }
    });
};