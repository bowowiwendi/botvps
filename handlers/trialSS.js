const { Client } = require('ssh2');
const fs = require('fs');
const moment = require('moment');

// Baca file admins.json
let admins = [];
try {
    admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
} catch (error) {
    console.error('Error reading admins file:', error.message);
    // Default admin jika file tidak ada
    admins = [
        {
            "id": 123456789,
            "first_name": "Admin",
            "last_name": "Utama",
            "is_main": true
        }
    ];
}

// Simpan data limit trial dalam memory
const trialLimits = new Map();

// Fungsi untuk memeriksa apakah user adalah admin utama
const isMainAdmin = (userId) => {
    return admins.some(admin => admin.id === userId && admin.is_main === true);
};

// Fungsi untuk memeriksa limit trial pengguna
const checkUserTrialLimit = (userId) => {
    if (isMainAdmin(userId)) {
        return { allowed: true, remaining: 'unlimited' }; // Admin utama tidak dibatasi
    }

    const now = moment();
    const userData = trialLimits.get(userId) || { count: 0, firstRequest: now };

    // Reset counter jika sudah lewat 1 minggu
    if (now.diff(userData.firstRequest, 'days') >= 7) {
        userData.count = 0;
        userData.firstRequest = now;
    }

    if (userData.count >= 3) {
        const nextReset = moment(userData.firstRequest).add(7, 'days');
        const remainingTime = moment.duration(nextReset.diff(now)).humanize();
        return { allowed: false, remaining: remainingTime };
    }

    userData.count += 1;
    trialLimits.set(userId, userData);

    return { allowed: true, remaining: 3 - userData.count };
};

// Fungsi untuk membuat Shadowsocks Trial
const createShadowsocksTrial = async (vpsHost, username, domain, privateKeyPath) => {
    const conn = new Client();

    // Baca file private key dari path
    let privateKey;
    try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    } catch (error) {
        console.error('Error reading private key file:', error.message);
        throw new Error('❌ Gagal membaca file private key.');
    }

    // Konfigurasi SSH
    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    const command = `createshadowsocks ${username} 1 1 1`;

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    console.error('Error executing command:', err.message);
                    conn.end();
                    return reject('❌ Gagal menjalankan perintah di server.');
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });

                stream.on('close', (code) => {
                    conn.end();
                    try {
                        const ssData = JSON.parse(data);
                        ssData.domain = domain;
                        resolve(ssData);
                    } catch (parseError) {
                        console.error('Error parsing server output:', parseError.message);
                        reject('❌ Gagal memproses output dari server.');
                    }
                });
            });
        });

        conn.on('error', (err) => {
            console.error('SSH connection error:', err.message);
            reject('❌ Gagal terhubung ke server.');
        });

        conn.connect(sshConfig);
    });
};

// Fungsi untuk menghasilkan pesan Shadowsocks Trial
const generateShadowsocksTrialMessage = (ssData) => {
    return `
🌟 *AKUN SHADOW TRIAL* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${ssData.username}\`
│ *Domain*   : \`${ssData.domain}\`
│ *Port*     : \`${ssData.port}\`
│ *Password* : \`${ssData.password}\`
│ *Method*   : \`${ssData.method}\`
│ *Protocol* : \`${ssData.protocol}\`
│ *OBFS*     : \`${ssData.obfs}\`
└─────────────────────
🔐 *URL SHADOW*
\`\`\`
${ssData.ss_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${ssData.expired}\`
│ Quota: \`${ssData.quota === '0 GB' ? 'Unlimited' : ssData.quota}\`
│  Limit: \`${ssData.ip_limit === '0' ? 'Unlimited' : ssData.ip_limit}\`
└─────────────────────
Save Account Link: [Save Account](https://${ssData.domain}:81/shadowsocks-${ssData.username}.txt)
✨ Selamat mencoba layanan kami! ✨
    `;
};

const generateShadowsocksUsername = () => {
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    return `ShadowPrem${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        if (data.startsWith('ss_trial_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            const limitCheck = checkUserTrialLimit(userId);
            if (!limitCheck.allowed) {
                await bot.sendMessage(
                    chatId, 
                    `❌ Anda telah mencapai batas maksimal trial (3 kali dalam 1 minggu).\n` +
                    `Anda dapat membuat trial lagi dalam ${limitCheck.remaining}.`
                );
                return;
            }

            const domain = server.domain;
            const privateKeyPath = server.privateKey;
            const username = generateShadowsocksUsername();

            try {
                const ssData = await createShadowsocksTrial(server.host, username, domain, privateKeyPath);
                const message = generateShadowsocksTrialMessage(ssData);
                
                // Tambahkan info sisa trial hanya untuk non-admin
                const remainingMessage = isMainAdmin(userId) 
                    ? '\n✨ Anda adalah admin utama, tidak ada batasan trial.' 
                    : `\nSisa trial yang tersedia: ${limitCheck.remaining} dari 3 kali dalam 1 minggu.`;

                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                        ],
                    ],
                };

                await bot.sendMessage(chatId, message + remainingMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                });
            } catch (error) {
                await bot.sendMessage(chatId, error);
            }
        }
    });
};