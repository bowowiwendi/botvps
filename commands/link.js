const { exec } = require('child_process');

// Fungsi untuk melihat member SSH dengan parameter iptanggal
const viewSSHMembers = (vpsHost, iptanggal, callback) => {
    if (!iptanggal || typeof iptanggal !== 'string') {
        callback('Error: iptanggal harus berupa string yang valid');
        return;
    }

    // Validasi format IP-YYYY-MM-DD
    const ipDateRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{4}-\d{2}-\d{2}$/;
    if (!ipDateRegex.test(iptanggal)) {
        callback('Error: Format iptanggal harus IP-YYYY-MM-DD (contoh: 123.123.123.123-2025-03-30)');
        return;
    }

    // Escape karakter khusus dalam iptanggal untuk keamanan
    const escapedIptanggal = iptanggal.replace(/'/g, "'\\''");
    const command = `printf "${escapedIptanggal}" | ssh root@${vpsHost} bot-link.sh`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr || error.message}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *LINK BACKUP* 📋\n\n` +
                              "```\n" +
                              stdout +
                              "\n```";

        callback(null, formattedOutput);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('gen_link_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }

            // Minta input iptanggal dari pengguna dengan format yang benar
            await bot.sendMessage(chatId, 'Masukkan IP dan tanggal untuk backup (format: IP-YYYY-MM-DD)\nContoh: 123.123.123.123-2025-03-30');
            
            // Buat listener untuk menangkap balasan pengguna
            const listener = async (msg) => {
                // Hanya tanggapi pesan dari pengguna yang sama di chat yang sama
                if (msg.chat.id === chatId && msg.text) {
                    const input = msg.text.trim();
                    
                    // Validasi format input
                    const ipDateRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{4}-\d{2}-\d{2}$/;
                    if (!ipDateRegex.test(input)) {
                        bot.sendMessage(chatId, 'Format salah! Harap masukkan dengan format: IP-YYYY-MM-DD\nContoh: 123.123.123.123-2025-03-30');
                        return; // Tetap pertahankan listener untuk input ulang
                    }
                    
                    // Hapus listener setelah mendapatkan input yang valid
                    bot.removeListener('message', listener);
                    
                    // Panggil fungsi viewSSHMembers dengan iptanggal
                    viewSSHMembers(server.host, input, (error, result) => {
                        if (error) {
                            bot.sendMessage(chatId, error);
                            return;
                        }

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
                }
            };

            // Pasang listener untuk menunggu balasan pengguna
            bot.on('message', listener);
            
            // Set timeout untuk menghapus listener jika tidak ada respon
            setTimeout(() => {
                bot.removeListener('message', listener);
                bot.sendMessage(chatId, 'Waktu input telah habis. Silakan coba lagi.');
            }, 60000); // Timeout setelah 60 detik
        }
    });
};