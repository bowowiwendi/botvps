const fs = require('fs');
const path = require('path');

// Fungsi untuk membaca file admins.json
function readAdmins() {
    try {
        return JSON.parse(fs.readFileSync('admins.json', 'utf8'));
    } catch (error) {
        console.error('Gagal membaca file admins.json:', error);
        return [];
    }
}

// Modul broadcast
module.exports = (bot, users) => {
    // Tangani callback query (tombol inline)
    bot.on('callback_query', async (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const userId = query.from.id;

        if (data === 'start_broadcast') {
            // Minta admin untuk memasukkan pesan atau media
            bot.sendMessage(chatId, 'Silakan masukkan pesan atau media yang ingin Anda broadcast:');

            // Tangani pesan yang dikirim admin
            bot.once('message', async (msg) => {
                const broadcastContent = msg; // Simpan pesan/media

                // Jika pesan berupa media, minta pesan teks tambahan
                if (msg.photo || msg.video || msg.document || msg.audio || msg.sticker) {
                    bot.sendMessage(chatId, 'Anda mengirim media. Jika Anda ingin menambahkan pesan teks, silakan kirim pesan teks sekarang. Jika tidak, broadcast akan dikirim tanpa pesan teks.');

                    // Tunggu pesan teks tambahan selama 10 detik
                    const timeout = 10000; // 10 detik
                    let additionalText = '';

                    const textPromise = new Promise((resolve) => {
                        bot.once('message', (textMsg) => {
                            if (textMsg.text) {
                                additionalText = textMsg.text;
                            }
                            resolve();
                        });
                    });

                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(resolve, timeout);
                    });

                    await Promise.race([textPromise, timeoutPromise]);

                    // Tampilkan pratinjau media dan pesan teks (jika ada)
                    let previewMessage = '📝 *Pratinjau Media dan Pesan Teks:*\n\n';

                    if (msg.photo) {
                        previewMessage += '[Foto]\n';
                    } else if (msg.video) {
                        previewMessage += '[Video]\n';
                    } else if (msg.document) {
                        previewMessage += '[Dokumen]\n';
                    } else if (msg.audio) {
                        previewMessage += '[Audio]\n';
                    } else if (msg.sticker) {
                        previewMessage += '[Stiker]\n';
                    }

                    if (additionalText) {
                        previewMessage += `Pesan Teks: ${additionalText}`;
                    } else {
                        previewMessage += 'Tidak ada pesan teks tambahan.';
                    }

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '✅ Ya, Kirim', callback_data: 'confirm_broadcast' },
                                { text: '❌ Batal', callback_data: 'cancel_broadcast' },
                            ],
                        ],
                    };

                    bot.sendMessage(chatId, `${previewMessage}\n\nApakah Anda yakin ingin mengirim media dan pesan teks ini?`, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });

                    // Tangani konfirmasi broadcast
                    bot.once('callback_query', async (confirmQuery) => {
                        const confirmData = confirmQuery.data;

                        if (confirmData === 'confirm_broadcast') {
                            // Baca database admin lagi untuk memastikan data terbaru
                            const admins = readAdmins();

                            // Kirim media dan pesan teks (jika ada) ke semua admin kecuali diri sendiri
                            let successCount = 0;
                            let failCount = 0;

                            for (const admin of admins) {
                                // Lewati pengiriman ke diri sendiri
                                if (admin.id === userId) {
                                    continue;
                                }

                                try {
                                    if (msg.photo) {
                                        await bot.sendPhoto(admin.id, msg.photo[msg.photo.length - 1].file_id, { caption: additionalText || '' });
                                    } else if (msg.video) {
                                        await bot.sendVideo(admin.id, msg.video.file_id, { caption: additionalText || '' });
                                    } else if (msg.document) {
                                        await bot.sendDocument(admin.id, msg.document.file_id, { caption: additionalText || '' });
                                    } else if (msg.audio) {
                                        await bot.sendAudio(admin.id, msg.audio.file_id, { caption: additionalText || '' });
                                    } else if (msg.sticker) {
                                        await bot.sendSticker(admin.id, msg.sticker.file_id);
                                        if (additionalText) {
                                            await bot.sendMessage(admin.id, additionalText);
                                        }
                                    }
                                    successCount++;
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1 detik
                                } catch (error) {
                                    console.error(`Gagal mengirim pesan/media ke ${admin.id}:`, error);
                                    failCount++;
                                }
                            }

                            // Beri laporan ke admin
                            const reportMessage = `📢 *Broadcast Selesai!*\n\n` +
                                                `✅ Berhasil dikirim ke: ${successCount} admin\n` +
                                                `❌ Gagal dikirim ke: ${failCount} admin`;

                            const backToStartKeyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: 'back_to_start' },
                                    ],
                                ],
                            };

                            bot.sendMessage(chatId, reportMessage, {
                                parse_mode: 'Markdown',
                                reply_markup: backToStartKeyboard,
                            });
                        } else if (confirmData === 'cancel_broadcast') {
                            // Batalkan broadcast
                            const backToStartKeyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: 'back_to_start' },
                                    ],
                                ],
                            };

                            bot.sendMessage(chatId, 'Broadcast dibatalkan.', {
                                parse_mode: 'Markdown',
                                reply_markup: backToStartKeyboard,
                            });
                        }
                    });
                } else if (msg.text) {
                    // Jika pesan berupa teks, lanjutkan seperti biasa
                    let previewMessage = '📝 *Pratinjau Pesan:*\n\n';
                    previewMessage += msg.text;

                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '✅ Ya, Kirim', callback_data: 'confirm_broadcast' },
                                { text: '❌ Batal', callback_data: 'cancel_broadcast' },
                            ],
                        ],
                    };

                    bot.sendMessage(chatId, `${previewMessage}\n\nApakah Anda yakin ingin mengirim pesan ini?`, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });

                    // Tangani konfirmasi broadcast
                    bot.once('callback_query', async (confirmQuery) => {
                        const confirmData = confirmQuery.data;

                        if (confirmData === 'confirm_broadcast') {
                            // Baca database admin lagi untuk memastikan data terbaru
                            const admins = readAdmins();

                            // Kirim pesan teks ke semua admin kecuali diri sendiri
                            let successCount = 0;
                            let failCount = 0;

                            for (const admin of admins) {
                                // Lewati pengiriman ke diri sendiri
                                if (admin.id === userId) {
                                    continue;
                                }

                                try {
                                    await bot.sendMessage(admin.id, msg.text);
                                    successCount++;
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1 detik
                                } catch (error) {
                                    console.error(`Gagal mengirim pesan ke ${admin.id}:`, error);
                                    failCount++;
                                }
                            }

                            // Beri laporan ke admin
                            const reportMessage = `📢 *Broadcast Selesai!*\n\n` +
                                                `✅ Berhasil dikirim ke: ${successCount} admin\n` +
                                                `❌ Gagal dikirim ke: ${failCount} admin`;

                            const backToStartKeyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: 'back_to_start' },
                                    ],
                                ],
                            };

                            bot.sendMessage(chatId, reportMessage, {
                                parse_mode: 'Markdown',
                                reply_markup: backToStartKeyboard,
                            });
                        } else if (confirmData === 'cancel_broadcast') {
                            // Batalkan broadcast
                            const backToStartKeyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔙 Kembali', callback_data: 'back_to_start' },
                                    ],
                                ],
                            };

                            bot.sendMessage(chatId, 'Broadcast dibatalkan.', {
                                parse_mode: 'Markdown',
                                reply_markup: backToStartKeyboard,
                            });
                        }
                    });
                } else {
                    // Jika pesan tidak dikenali
                    bot.sendMessage(chatId, 'Pesan tidak dikenali. Silakan coba lagi.');
                }
            });
        }
    });
};