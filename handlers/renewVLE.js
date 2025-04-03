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
📢 *Laporan Renew Akun VLESS* 📢

👤 *Admin*: ${reportData.adminName} (ID: ${reportData.adminId})
🖥️ *Server*: ${reportData.serverName}
📛 *Username*: ${reportData.username}
💰 *Harga*: Rp ${reportData.price.toLocaleString()}
📅 *Waktu*: ${new Date().toLocaleString()}
📝 *Detail*:
- Masa Aktif: ${reportData.exp} hari
- Quota: ${reportData.quota} GB
- Limit IP: ${reportData.limitIp}
    `;

    await bot.sendMessage(mainAdmin.id, reportMessage, { parse_mode: 'Markdown' });
};

// Fungsi untuk melihat daftar member VLESS
const viewVLEMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /etc/xray/config.json | grep '^#&' | cut -d ' ' -f 2-3 | sort | uniq | nl"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
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
const checkUsernameExists = (vpsHost, username) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "grep '${username}' /etc/xray/config.json"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

// Fungsi untuk renew VLESS
const renewVLE = (vpsHost, username, exp, quota, limitIp) => {
    return new Promise((resolve, reject) => {
        const command = `printf "${username}\n${exp}\n${quota}\n${limitIp}" | ssh root@${vpsHost} renewvless`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal renew akun: ${stderr}`);
            } else {
                resolve(`✅ User \`${username}\` berhasil direnew:
- Masa Aktif: \`${exp}\` Hari
- Quota: \`${quota}\` GB
- Limit IP: \`${limitIp}\``);
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
            if (data.startsWith('vle_renew_')) {
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

                // Tampilkan daftar VLESS terlebih dahulu
                try {
                    const listResult = await viewVLEMembers(server.host);
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
                        'Masukkan detail renew (format: username masa_aktif quota limit_ip):\n' +
                        'Kosongkan field untuk menggunakan default (contoh: username saja)');
                } else {
                    await bot.sendMessage(chatId, 
                        'Masukkan username renew (format: username):\n' +
                        `Biaya: Rp ${serverPrice.toLocaleString()}\n` +
                        'Default untuk admin biasa: 30 hari, 1000 GB, 2 IP\n' +
                        'Contoh: username 30 1000 2');
                }

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const input = msg.text.split(' ');
                    let [username, exp, quota, limitIp] = input;

                    // Validasi username wajib diisi
                    if (!username) {
                        await bot.sendMessage(chatId, 'Username harus diisi!');
                        return;
                    }

                    // Set default untuk admin biasa
                    if (!isMainAdmin) {
                        exp = exp || '30';
                        quota = quota || '1000';
                        limitIp = limitIp || '2';
                    } else {
                        // Admin utama bisa menentukan sendiri atau kosong untuk default
                        exp = exp || '30';
                        quota = quota || '0'; // 0 biasanya berarti unlimited
                        limitIp = limitIp || '0'; // 0 biasanya berarti unlimited
                    }

                    // Validasi input numerik
                    if (isNaN(exp) || isNaN(quota) || isNaN(limitIp)) {
                        await bot.sendMessage(chatId, 'Masa aktif, quota, dan limit IP harus angka!');
                        return;
                    }

                    try {
                        // Cek username
                        const exists = await checkUsernameExists(server.host, username);
                        if (!exists) {
                            await bot.sendMessage(chatId, `❌ User \`${username}\` tidak ditemukan.`);
                            return;
                        }

                        // Renew akun
                        const result = await renewVLE(server.host, username, exp, quota, limitIp);

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
                                exp: exp,
                                quota: quota,
                                limitIp: limitIp
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