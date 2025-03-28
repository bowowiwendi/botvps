const fs = require('fs');

module.exports = (bot) => {
    // Callback handler untuk topup saldo
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
        const mainAdminId = admins[0].id; // Ambil ID admin pertama

        if (data === 'topup_saldo') {
            try {
                // 1. Kirim gambar QR code
                const qrImagePath = './Assets/topup.jpg';
                await bot.sendPhoto(chatId, qrImagePath, {
                    caption: '📌 **INSTRUKSI TOPUP SALDO**\n\n' +
                             '1. Scan QR code di atas untuk pembayaran\n' +
                             '2. Setelah transfer, klik tombol di bawah untuk mengirim bukti pembayaran\n' +
                             '3. Saldo akan diproses dalam 1x24 jam\n' +
                             'PILIHAN LAIN BISA MENGUNAKAN NOMOR DANA/GOPAY 083153170199',
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📤 Kirim Bukti Pembayaran', callback_data: 'send_payment_proof' }],
                            [{ text: '🔙 Kembali', callback_data: 'list_servers' }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error sending QR code:', error);
                await bot.sendMessage(chatId, '❌ Gagal mengirim QR code. Silakan coba lagi.');
            }
        }

        if (data === 'send_payment_proof') {
            try {
                // Minta user mengirim bukti pembayaran
                const requestMsg = await bot.sendMessage(chatId, '📎 Silakan upload bukti pembayaran (foto/screenshot) dan kirim sebagai reply pesan ini.', {
                    reply_markup: {
                        force_reply: true
                    }
                });

                // Membuat listener khusus untuk balasan ini
                const replyListenerId = bot.onReplyToMessage(chatId, requestMsg.message_id, async (msg) => {
                    // Hapus listener setelah digunakan untuk menghindari duplikasi
                    bot.removeReplyListener(replyListenerId);

                    if (msg.photo || msg.document) {
                        try {
                            // Kirim notifikasi ke admin
                            await bot.sendMessage(mainAdminId, `⚠️ **BUKTI PEMBAYARAN BARU**\n\n` +
                                `👤 User: @${msg.from.username || 'N/A'}\n` +
                                `🆔 ID: ${msg.from.id}\n` +
                                `📅 Tanggal: ${new Date().toLocaleString()}\n\n` +
                                `Silakan verifikasi pembayaran ini.`);

                            // Forward media ke admin
                            if (msg.photo) {
                                // Ambil photo dengan kualitas tertinggi (elemen terakhir dalam array)
                                await bot.sendPhoto(mainAdminId, msg.photo[msg.photo.length - 1].file_id);
                            } else {
                                await bot.sendDocument(mainAdminId, msg.document.file_id);
                            }

                            // Konfirmasi ke user
                            await bot.sendMessage(chatId, '✅ Bukti pembayaran telah diterima. Admin akan memproses dalam 1x24 jam.', {
                                reply_markup: { remove_keyboard: true }
                            });

                        } catch (error) {
                            console.error('Error forwarding proof:', error);
                            await bot.sendMessage(chatId, '❌ Gagal mengirim bukti. Silakan hubungi admin.');
                        }
                    } else {
                        await bot.sendMessage(chatId, '❌ Format tidak valid. Harap kirim foto/screenshot bukti transfer.');
                    }
                });

                // Set timeout untuk menghapus listener jika tidak ada respon dalam waktu tertentu
                setTimeout(() => {
                    bot.removeReplyListener(replyListenerId);
                }, 60000); // 60 detik timeout

            } catch (error) {
                console.error('Error in payment proof flow:', error);
                await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
            }
        }
    });
};