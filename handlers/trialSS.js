const { Client } = require('ssh2');
const fs = require('fs');

// Fungsi untuk membuat Shadowsocks Trial
const createShadowsocksTrial = async (vpsHost, username, domain, privateKeyPath) => {
    const conn = new Client();

    // Baca file private key dari path
    let privateKey;
    try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8'); // Baca file private key
    } catch (error) {
        console.error('Error reading private key file:', error.message);
        throw new Error('❌ Gagal membaca file private key.');
    }

    // Konfigurasi SSH
    const sshConfig = {
        host: vpsHost, // Host server
        port: 22, // Port SSH (default: 22)
        username: 'root', // Username SSH
        privateKey: privateKey, // Private key yang dibaca dari file
    };

    // Perintah yang akan dijalankan di server (dengan batasan trial)
    const command = `createshadowsocks ${username} 1 1 1`; // 1GB quota, 1 IP limit, 1 day active period

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            console.log('SSH connection established');
            // Jalankan perintah di server
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
                    console.log('Command executed with code:', code);
                    console.log('Output:', data);

                    // Tutup koneksi SSH
                    conn.end();

                    // Parse output dari server
                    try {
                        const ssData = JSON.parse(data); // Asumsikan output adalah JSON
                        ssData.domain = domain; // Tambahkan domain ke data Shadowsocks
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

        // Hubungkan ke server
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

// Fungsi untuk menghasilkan username dengan format ShadowPrem(angka random)
const generateShadowsocksUsername = () => {
    const randomNumber = Math.floor(Math.random() * 1000) + 1; // Angka random antara 1 dan 1000
    return `ShadowPrem${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('ss_trial_')) {
            const serverIndex = data.split('_')[2]; // Ambil serverIndex dari callback data
            const server = servers[serverIndex]; // Ambil server berdasarkan serverIndex

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            const domain = server.domain; // Ambil domain dari server
            const privateKeyPath = server.privateKey; // Ambil path ke private key dari server

            // Generate username secara otomatis
            const username = generateShadowsocksUsername();

            try {
                // Panggil fungsi createShadowsocksTrial
                const ssData = await createShadowsocksTrial(server.host, username, domain, privateKeyPath);

                // Hasilkan pesan Shadowsocks Trial
                const message = generateShadowsocksTrialMessage(ssData);

                // Tambahkan tombol "Kembali ke Pemilihan Server"
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                        ],
                    ],
                };

                // Kirim pesan dengan tombol
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