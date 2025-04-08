const { exec } = require('child_process');
const fs = require('fs');

// Fungsi untuk membaca data admin
const getAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync('./admins.json'));
    } catch (err) {
        return [];
    }
};

// Fungsi untuk update saldo admin
const updateAdminBalance = (adminId, amount) => {
    const admins = getAdmins();
    const adminIndex = admins.findIndex(a => a.id === adminId);
    
    if (adminIndex !== -1) {
        admins[adminIndex].balance = (admins[adminIndex].balance || 0) + amount;
        fs.writeFileSync('./admins.json', JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
};

const addToMainAdminBalance = (amount) => {
    const admins = getAdmins();
    const mainAdmin = admins.find(a => a.is_main);
    
    if (mainAdmin) {
        mainAdmin.balance = (mainAdmin.balance || 0) + amount;
        fs.writeFileSync('./admins.json', JSON.stringify(admins, null, 2));
        return true;
    }
    return false;
};

// Fungsi untuk mengirim laporan ke admin utama
const sendReportToMainAdmin = async (bot, reportData) => {
    const admins = getAdmins();
    if (admins.length === 0) return;

    const mainAdmin = admins.find(a => a.is_main) || admins[0];
    const reportMessage = `
📢 *Laporan Renew Akun SSH* 📢

👤 *Admin*: ${reportData.adminName} (ID: ${reportData.adminId})
🖥️ *Server*: ${reportData.serverName}
📛 *Username*: ${reportData.username}
💰 *Harga*: Rp ${reportData.price.toLocaleString()}
📅 *Waktu*: ${new Date().toLocaleString()}
📝 *Detail*:
- Masa Aktif: ${reportData.exp} hari
    `;

    await bot.sendMessage(mainAdmin.id, reportMessage, { parse_mode: 'Markdown' });
};

// Fungsi untuk melihat daftar member SSH
const viewSSHMembers = (vpsHost) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /etc/ssh/sshd_config | grep '^###' | cut -d ' ' -f 2-3 | sort | uniq | nl"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                                  "```\n" +
                                  stdout +
                                  "\n```";
            resolve(formattedOutput);
        });
    });
};

// Fungsi untuk memeriksa username SSH
const checkSSHUsernameExists = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "grep '${username}' /etc/ssh/sshd_config"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

// Fungsi untuk renew SSH
const renewSSH = (vpsHost, username, exp) => {
    return new Promise((resolve, reject) => {
        const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renewssh`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal renew akun: ${stderr}`);
            } else {
                resolve(`✅ User \`${username}\` berhasil direnew:
- Masa Aktif: \`${exp}\` Hari`);
            }
        });
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        try {
            if (data.startsWith('renew_ssh_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];
                const serverPrice = server.harga;

                // Dapatkan data admin
                const admins = getAdmins();
                const admin = admins.find(a => a.id === from.id);

                if (!admin) {
                    await bot.sendMessage(chatId, '❌ Anda tidak terdaftar sebagai admin!');
                    return;
                }

                // Cek apakah admin utama (tidak perlu bayar)
                const isMainAdmin = admin.is_main === true;

                // Cek saldo admin (kecuali admin utama)
                if (!isMainAdmin && (admin.balance || 0) < serverPrice) {
                    await bot.sendMessage(chatId, 
                        `❌ Saldo Anda tidak mencukupi! 
Harga renew: Rp ${serverPrice.toLocaleString()}
Saldo Anda: Rp ${(admin.balance || 0).toLocaleString()}`);
                    return;
                }

                // Tampilkan daftar SSH terlebih dahulu
                try {
                    const listResult = await viewSSHMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    await bot.sendMessage(chatId, error);
                    return;
                }

                // Pesan petunjuk berbeda untuk admin utama vs biasa
                if (isMainAdmin) {
                    await bot.sendMessage(chatId, 
                        '🔷 Anda adalah ADMIN UTAMA (tidak dikenakan biaya)\n' +
                        'Masukkan username dan masa aktif (dalam hari):\n' +
                        'Format: username masa_aktif\n' +
                        'Kosongkan masa aktif untuk default 30 hari\n' +
                        'Contoh: user1 30');
                } else {
                    await bot.sendMessage(chatId, 
                        'Masukkan username dan masa aktif (dalam hari):\n' +
                        'Format: username masa_aktif\n' +
                        `Biaya: Rp ${serverPrice.toLocaleString()}\n` +
                        'Default untuk admin biasa: 30 hari\n' +
                        'Contoh: user1 30');
                }

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) return;

                    let [username, exp] = msg.text.split(' ');

                    // Validasi username wajib diisi
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username harus diisi!');
                        return;
                    }

                    // Set default untuk masa aktif jika kosong
                    exp = exp || '30';

                    // Validasi input numerik
                    if (isNaN(exp)) {
                        await bot.sendMessage(chatId, 'Masa aktif harus berupa angka!');
                        return;
                    }

                    try {
                        // Cek username terlebih dahulu
                        const exists = await checkSSHUsernameExists(server.host, username);
                        if (!exists) {
                            const keyboard = {
                                inline_keyboard: [
                                    [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                                ],
                            };
                            await bot.sendMessage(chatId, `❌ User \`${username}\` tidak ditemukan.`, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            });
                            return;
                        }

                        // Renew akun
                        const result = await renewSSH(server.host, username, exp);

                        // Update saldo admin (kecuali admin utama)
                        if (!isMainAdmin) {
                            // Kurangi saldo admin yang membuat
                            updateAdminBalance(admin.id, -serverPrice);
                            // Tambahkan saldo ke admin utama
                            addToMainAdminBalance(serverPrice);
                        }

                        // Kirim laporan ke admin utama (kecuali jika yang renew adalah admin utama)
                        if (!isMainAdmin) {
                            await sendReportToMainAdmin(bot, {
                                adminId: admin.id,
                                adminName: `${admin.first_name} ${admin.last_name || ''}`.trim(),
                                serverName: server.name,
                                username: username,
                                price: isMainAdmin ? 0 : serverPrice,
                                exp: exp
                            });
                        }

                        // Kirim hasil ke user
                        const keyboard = {
                            inline_keyboard: [
                                [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                            ],
                        };

                        await bot.sendMessage(chatId, result, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        });

                    } catch (error) {
                        await bot.sendMessage(chatId, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
        }
    });
};