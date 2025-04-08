// Fungsi untuk menghasilkan username acak
const generateUsername = (prefix = 'user') => {
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${randomString}`;
};

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // Process /name command (tanpa cek admin)
        if (text && text.startsWith('/name')) {
            if (text === '/name') {
                let helpMessage = `👤 *Username Generator*\n\n`;
                helpMessage += `Gunakan: \`/name [prefix]\` untuk menghasilkan username acak\n`;
                helpMessage += `Contoh:\n`;
                helpMessage += `- \`/name\` → user-abc123\n`;
                helpMessage += `- \`/name vmess\` → vmess-xyz789\n`;
                helpMessage += `- \`/name ssh\` → ssh-pqr456`;

                return bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
            }

            const parts = text.split(' ');
            const prefix = parts[1] || 'user';
            const username = generateUsername(prefix);
            const response = `👤 *Username:* \`${username}\``;

            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        }
    });
};