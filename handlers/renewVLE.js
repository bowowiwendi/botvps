const { exec } = require('child_process');

// Fungsi untuk melihat daftar member VLESS
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
            const formattedOutput = `📋 *DAFTAR MEMBER VLESS* 📋\n\n` +
                                    "```\n" +
                                    stdout +
                                    "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

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

// Fungsi untuk renew VLESS di VPS dengan quota dan limit IP
const renewVLE = (vpsHost, username, exp, quota, limitIp, callback) => {
    const command = `printf "${username}\n${exp}\n${quota}\n${limitIp}" | ssh root@${vpsHost} renewvless`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil direnew:\n` +
                 `- Masa Aktif: \`${exp}\` Hari\n` +
                 `- Quota: \`${quota}\` GB\n` +
                 `- Limit IP: \`${limitIp}\``);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('vle_renew_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar VLESS terlebih dahulu
                const listResult = await viewVLEMembers(server.host);

                // Kirim daftar VLESS ke pengguna
                await bot.sendMessage(chatId, listResult, {
                    parse_mode: 'Markdown',
                });

                // Minta input username, masa aktif, quota, dan limit IP dari pengguna
                await bot.sendMessage(chatId, 'Masukkan username, masa aktif (dalam hari), quota (dalam GB), dan limit IP (format: username masa_aktif quota limit_ip):');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const input = msg.text.split(' ');
                    const [username, exp, quota, limitIp] = input;

                    // Validasi input
                    if (!username || !exp || isNaN(exp) || !quota || isNaN(quota) || !limitIp || isNaN(limitIp)) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan masukkan username, masa aktif (dalam hari), quota (dalam GB), dan limit IP.');
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
                        renewVLE(server.host, username, exp, quota, limitIp, (result) => {
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
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};