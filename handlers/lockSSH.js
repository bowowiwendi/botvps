const { exec } = require('child_process');

const viewSSHMembers = (vpsHost, callback) => {
    const command = `ssh root@${vpsHost} bot-member-ssh`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            callback(`Error: ${stderr}`);
            return;
        }

        // Format hasil menjadi lebih menarik
        const formattedOutput = `📋 *DAFTAR MEMBER SSH* 📋\n\n` +
                                "```\n" +
                                stdout +
                                "\n```";

        callback(null, formattedOutput);
    });
};
// Fungsi untuk menghapus SSH di VPS
const lockSSH = (vpsHost, username, callback) => {
    const command = `printf "${username}" | ssh root@${vpsHost} user-lock.sh`;

    exec(command, (error, stdout, stderr) => {
        // Selalu anggap berhasil, terlepas dari hasil eksekusi
        callback(`✅ User \`${username}\` berhasil dikunci.`);
    });
};

module.exports = (bot, servers) => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('lock_ssh_')) {
            const serverIndex = data.split('_')[2];
            const server = servers[serverIndex];

            if (!server) {
                await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                return;
            }
            
            viewSSHMembers(server.host, (error, result) => {
                if (error) {
                    bot.sendMessage(chatId, error);
                    return;
                }


            // Minta input username dari pengguna
            await bot.sendMessage(chatId, 'Masukkan username SSH yang ingin dikunci:');

            // Tangkap input pengguna
            bot.once('message', async (msg) => {
                const username = msg.text;

                if (!username) {
                    await bot.sendMessage(chatId, 'Username tidak boleh kosong.');
                    return;
                }

                // Panggil fungsi deleteSSH
                lockSSH(server.host, username, (result) => {
                    // Tambahkan tombol "Kembali ke Menu Server"
                    const keyboard = {
                        inline_keyboard: [
                            [
                                { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                            ],
                        ],
                    };

                    // Kirim pesan hasil penghapusan dengan tombol
                    bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                });
            });
        }
    });
};