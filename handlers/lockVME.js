const { exec } = require('child_process');

const viewVMEMembers = (vpsHost, callback) => {
    // Validasi input
    if (!vpsHost || typeof vpsHost !== 'string') {
        callback('Error: VPS host tidak valid.');
        return;
    }

    const command = `ssh root@${vpsHost} 'cat /etc/xray/config.json | grep "^###" | cut -d " " -f 2-3 | sort | uniq | nl'`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER VME* 📋\n\n` +
                              "```\n" +
                              stdout +
                              "\n```";

        callback(null, formattedOutput);
    });
};

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "grep -w '${username}' /etc/xray/config.json"`;

    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback(false);
        } else {
            callback(true);
        }
    });
};

// Fungsi untuk mengunci akun VMESS di VPS
const lockVME = (vpsHost, username, callback) => {
    const command = `ssh root@${vpsHost} "lock-vm '${username}'"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal mengunci user \`${username}\`: ${stderr}`);
        } else {
            callback(`✅ User \`${username}\` berhasil dikunci.`);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('vme_lock_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Tampilkan daftar member terlebih dahulu
            viewVMEMembers(server.host, async (error, result) => {
                if (error) {
                    await bot.sendMessage(chatId, error);
                    return;
                }

                await bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });

                // Minta input username dari pengguna
                await bot.sendMessage(chatId, 'Masukkan username VMESS yang ingin dikunci:');

                // Gunakan ID unik untuk listener
                const listenerId = `vme_lock_${chatId}_${Date.now()}`;
                
                // Tangkap input pengguna
                bot.once(listenerId, async (msg) => {
                    if (msg.chat.id !== chatId) return;

                    const username = msg.text.trim();

                    if (!username) {
                        await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                        return;
                    }

                    // Periksa apakah username ada di /etc/xray/config.json
                    checkUsernameExists(server.host, username, async (exists) => {
                        if (!exists) {
                            await bot.sendMessage(chatId, `❌ User \`${username}\` tidak ditemukan.`, {
                                parse_mode: 'Markdown'
                            });
                            return;
                        }

                        // Jika username ditemukan, lanjutkan proses mengunci
                        lockVME(server.host, username, async (result) => {
                            // Tambahkan tombol "Kembali ke Menu Server"
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                                    ],
                                ],
                            };

                            // Kirim pesan hasil penguncian dengan tombol
                            await bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard,
                            });
                        });
                    });
                });

                // Aktifkan listener
                bot.on('message', (msg) => {
                    if (msg.text && msg.chat.id === chatId && !msg.text.startsWith('/')) {
                        bot.emit(listenerId, msg);
                    }
                });
            });
        }
    });
};