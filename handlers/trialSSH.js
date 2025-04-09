const { exec } = require('child_process');
const fs = require('fs');
const moment = require('moment');

// Fungsi untuk membaca data admin dan trial
const getAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync('./admins.json'));
    } catch (err) {
        return [];
    }
};

const getTrials = () => {
    try {
        return JSON.parse(fs.readFileSync('./trials.json'));
    } catch (err) {
        return [];
    }
};

const saveTrials = (trials) => {
    fs.writeFileSync('./trials.json', JSON.stringify(trials, null, 2));
};

// Fungsi untuk memeriksa trial user
const checkTrialLimit = (userId) => {
    const trials = getTrials();
    const now = moment();
    const userTrials = trials.filter(t => 
        t.userId === userId && 
        moment(t.date).isAfter(now.subtract(7, 'days'))
    );
    
    return userTrials.length < 3; // Batas 3 trial per minggu
};

// Fungsi untuk mencatat trial baru
const recordTrial = (userId, username, serverName) => {
    const trials = getTrials();
    trials.push({
        userId,
        username,
        serverName,
        date: new Date().toISOString()
    });
    saveTrials(trials);
};

// Fungsi untuk membuat SSH Trial
const createSSH = (vpsHost, username, password, limitDevice, activePeriod, domain) => {
    return new Promise((resolve, reject) => {
        const command = `printf "${username}\n${password}\n${limitDevice}\n${activePeriod}" | ssh root@${vpsHost} createssh`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`❌ Gagal membuat akun SSH: ${stderr}`);
                return;
            }

            const sshData = {
                username: username,
                password: password,
                domain: domain,
                expired: `${activePeriod} hari`,
                ip_limit: limitDevice,
            };

            const message = `🌟 *AKUN SSH TRIAL* 🌟\n\n` +
                          `🔹 *Informasi Akun*\n` +
                          generateSSHMessage(sshData);

            resolve(message);
        });
    });
};

// Fungsi untuk menghasilkan pesan SSH
const generateSSHMessage = (sshData) => {
    return `
┌─────────────────────
│ *Username* : \`${sshData.username}\`
│ *Password* : \`${sshData.password}\`
└─────────────────────
┌─────────────────────
│ *Domain*   : \`${sshData.domain}\`
│ *Port TLS* : \`443\`
│ *Port HTTP*: \`80\`
│ *OpenSSH*  : \`22\`
│ *UdpSSH*   : \`1-65535\`
│ *DNS*      : \`443, 53, 22\`
│ *Dropbear* : \`443, 109\`
│ *SSH WS*   : \`80\`
│ *SSH SSL WS*: \`443\`
│ *SSL/TLS*  : \`443\`
│ *OVPN SSL* : \`443\`
│ *OVPN TCP* : \`1194\`
│ *OVPN UDP* : \`2200\`
│ *BadVPN UDP*: \`7100, 7300, 7300\`
└─────────────────────
\`${sshData.domain}:80@${sshData.username}:${sshData.password} \`
\`${sshData.domain}:443@${sshData.username}:${sshData.password} \`
\`${sshData.domain}:22@${sshData.username}:${sshData.password} \`
\`${sshData.domain}:1-65535@${sshData.username}:${sshData.password} \`
WSS Payload      : 
\`\`\`
GET wss://BUG.COM/ HTTP/1.1
Host: ${sshData.domain}
Upgrade: websocket
\`\`\`
┌─────────────────────
│ Expires: \`${sshData.expired}\`
│ IP Limit: \`${sshData.ip_limit}\`
└─────────────────────
OpenVPN Link     : [Download OpenVPN](https://${sshData.domain}:81/allovpn.zip)
Save Account Link: [Save Account](https://${sshData.domain}:81/ssh-${sshData.username}.txt)
✨ Selamat mencoba layanan kami! ✨
    `;
};

// Generate username dengan format "PremiumXXXXX" (5 digit angka acak)
const generatePremiumUsername = () => {
    const randomNumber = Math.floor(Math.random() * 90000) + 10000;
    return `Premium${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('trial_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // Dapatkan data admin
            const admins = getAdmins();
            const isMainAdmin = admins.some(a => a.id === from.id && a.is_main);

            // Jika bukan admin utama, cek trial limit
            if (!isMainAdmin) {
                if (!checkTrialLimit(from.id)) {
                    const keyboard = {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                        ],
                    };
                    
                    return await bot.sendMessage(chatId, 
                        '❌ Anda sudah mencapai batas trial mingguan (3 trial per minggu).', {
                        reply_markup: keyboard
                    });
                }
            }

            // Generate akun trial
            const username = generatePremiumUsername();
            const password = "123"; // Password default
            const limitDevice = "1"; // Limit 1 device
            const activePeriod = "1"; // Masa aktif 1 hari
            const domain = server.domain;

            try {
                // Buat akun trial
                const result = await createSSH(server.host, username, password, limitDevice, activePeriod, domain);

                // Catat trial jika bukan admin utama
                if (!isMainAdmin) {
                    recordTrial(from.id, username, server.name);
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
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                    ],
                };
                
                await bot.sendMessage(chatId, error, {
                    reply_markup: keyboard
                });
            }
        }
    });
};