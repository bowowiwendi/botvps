module.exports = (bot, servers) => {
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('Setting_')) {
      const serverIndex = data.split('_')[1];
      const server = servers[serverIndex];
      
      if (server) {
        handleSettingMenu(bot, chatId, serverIndex);
      } else {
         bot.sendMessage(chatId, 'Server tidak ditemukan.');
       }
    } 
  });

  const handleSettingMenu = (bot, chatId, serverIndex, servers) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Reboot', callback_data: `reboot_${serverIndex}` },
        ],
        [
          { text: 'Regist', callback_data: `regist_${serverIndex}` },
        ],
        [
          { text: 'Gen Link', callback_data: `gen_link_${serverIndex}` },
        ],
        [
          { text: 'Info VPS', callback_data: `info_vps_${serverIndex}` },
        ],
        [
          { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
        ],
      ],
    };

    const message = `
⚙️ Menu Setting Vps : 
Pilih aksi yang ingin dilakukan:
- Reboot: Restart server.
- Regist: Registrasi AutoScript.
- Gen Link: Generate link Backup.
- Info VPS: Lihat informasi VPS.
by @WENDIVPN
`;

    bot.sendMessage(chatId, message, {
      reply_markup: keyboard,
    });
  };
};