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

// Fungsi untuk renew SSH
const renewSSH = (vpsHost, username, exp) => {
    return new Promise((resolve, reject) => {
        const command = `printf "${username}\n${exp}" | ssh root@${vpsHost} renewssh`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal renew user \`${username}\`. Error: ${stderr}`);
            } else {
                resolve(`✅ User \`${username}\` berhasil direnew \`${exp}\` Hari.`);
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
                const serverPrice = server.harga; // Menggunakan field harga

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

                // Minta input renew
                await bot.sendMessage(chatId, 
                    'Masukkan username dan masa aktif (dalam hari) yang ingin direnew:\n' +
                    'Format: username masa_aktif\n' +
                    `Biaya: Rp ${serverPrice.toLocaleString()}`);

                // Tangkap input pengguna
                bot.once('message', async (msg) => {
                    if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) return;

                    const [username, exp] = msg.text.split(' ');

                    // Validasi input
                    if (!username || !exp || isNaN(exp)) {
                        await bot.sendMessage(chatId, 'Format input salah. Contoh: user1 30');
                        return;
                    }

                    try {
                        // Renew akun
                        const result = await renewSSH(server.host, username, exp);

                        // Update saldo admin
                        updateAdminBalance(admin.id, -serverPrice);

                        // Kirim laporan ke admin utama
                        await sendReportToMainAdmin(bot, {
                            adminId: admin.id,
                            adminName: `${admin.first_name} ${admin.last_name || ''}`.trim(),
                            serverName: server.name,
                            username: username,
                            price: serverPrice,
                            exp: exp
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