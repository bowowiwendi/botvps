const { exec } = require('child_process');

// Fungsi untuk sanitasi input username
const sanitizeUsername = (username) => {
    // Hanya izinkan karakter alfanumerik, underscore, dan tanda hubung
    return username.replace(/[^a-zA-Z0-9_-]/g, '');
};

const viewVMEMembers = (vpsHost, callback) => {
    // Validasi input
    if (!vpsHost || typeof vpsHost !== 'string') {
        callback('❌ VPS host tidak valid');
        return;
    }

    const command = `ssh root@${vpsHost} 'cat /etc/xray/config.json | grep "^###" | cut -d " " -f 2-3 | sort | uniq | nl 2>/dev/null'`;

    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback(`❌ Gagal mendapatkan daftar member: ${stderr || 'Tidak ada data'}`);
            return;
        }

        const formattedOutput = `📋 *DAFTAR MEMBER VMESS* 📋\n\n` +
                              "```\n" +
                              stdout.trim() +
                              "\n```";
        callback(null, formattedOutput);
    });
};

// Fungsi untuk memeriksa apakah username ada di /etc/xray/config.json
const checkUsernameExists = (vpsHost, username, callback) => {
    const sanitizedUsername = sanitizeUsername(username);
    const command = `ssh root@${vpsHost} "grep -w '${sanitizedUsername}' /etc/xray/config.json 2>/dev/null"`;

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
    const sanitizedUsername = sanitizeUsername(username);
    const command = `ssh root@${vpsHost} "lock-vm '${sanitizedUsername}'"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal mengunci user \`${sanitizedUsername}\`: ${stderr}`);
        } else {
            callback(`✅ User \`${sanitizedUsername}\` berhasil dikunci`);
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
            
            // Tombol kembali yang konsisten
            const backButton = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                ]
            };

            try {
                // Tampilkan daftar member terlebih dahulu
                await new Promise((resolve, reject) => {
                    viewVMEMembers(server.host, (error, result) => {
                        if (error) {
                            reject(error);
                        } else {
                            bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
                            resolve();
                        }
                    });
                });

                // Minta input username dari pengguna
                await bot.sendMessage(chatId, '🔒 Masukkan username VMESS yang ingin dikunci:', {
                    parse_mode: 'Markdown'
                });

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    if (msg.chat.id !== chatId) return;

                    const username = msg.text.trim();

                    if (!username) {
                        await bot.sendMessage(chatId, '❌ Username tidak boleh kosong', {
                            reply_markup: backButton,
                            parse_mode: 'Markdown'
                        });
                        return;
                    }

                    // Periksa apakah username ada di /etc/xray/config.json
                    await new Promise((resolve) => {
                        checkUsernameExists(server.host, username, async (exists) => {
                            if (!exists) {
                                await bot.sendMessage(chatId, 
                                    `❌ User \`${sanitizeUsername(username)}\` tidak ditemukan`, 
                                    {
                                        parse_mode: 'Markdown',
                                        reply_markup: backButton
                                    }
                                );
                                return resolve();
                            }

                            // Jika username ditemukan, lanjutkan proses mengunci
                            lockVME(server.host, username, async (result) => {
                                await bot.sendMessage(chatId, result, {
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton
                                });
                                resolve();
                            });
                        });
                    });
                });
            } catch (error) {
                await bot.sendMessage(chatId, error, {
                    reply_markup: backButton,
                    parse_mode: 'Markdown'
                });
            }
        }
    });
};