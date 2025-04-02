const { exec } = require('child_process');
const fs = require('fs');

// Load admins data
const getAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync('./admins.json'));
    } catch (err) {
        return [];
    }
};

module.exports = (bot, servers) => {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userId = msg.from.id;

        // Check if user is admin with is_main: true
        const admins = getAdmins();
        const isAdminMain = admins.some(admin => 
            admin.id === userId && admin.is_main === true
        );

        // Only process /cmd commands for main admins
        if (text && text.startsWith('/cmd')) {
            if (!isAdminMain) {
                return bot.sendMessage(chatId, '❌ Akses ditolak. Hanya admin utama yang dapat menjalankan perintah ini.');
            }

            // Help message
            if (text === '/cmd') {
                let helpMessage = `🖥️ *Server Command Execution* (Admin Utama)\n\n`;
                helpMessage += `Format perintah:\n`;
                helpMessage += `• \`/cmd <perintah>\` - Server utama\n`;
                helpMessage += `• \`/cmd * <perintah>\` - Semua server\n`;
                helpMessage += `• \`/cmd <nomor> <perintah>\` - Server tertentu\n\n`;
                helpMessage += `*Daftar Server:*\n`;
                
                servers.forEach((server, index) => {
                    helpMessage += `${index}. ${server.name} (${server.host})\n`;
                });

                return bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
            }

            // Command execution
            if (text.startsWith('/cmd ')) {
                const parts = text.split(' ');
                const serverIdentifier = parts[1];
                const command = parts.slice(2).join(' ');

                if (!command) {
                    return bot.sendMessage(chatId, '❌ Mohon masukkan perintah yang ingin dijalankan');
                }

                // Execute on all servers
                if (serverIdentifier === '*') {
                    bot.sendMessage(chatId, `⏳ Menjalankan perintah pada ${servers.length} server...`);
                    servers.forEach(server => {
                        executeCommand(bot, chatId, server, command);
                    });
                    return;
                }
                
                // Execute on specific server
                if (!isNaN(serverIdentifier)) {
                    const serverIndex = parseInt(serverIdentifier);
                    const server = servers[serverIndex];
                    
                    if (!server) {
                        return bot.sendMessage(chatId, '❌ Server tidak ditemukan');
                    }
                    executeCommand(bot, chatId, server, command);
                    return;
                }

                // Execute on default server
                const server = servers[0];
                if (!server) {
                    return bot.sendMessage(chatId, '❌ Server utama tidak ditemukan');
                }
                executeCommand(bot, chatId, server, `${serverIdentifier} ${command}`.trim());
            }
        }
    });
};

function executeCommand(bot, chatId, server, command) {
    const sshCommand = `ssh root@${server.host} ${command}`;
    
    exec(sshCommand, (error, stdout, stderr) => {
        let response = `🖥️ *Server:* ${server.name} (${server.host})\n` +
                      `⚡ *Command:* \`${command}\`\n\n`;

        if (error) {
            response += `❌ *Error:*\n\`\`\`${error.message}\`\`\``;
        } else {
            response += `📝 *Output:*\n\`\`\`${stdout || stderr}\`\`\``;
        }

        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    });
}