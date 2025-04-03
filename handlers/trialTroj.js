const { Client } = require('ssh2');
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

// Fungsi untuk membuat Trojan Trial
const createTrojanTrial = async (vpsHost, username, domain, privateKeyPath) => {
    const conn = new Client();
    let privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    // 1GB quota, 1 IP limit, 1 day active period
    const command = `createtrojan ${username} 1 1 1`;

    return new Promise((resolve, reject) => {
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
                        const trojanData = JSON.parse(data);
                        trojanData.domain = domain;
                        resolve(trojanData);
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

// Fungsi untuk menghasilkan pesan Trojan Trial
const generateTrojanTrialMessage = (trojanData) => {
    return `
🌟 *AKUN TROJ TRIAL* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${trojanData.username}\`
│ *Domain*   : \`${trojanData.domain}\`
│ *Port TLS* : \`443\`
│ *Password* : \`${trojanData.password}\`
│ *Network*  : \`TCP\`
│ *Path*     : \`/trojan\`
│ *Path GRPC*: \`trojan-grpc\`
└─────────────────────
🔐 *URL TROJ TLS*
\`\`\`
${trojanData.trojan_tls_link}
\`\`\`
🔒 *URL TROJ GRPC*
\`\`\`
${trojanData.trojan_grpc_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${trojanData.expired}\` (1 Hari)
│ Quota: \`1 GB\`
│ Limit: \`1 IP\`
└─────────────────────
Save Account Link: [Save Account](https://${trojanData.domain}:81/trojan-${trojanData.username}.txt)
✨ Selamat mencoba layanan kami! ✨
    `;
};

// Generate username dengan format TrojPrem(angka random)
const generateTrojanUsername = () => {
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    return `TrojPrem${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('troj_trial_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            // if (!server) {
            //     await bot.sendMessage(chatId, '❌ Server tidak ditemukan.');
            //     return;
            // }

            // Dapatkan data admin
            const admins = getAdmins();
            const isMainAdmin = admins.some(a => a.id === from.id && a.is_main);

            // Jika bukan admin utama, cek trial limit
            if (!isMainAdmin) {
                if (!checkTrialLimit(from.id)) {
                    return await bot.sendMessage(chatId, 
                        '❌ Anda sudah mencapai batas trial mingguan (3 trial per minggu).');
                }
            }

            const domain = server.domain;
            const privateKeyPath = server.privateKey;
            const username = generateTrojanUsername();

            try {
                // Buat akun trial
                const trojanData = await createTrojanTrial(server.host, username, domain, privateKeyPath);

                // Catat trial jika bukan admin utama
                if (!isMainAdmin) {
                    recordTrial(from.id, username, server.name);
                }

                // Hasilkan pesan
                const message = generateTrojanTrialMessage(trojanData);
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
                    ],
                };

                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                });

            } catch (error) {
                await bot.sendMessage(chatId, error);
            }
        }
    });
};