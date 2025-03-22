const { Client } = require('ssh2');
const fs = require('fs');

// Fungsi untuk membuat Shadowsocks
const createShadowsocks = async (vpsHost, username, quota, ipLimit, activePeriod, domain, privateKeyPath) => {
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

    // Perintah yang akan dijalankan di server
    const command = `createshadowsocks ${username} ${quota} ${ipLimit} ${activePeriod}`;

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

// Fungsi untuk menghasilkan pesan Shadowsocks
const generateShadowsocksMessage = (ssData) => {
    return `
🌟 *AKUN SHADOW PREMIUM* 🌟

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
✨ Selamat menggunakan layanan kami! ✨
    `;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('ss_create_')) {
            const serverIndex = data.split('_')[2]; // Ambil serverIndex dari callback data
            const server = servers[serverIndex]; // Ambil server berdasarkan serverIndex

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            const domain = server.domain; // Ambil domain dari server
            const privateKeyPath = server.privateKey; // Ambil path ke private key dari server

            // Minta input dari pengguna
            await bot.sendMessage(chatId, 'Masukkan detail Shadow (format: username quota ip_limit masa_aktif):');

            // Tangkap input pengguna
            const messageHandler = async (msg) => {
                // Hapus listener setelah digunakan
                bot.removeListener('message', messageHandler);

                const input = msg.text.split(' ');
                const [username, quota, ipLimit, activePeriod] = input;

                // Validasi input
                if (!username || !quota || !ipLimit || !activePeriod) {
                    await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                    return;
                }

                try {
                    // Panggil fungsi createShadowsocks
                    const ssData = await createShadowsocks(server.host, username, quota, ipLimit, activePeriod, domain, privateKeyPath);

                    // Hasilkan pesan Shadowsocks
                    const message = generateShadowsocksMessage(ssData);

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
            };

            // Gunakan listener sekali pakai
            bot.once('message', messageHandler);
        }
    });
};