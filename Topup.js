const fs = require('fs');
const path = require('path');

// Default values
let topupConfig = {
  qrImagePath: './Assets/topup.jpg',
  caption: `📌 **INSTRUKSI TOPUP SALDO**\n\n` +
           `1. Scan QR code di atas untuk pembayaran\n` +
           `2. Setelah transfer, klik tombol di bawah untuk mengirim bukti pembayaran\n` +
           `3. Saldo akan diproses dalam 1x24 jam\n` +
           `PILIHAN LAIN BISA MENGUNAKAN NOMOR \nDANA/GOPAY 083153170199 ATAS NAMA LAURA××`
};

// Load config if exists
if (fs.existsSync('./topup_config.json')) {
  topupConfig = JSON.parse(fs.readFileSync('./topup_config.json', 'utf8'));
}

// Save config
const saveConfig = () => {
  fs.writeFileSync('./topup_config.json', JSON.stringify(topupConfig, null, 2));
};

module.exports = (bot) => {
  // Callback handler untuk topup saldo
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
    const isAdmin = admins.some(admin => admin.id === chatId);

    if (data === 'topup_saldo') {
      try {
        await bot.sendPhoto(chatId, topupConfig.qrImagePath, {
          caption: topupConfig.caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📤 Kirim Bukti Pembayaran', callback_data: 'send_payment_proof' }],
              // ...(isAdmin ? [
              //   [{ text: '⚙️ Edit QR & Caption (Admin)', callback_data: 'edit_topup_config' }]
              // ] : []),
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
                                `Silakan verifikasi pembayaran ini /topup.`);

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
    

    if (data === 'edit_topup_config') {
      const keyboard = {
        inline_keyboard: [
          [{ text: '🖼 Ganti QR Code', callback_data: 'change_qr_code' }],
          [{ text: '✏️ Edit Caption', callback_data: 'edit_topup_caption' }],
          [{ text: '🔙 Kembali', callback_data: 'topup_saldo' }]
        ]
      };

      await bot.sendMessage(chatId, '⚙️ **Menu Admin - Pengaturan Topup**\nPilih opsi yang ingin diubah:', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }

    if (data === 'change_qr_code') {
      await bot.sendMessage(chatId, '🖼 Silakan kirim gambar QR code baru:', {
        reply_markup: { force_reply: true }
      });

      // Simpan state
      userState[chatId] = { action: 'waiting_for_qr_update' };
    }

    if (data === 'edit_topup_caption') {
      await bot.sendMessage(chatId, '✏️ Silakan kirim caption baru untuk topup:\n\n*Format Markdown didukung*', {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      });

      // Simpan state
      userState[chatId] = { action: 'waiting_for_caption_update' };
    }
  });

  // Handle photo update
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
    const isAdmin = admins.some(admin => admin.id === chatId);

    if (isAdmin && userState[chatId]?.action === 'waiting_for_qr_update') {
      try {
        // Simpan foto baru
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        topupConfig.qrImagePath = fileId; // Gunakan file_id Telegram
        saveConfig();

        await bot.sendMessage(chatId, '✅ QR code berhasil diperbarui!');
        delete userState[chatId];

        // Tampilkan preview
        await bot.sendPhoto(chatId, fileId, { 
          caption: 'Ini adalah QR code baru Anda:',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Menu', callback_data: 'topup_saldo' }]
            ]
          }
        });
      } catch (error) {
        console.error('Error updating QR:', error);
        await bot.sendMessage(chatId, '❌ Gagal mengupdate QR code.');
      }
    }
  });

  // Handle caption update
  bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
    const isAdmin = admins.some(admin => admin.id === chatId);

    if (isAdmin && userState[chatId]?.action === 'waiting_for_caption_update') {
      try {
        topupConfig.caption = text;
        saveConfig();

        await bot.sendMessage(chatId, '✅ Caption berhasil diperbarui!\n\nPreview:', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Menu', callback_data: 'topup_saldo' }]
            ]
          }
        });

        // Kirim preview dengan QR code
        await bot.sendPhoto(chatId, topupConfig.qrImagePath, {
          caption: topupConfig.caption,
          parse_mode: 'Markdown'
        });

        delete userState[chatId];
      } catch (error) {
        console.error('Error updating caption:', error);
        await bot.sendMessage(chatId, '❌ Gagal mengupdate caption.');
      }
    }
  });
};

// Inisialisasi userState jika belum ada
if (!global.userState) {
  global.userState = {};
}