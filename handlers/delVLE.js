const { exec } = require('child_process');

// Fungsi untuk melihat daftar member VLESS
const viewVLEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
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

            const formattedOutput = `📋 *DAFTAR MEMBER VLESS* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";

            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa username
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(false);
        } else {
            callback(true);
        }
    });
};

// Fungsi untuk menghapus VLESS
const deleteVLE = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} delvless`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal menghapus user \`${username}\`: ${stderr}`);
        } else {
            callback(`✅ User \`${username}\` berhasil dihapus.`);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data.startsWith('vle_delete_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];

                // Validasi server
                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan daftar member VLESS
                try {
                    const listResult = await viewVLEMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    console.error('Error:', error);
                    await bot.sendMessage(chatId, 'Gagal mendapatkan daftar member VLESS.');
                }

                // Minta input username
                await bot.sendMessage(chatId, 'Masukkan username VLESS yang ingin dihapus:');

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const username = msg.text;
                    const serverIndex = data.split('_')[2];
                    const server = servers[serverIndex];

                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Periksa dan hapus user
                    checkUsernameExists(server.host, username, async (exists) => {
                        if (!exists) {
                            await bot.sendMessage(
                                chatId, 
                                `❌ User \`${username}\` tidak ada.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard
                                }
                            );
                            return;
                        }

                        deleteVLE(server.host, username, (result) => {
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