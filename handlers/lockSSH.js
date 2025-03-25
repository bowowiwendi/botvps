const { exec } = require('child_process');

// Fungsi untuk mengecek keberadaan user di /etc/shadow
const checkUserExists = (vpsHost, username, callback) => {
    const checkCommand = `ssh root@${vpsHost} "grep -q '^${username}:' /etc/shadow && echo 'exists' || echo 'not_exists'"`;
    
    exec(checkCommand, (error, stdout, stderr) => {
        callback(!error && stdout.trim() === 'exists');
    });
};

// Fungsi untuk mengunci SSH di VPS
const lockSSH = (vpsHost, username, callback) => {
    checkUserExists(vpsHost, username, (exists) => {
        if (!exists) {
            callback(`❌ User \`${username}\` tidak ditemukan.`);
            return;
        }

        const command = `printf "${username}" | ssh root@${vpsHost} user-lock.sh`;
        exec(command, (error, stdout, stderr) => {
            callback(error 
                ? `⚠️ Gagal mengunci user \`${username}\``
                : `✅ User \`${username}\` berhasil dikunci.`
            );
        });
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
                await bot.sendMessage(chatId, '🚫 Server tidak ditemukan');
                return;
            }
          
            await bot.sendMessage(chatId, '🔒 Masukkan username SSH yang ingin dikunci:');
            
            bot.once('message', async (msg) => {
                const username = msg.text.trim();
                if (!username) {
                    await bot.sendMessage(chatId, '⚠️ Username tidak boleh kosong');
                    return;
                }

                lockSSH(server.host, username, async (result) => {
                    await bot.sendMessage(chatId, result, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { 
                                    text: '🔙 Kembali', 
                                    callback_data: `select_server_${serverIndex}` 
                                }
                            ]]
                        }
                    });
                });
            });
        }
    });
};