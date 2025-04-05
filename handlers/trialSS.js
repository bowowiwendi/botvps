const { Client } = require('ssh2');
const fs = require('fs');
const moment = require('moment');

// Fungsi untuk membaca data admin
const getAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync('./admins.json'));
    } catch (err) {
        return [];
    }
};

// Fungsi untuk membaca dan menyimpan data trial
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
    const admins = getAdmins();
    const isMainAdmin = admins.some(a => a.id === userId && a.is_main);
    if (isMainAdmin) return true; // Admin utama tidak dibatasi

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

// Fungsi untuk membuat Shadowsocks Trial
const createShadowsocksTrial = (vpsHost, username, domain, privateKeyPath) => {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        // Baca file private key
        let privateKey;
        try {
            privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        } catch (error) {
            return reject('❌ Gagal membaca file private key.');
        }

        const sshConfig = {
            host: vpsHost,
            port: 22,
            username: 'root',
            privateKey: privateKey,
        };

        const command = `createshadowsocks ${username} 1 1 1`;

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject('❌ Gagal menjalankan perintah di server.');
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });

                stream.on('close', () => {
                    conn.end();
                    try {
                        const ssData = JSON.parse(data);
                        ssData.domain = domain;
                        ssData.expired = "1 hari"; // Masa aktif 1 hari
                        ssData.ip_limit = "1"; // Limit 1 device
                        resolve(ssData);
                    } catch (error) {
                        reject('❌ Gagal memproses output dari server.');
                    }
                });
            });
        });

        conn.on('error', (err) => {
            reject('❌ Gagal terhubung ke server.');
        });

        conn.connect(sshConfig);
    });
};

// Fungsi untuk menghasilkan pesan Shadowsocks
const generateShadowsocksMessage = (ssData) => {
    return `
🌟 *AKUN SHADOWSOCKS TRIAL* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${ssData.username}\`
│ *Password* : \`${ssData.password}\`
└─────────────────────
┌─────────────────────
│ *Domain*   : \`${ssData.domain}\`
│ *Port*     : \`${ssData.port}\`
│ *Method*   : \`${ssData.method}\`
│ *Protocol* : \`${ssData.protocol}\`
│ *OBFS*     : \`${ssData.obfs}\`
└─────────────────────
🔐 *SHADOWSOCKS URL*
\`\`\`
${ssData.ss_link}
\`\`\`
Save Account Link: [Save Account](https://${ssData.domain}:81/shadowsocks-${ssData.username}.txt)
───────────────────────
┌─────────────────────
│ Expires: \`${ssData.expired}\`
│ IP Limit: \`${ssData.ip_limit}\`
└─────────────────────
    `;
};

// Generate username Shadowsocks
const generateShadowsocksUsername = () => {
    const randomNumber = Math.floor(Math.random() * 90000) + 10000;
    return `Shadow${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('ss_trial_')) {
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
                        reply_markup: keyboard,
                        parse_mode: 'Markdown'
                    });
                }
            }

            // Generate akun trial
            const username = generateShadowsocksUsername();
            const domain = server.domain;

            try {
                // Buat akun trial
                const ssData = await createShadowsocksTrial(server.host, username, domain, server.privateKey);

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

                await bot.sendMessage(chatId, generateShadowsocksMessage(ssData), {
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
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
    });
};