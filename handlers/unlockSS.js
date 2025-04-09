const { exec } = require('child_process');

// Fungsi untuk sanitasi input username
const sanitizeUsername = (username) => {
    // Hanya izinkan karakter alfanumerik, underscore, dan tanda hubung
    return username.replace(/[^a-zA-Z0-9_-]/g, '');
};

// Fungsi untuk mendapatkan daftar akun Shadowsocks yang terkunci
const getLockedAccounts = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} "cat /etc/xray/.lock.db 2>/dev/null | grep '^#!!' | cut -d ' ' -f 2-3 | sort | uniq | nl"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            callback([], stderr || 'Tidak ada akun terkunci atau terjadi kesalahan');
        } else {
            callback(stdout.trim().split('\n'));
        }
    });
};

// Fungsi untuk memeriksa apakah username Shadowsocks terkunci
const checkUserLocked = (vpsHost, username, callback) => {
    const sanitizedUsername = sanitizeUsername(username);
    const command = `ssh root@${vpsHost} "grep -w '${sanitizedUsername}' /etc/xray/.lock.db 2>/dev/null"`;
    
    exec(command, (error, stdout) => {
        callback(!error && stdout.trim() !== '');
    });
};

// Fungsi untuk membuka kunci akun Shadowsocks
const unlockSS = (vpsHost, username, callback) => {
    const sanitizedUsername = sanitizeUsername(username);
    const command = `printf "${sanitizedUsername}" | ssh root@${vpsHost} unlock-ss`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`❌ Gagal membuka kunci: ${stderr}`);
        } else {
            callback(`✅ User \`${sanitizedUsername}\` berhasil dibuka`);
        }
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const serverIndex = data.split('_')[2];
        const server = servers[serverIndex];

        if (data.startsWith('ss_unlock_')) {
            // Tombol kembali yang konsisten
            const backButton = {
                inline_keyboard: [
                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
                ]
            };

            // Langkah 1: Tampilkan daftar akun terkunci terlebih dahulu
            getLockedAccounts(server.host, async (accounts, error) => {
                if (error || accounts.length === 0) {
                    await bot.sendMessage(chatId, error || '🔓 Tidak ada akun Shadowsocks yang terkunci', {
                        reply_markup: backButton,
                        parse_mode: 'Markdown'
                    });
                    return;
                }

                // Kirim daftar akun terkunci sebagai pesan terpisah
                await bot.sendMessage(chatId, 
                    `📋 *Daftar Akun Shadowsocks Terkunci:*\n\n\`\`\`\n${accounts.join('\n')}\n\`\`\``,
                    { parse_mode: 'Markdown' }
                );

                // Langkah 2: Minta input username
                await bot.sendMessage(chatId, 
                    '🔓 Masukkan username Shadowsocks yang ingin dibuka:',
                    { parse_mode: 'Markdown' }
                );

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

                    // Langkah 3: Verifikasi akun terkunci
                    checkUserLocked(server.host, username, async (isLocked) => {
                        if (!isLocked) {
                            await bot.sendMessage(chatId, 
                                `❌ User \`${sanitizeUsername(username)}\` tidak ditemukan dalam daftar terkunci`, 
                                { 
                                    parse_mode: 'Markdown',
                                    reply_markup: backButton 
                                }
                            );
                            return;
                        }

                        // Langkah 4: Proses membuka kunci
                        unlockSS(server.host, username, async (result) => {
                            await bot.sendMessage(chatId, result, {
                                parse_mode: 'Markdown',
                                reply_markup: backButton
                            });
                        });
                    });
                });
            });
        }
    });
};