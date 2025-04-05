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

// Fungsi untuk membuat VLESS Trial
const createVlessTrial = async (vpsHost, username, domain, privateKeyPath) => {
    const conn = new Client();
    let privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const sshConfig = {
        host: vpsHost,
        port: 22,
        username: 'root',
        privateKey: privateKey,
    };

    // 1GB quota, 1 IP limit, 1 day active period
    const command = `createvless ${username} 1 1 1`;

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
                        const vlessData = JSON.parse(data);
                        vlessData.domain = domain;
                        resolve(vlessData);
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

// Fungsi untuk menghasilkan pesan VLESS Trial
const generateVlessTrialMessage = (vlessData) => {
    return `
🌟 *AKUN VLE TRIAL* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${vlessData.username}\`
│ *Domain*   : \`${vlessData.domain}\`
│ *Port TLS* : \`443\`
│ *Port HTTP*: \`80\`
│ *Security* : \`None\`
│ *Network*  : \`Websocket (WS)\`
│ *Path*     : \`/vless\`
│ *Path GRPC*: \`vless-grpc\`
└─────────────────────
🔐 *URL VLE TLS*
\`\`\`
${vlessData.vless_tls_link}
\`\`\`
🔓 *URL VLE HTTP*
\`\`\`
${vlessData.vless_nontls_link}
\`\`\`
🔒 *URL VLE GRPC*
\`\`\`
${vlessData.vless_grpc_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${vlessData.expired}\` (1 Hari)
│ Quota: \`1 GB\`
│ Limit: \`1 IP\`
└─────────────────────
Save Account Link: [Save Account](https://${vlessData.domain}:81/vless-${vlessData.username}.txt)
✨ Selamat mencoba layanan kami! ✨
    `;
};

// Generate username dengan format VlessPrem(angka random)
const generateVlessUsername = () => {
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    return `VlessPrem${randomNumber}`;
};

// Fungsi untuk membuat keyboard kembali
const createBackKeyboard = (serverIndex) => {
    return {
        inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }]
        ]
    };
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const from = query.from;

        if (data.startsWith('vle_trial_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];
            const backKeyboard = createBackKeyboard(serverIndex);

            // Dapatkan data admin
            const admins = getAdmins();
            const isMainAdmin = admins.some(a => a.id === from.id && a.is_main);

            // Jika bukan admin utama, cek trial limit
            if (!isMainAdmin) {
                if (!checkTrialLimit(from.id)) {
                    return await bot.sendMessage(chatId, 
                        '❌ Anda sudah mencapai batas trial mingguan (3 trial per minggu).',
                        { reply_markup: backKeyboard }
                    );
                }
            }

            const domain = server.domain;
            const privateKeyPath = server.privateKey;
            const username = generateVlessUsername();

            try {
                // Buat akun trial
                const vlessData = await createVlessTrial(server.host, username, domain, privateKeyPath);

                // Catat trial jika bukan admin utama
                if (!isMainAdmin) {
                    recordTrial(from.id, username, server.name);
                }

                // Hasilkan pesan
                const message = generateVlessTrialMessage(vlessData);
                
                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: backKeyboard,
                });

            } catch (error) {
                await bot.sendMessage(chatId, error, {
                    reply_markup: backKeyboard
                });
            }
        }
    });
};