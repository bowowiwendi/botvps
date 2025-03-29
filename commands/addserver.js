const saveServers = require('../utils/saveServers');
const { exec } = require('child_process');

module.exports = (bot, userState, servers) => {
    // Fungsi untuk ssh-copy-id (password tidak disimpan)
    const runSSHCopyId = (host, password, chatId, callback) => {
        const publicKeyPath = '/root/.ssh/id_rsa.pub';
        const command = `sshpass -p "${password}" ssh-copy-id -i ${publicKeyPath} root@${host}`;

        exec(command, (error) => {
            if (error) {
                bot.sendMessage(chatId, `❌ Gagal menyalin kunci SSH. Pastikan:\n1. Password benar\n2. Server aktif\n\nError: ${error.message}`);
                return;
            }
            callback();
        });
    };

    // Perintah /addserver
    bot.onText(/\/addserver/, (msg) => {
        const chatId = msg.chat.id;
        userState[chatId] = { action: 'add_server_step1' };
        bot.sendMessage(chatId, 'Masukkan detail server dalam format:\n\nNama Host Domain\n\nContoh:\nServerBaru 192.168.1.100 example.com');
    });

    // Handler pesan
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text?.trim();

        // Step 1: Terima nama, host, dan domain
        if (userState[chatId]?.action === 'add_server_step1') {
            const details = text.split(' ');
            if (details.length !== 3) {
                bot.sendMessage(chatId, 'Format salah! Gunakan: Nama Host Domain\nContoh: ServerBaru 192.168.1.100 example.com');
                return;
            }

            const [name, host, domain] = details;
            userState[chatId] = {
                action: 'add_server_step2',
                serverDetails: { name, host, domain }
            };

            // Minta password (hanya untuk ssh-copy-id)
            bot.sendMessage(chatId, 'Masukkan password root server (untuk ssh-copy-id, tidak disimpan):');
        }

        // Step 2: Terima password & proses
        else if (userState[chatId]?.action === 'add_server_step2') {
            const password = text;
            const { name, host, domain } = userState[chatId].serverDetails;

            // Simpan server dengan konfigurasi standar + domain
            servers.push({
                name,
                host,
                port: 22,
                username: 'root',
                privateKey: '/root/.ssh/id_rsa',
                domain,  // Ditambahkan
            });
            saveServers(servers);

            // Jalankan ssh-copy-id
            bot.sendMessage(chatId, 'Sedang menyalin kunci SSH...');
            runSSHCopyId(host, password, chatId, () => {
                bot.sendMessage(chatId, `✅ Server "${name}" berhasil ditambahkan!\n\n- Host: ${host}\n- Domain: ${domain}\n- SSH Key: /root/.ssh/id_rsa`);
                delete userState[chatId];
            });
        }
    });
};