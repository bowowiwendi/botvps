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

// Fungsi untuk mengirim laporan ke admin utama
const sendReportToMainAdmin = async (bot, reportData) => {
    const admins = getAdmins();
    if (admins.length === 0) return;

    const mainAdmin = admins[0];
    const reportMessage = `
📢 *Laporan Renew Akun Shadowsocks* 📢

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

// Fungsi untuk melihat daftar member Shadowsocks
const viewSSMembers = async (vpsHost) => {
    return new Promise((resolve, reject) => {
        const command = `ssh root@${vpsHost} "cat /etc/xray/config.json | grep '^#!!' | cut -d ' ' -f 2-3 | sort | uniq | nl"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal mengambil daftar member: ${stderr}`);
                return;
            }

            const formattedOutput = `📋 *DAFTAR MEMBER SHADOWSOCKS* 📋\n\n` +
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

// Fungsi untuk renew Shadowsocks
const renewSS = (vpsHost, username, exp, quota, limitIp) => {
    return new Promise((resolve, reject) => {
        const command = `printf "${username}\n${exp}\n${quota}\n${limitIp}" | ssh root@${vpsHost} renewss`;

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
            if (data.startsWith('ss_renew_')) {
                const serverIndex = data.split('_')[2];
                const server = servers[serverIndex];
                const serverPrice = server.harga; // Menggunakan field harga saja

                // Dapatkan data admin
                const admins = getAdmins();
                const admin = admins.find(a => a.id === from.id);

                if (!admin) {
                    await bot.sendMessage(chatId, '❌ Anda tidak terdaftar sebagai admin!');
                    return;
                }

                // Cek saldo admin
                if ((admin.balance || 0) < serverPrice) {
                    await bot.sendMessage(chatId, 
                        `❌ Saldo Anda tidak mencukupi! 
Harga renew: Rp ${serverPrice.toLocaleString()}
Saldo Anda: Rp ${(admin.balance || 0).toLocaleString()}`);
                    return;
                }

                // Tampilkan daftar Shadowsocks
                try {
                    const listResult = await viewSSMembers(server.host);
                    await bot.sendMessage(chatId, listResult, {
                        parse_mode: 'Markdown'
                    });
                } catch (error) {
                    await bot.sendMessage(chatId, error);
                    return;
                }

                // Minta input renew
                await bot.sendMessage(chatId, 
                    'Masukkan detail renew (format: username masa_aktif quota limit_ip):\n' +
                    `Biaya: Rp ${serverPrice.toLocaleString()}`);

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    const input = msg.text.split(' ');
                    const [username, exp, quota, limitIp] = input;

                    // Validasi input
                    if (!username || !exp || isNaN(exp) || !quota || isNaN(quota) || !limitIp || isNaN(limitIp)) {
                        await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
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
                        const result = await renewSS(server.host, username, exp, quota, limitIp);

                        // Update saldo admin
                        updateAdminBalance(admin.id, -serverPrice);

                        // Kirim laporan ke admin utama
                        await sendReportToMainAdmin(bot, {
                            adminId: admin.id,
                            adminName: `${admin.first_name} ${admin.last_name || ''}`.trim(),
                            serverName: server.name,
                            username: username,
                            price: serverPrice,
                            exp: exp,
                            quota: quota,
                            limitIp: limitIp
                        });

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