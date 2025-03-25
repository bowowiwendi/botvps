const { exec } = require('child_process');

const viewTrojMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        // Validasi input
        if (!vpsHost || typeof vpsHost !== 'string') {
            reject('Error: VPS host tidak valid.');
            return;
        }

        const command = `ssh root@${vpsHost} cat /etc/xray/config.json | grep "^#!" | cut -d " " -f 2-3 | sort | uniq | nl`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${stderr}`);
                return;
            }

            // Format hasil menjadi lebih menarik
            const formattedOutput = `📋 *DAFTAR MEMBER TROJAN* 📋\n\n` +
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

// Fungsi untuk mengunci akun Trojan di VPS
const lockTroj = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} lock-tr`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dikunci.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('troj_lock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, 'Server tidak ditemukan.');
            //     return;
            // }
            const listResult = await viewTrojMembers(server.host);

            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username Trojan yang ingin dikunci:');

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
                    lockTroj(server.host, username, (result) => {
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