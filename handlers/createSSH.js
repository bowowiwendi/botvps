const { exec } = require('child_process');

// Fungsi untuk membuat SSH di VPS
const createSSH = (vpsHost, username, password, limitDevice, activePeriod, callback) => {
    const command = `printf "${username}\n${password}\n${limitDevice}\n${activePeriod}" | ssh root@${vpsHost} createssh`;

    exec(command, (error, stdout, stderr) => {
        // Data SSH yang dihasilkan
        const sshData = {
            username: username,
            password: password,
            domain: domain, // Ganti dengan domain yang sesuai
            expired: `${activePeriod} hari`, // Masa aktif SSH
            ip_limit: limitDevice, // Batasan IP
        };

        // Hasilkan pesan dengan format yang diinginkan
        const message = `🌟 *AKUN SSH PREMIUM* 🌟\n\n` +
                        `🔹 *Informasi Akun*\n` +
                        generateSSHMessage(sshData);

        callback(null, message);
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
WSS Payload      : 
\`\`\`
GET wss://BUG.COM/ HTTP/1.1
Host: ${sshData.domain}
Upgrade: websocket
\`\`\`
OpenVPN Link     : [Download OpenVPN](https://${sshData.domain}:81/allovpn.zip)
Save Account Link: [Save Account](https://${sshData.domain}:81/ssh-${sshData.username}.txt)
───────────────────────
┌─────────────────────
│ Expires: \`${sshData.expired}\`
│ IP Limit: \`${sshData.ip_limit}\`
└─────────────────────
    `;
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('create_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input dari pengguna
            await bot.sendMessage(chatId, 'Masukkan detail SSH (format: username password limit_device masa_aktif):');
              
            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const input = msg.text.split(' ');
                const [username, password, limitDevice, activePeriod] = input;

                if (!username || !password || !limitDevice || !activePeriod) {
                    await bot.sendMessage(chatId, 'Format input salah. Silakan coba lagi.');
                    return;
                }
               
                const domain = server.domain;
                // Panggil fungsi createSSH
                createSSH(server.host, username, password, limitDevice, activePeriod, domain, (error, result) => {
                    // Tambahkan tombol "Kembali ke Pemilihan Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Kirim pesan dengan tombol
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};