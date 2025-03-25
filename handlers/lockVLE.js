const { exec } = require('child_process');

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

// Fungsi untuk mengunci akun VLESS di VPS
const lockVLE = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} lock-vl`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dikunci.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('vle_lock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            //     return;
            // }
          const listResult = await viewVLEMembers(server.host);
            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username VLESS yang ingin dikunci:');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const username = msg.text;

                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                // Periksa apakah username ada di /etc/xray/config.json
                checkUsernameExists(server.host, username, (exists) => {
                    if (!exists) {
                        // Jika username tidak ditemukan
                        bot.sendMessage(chatId, `❌ User \`${username}\` tidak ada.`);
                        return;
                    }

                    // Jika username ditemukan, lanjutkan proses mengunci
                    lockVLE(server.host, username, (result) => {
                        // Tambahkan tombol "Kembali ke Menu Server"
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                ],
                            ],
                        };

                        // Kirim pesan hasil penguncian dengan tombol
                        bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        });
                    });
                });
            });
        }
    });
};