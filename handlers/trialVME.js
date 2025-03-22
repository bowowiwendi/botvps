const { Client } = require('ssh2');
const fs = require('fs');

// Fungsi untuk membuat VMESS Trial
const createVmessTrial = async (vpsHost, username, domain, privateKeyPath) => {
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
    const command = `createvmess ${username} 1 1 1`; // 1GB quota, 1 IP limit, 1 day active period

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
                        const vmessData = JSON.parse(data); // Asumsikan output adalah JSON
                        vmessData.domain = domain; // Tambahkan domain ke data VMESS
                        resolve(vmessData);
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

// Fungsi untuk menghasilkan pesan VMESS Trial
const generateVmessTrialMessage = (vmessData) => {
    return `
🌟 *AKUN VME TRIAL* 🌟

🔹 *Informasi Akun*
┌─────────────────────
│ *Username* : \`${vmessData.username}\`
│ *Domain*   : \`${vmessData.domain}\`
│ *Port TLS* : \`443\`
│ *Port HTTP*: \`80\`
│ *Alter ID* : \`0\`
│ *Security* : \`Auto\`
│ *Network*  : \`Websocket (WS)\`
│ *Path*     : \`/vmess\`
│ *Path GRPC*: \`vmess-grpc\`
└─────────────────────
🔐 *URL VME TLS*
\`\`\`
${vmessData.vmess_tls_link}
\`\`\`
🔓 *URL VME HTTP*
\`\`\`
${vmessData.vmess_nontls_link}
\`\`\`
🔒 *URL VME GRPC*
\`\`\`
${vmessData.vmess_grpc_link}
\`\`\`
┌─────────────────────
│ Expiry: \`${vmessData.expired}\`
│ Quota: \`${vmessData.quota === '0 GB' ? 'Unlimited' : vmessData.quota}\`
│  Limit: \`${vmessData.ip_limit === '0' ? 'Unlimited' : vmessData.ip_limit}\`
└─────────────────────
Save Account Link: [Save Account](https://${vmessData.domain}:81/vmess-${vmessData.username}.txt)
✨ Selamat mencoba layanan kami! ✨
    `;
};

// Fungsi untuk menghasilkan username dengan format VmessPrem(angka random)
const generateVmessUsername = () => {
    const randomNumber = Math.floor(Math.random() * 1000) + 1; // Angka random antara 1 dan 1000
    return `VmessPrem${randomNumber}`;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('vme_trial_')) {
            const serverIndex = data.split('_')[2]; // Ambil serverIndex dari callback data
            const server = servers[serverIndex]; // Ambil server berdasarkan serverIndex

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            const domain = server.domain; // Ambil domain dari server
            const privateKeyPath = server.privateKey; // Ambil path ke private key dari server

            // Generate username secara otomatis
            const username = generateVmessUsername();

            try {
                // Panggil fungsi createVmessTrial
                const vmessData = await createVmessTrial(server.host, username, domain, privateKeyPath);

                // Hasilkan pesan VMESS Trial
                const message = generateVmessTrialMessage(vmessData);

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