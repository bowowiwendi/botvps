const fs = require('fs');
const path = require('path');

const updateUserBalance = (userId, amount) => {
  const data = getAdminData();
  const user = data.find(u => u.id.toString() === userId.toString());
  
  if (user) {
    user.balance += amount;
    fs.writeFileSync(
      path.join(__dirname, '../admins.json'),
      JSON.stringify(data, null, 2)
    );
    return true;
  }
  return false;
};

// Fungsi untuk membaca data dari admins.json
const getAdminData = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../admins.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading admins.json:', err);
    return [];
  }
};

// Fungsi untuk mencari user berdasarkan chatId
const findUser = (chatId) => {
  const adminData = getAdminData();
  return adminData.find(user => user.id.toString() === chatId.toString()) || { 
    name: 'User', 
    balance: 0,
    username: 'Guest',
    is_main: false
  };
};

const showServerList = (bot, chatId, servers) => {
  const user = findUser(chatId);
  
  const keyboard = servers.map((server, index) => [
    {
      text: server.name,
      callback_data: `select_server_${index}`,
    },
  ]);
  
  // Add Topup button
  keyboard.push([{ text: '💳 Topup', callback_data: 'topup_balance' }]);
  
  // Add Edit Welcome Message button only for main admins
  if (user.is_main) {
    keyboard.push([{ text: '✏️ Edit Welcome Message', callback_data: 'edit_welcome_message' }],
      [{ text: '🔙 Kembali',
      callback_data: 'back_to_start' }]);
  }
  
  const message = `
👋 Selamat Datang, ${user.name} (@${user.username})!

💰 Balance Anda: Rp ${user.balance.toLocaleString()}

📌 WENDI STORE Bot 🚀
Daftar Harga:
- Server SG Perbulan/10k 2 Devices
- Server SG Perbulan/15k STB
- Server ID Perbulan/15k 2 Devices
- Server ID Perbulan/20k STB

Nb: SG/Singapore, ID/Indonesia
by @WENDIVPN

Pilih server:`;

  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: keyboard,
    },
    parse_mode: 'Markdown'
  });
};

module.exports = (bot, servers) => {
  // Perintah /menu
  bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    showServerList(bot, chatId, servers);
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const user = findUser(chatId);

    if (data.startsWith('select_server_')) {
      const serverIndex = data.split('_')[2];
      const server = servers[serverIndex];

      // if (!server) {
      //   await bot.sendMessage(chatId, 'Server tidak ditemukan.');
      //   return;
      // }

      // Create different keyboard based on user status
      let keyboard;
      if (user.is_main) {
        keyboard = {
          inline_keyboard: [
            [{ text: ' SSH', callback_data: `ssh_${serverIndex}` }],
            [{ text: ' V2RAY', callback_data: `v2ray_${serverIndex}` }],
            [{ text: 'Setting', callback_data: `Setting_${serverIndex}` }],
            [{ text: '🔙 Kembali', callback_data: 'list_servers' }],
          ],
        };
      } else {
        keyboard = {
          inline_keyboard: [
            [{ text: ' SSH', callback_data: `ssh_${serverIndex}` }],
            [{ text: ' V2RAY', callback_data: `v2ray_${serverIndex}` }],
            [{ text: '🔙 Kembali', callback_data: 'list_servers' }],
          ],
        };
      }
      
      const message = `
👋 Hai, ${user.name} (@${user.username})!
💰 Balance: Rp ${user.balance.toLocaleString()}

📋 Keterangan Server:
• Nama: ${server.name}
• Host: ${server.host}
• Domain: ${server.domain}

by @WENDIVPN`;

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } else if (data.startsWith('ssh_')) {
      const serverIndex = data.split('_')[1];
      const server = servers[serverIndex];

      // if (!server) {
      //   await bot.sendMessage(chatId, 'Server tidak ditemukan.');
      //   return;
      // }

      // Hapus pesan lama
      await bot.deleteMessage(chatId, messageId);

      // Create different SSH menu based on user status
      let keyboard;
      if (user.is_main) {
        keyboard = {
          inline_keyboard: [
            [
              { text: 'Create SSH', callback_data: `create_ssh_${serverIndex}` },
            ],
            [
              { text: 'Trial SSH', callback_data: `trial_ssh_${serverIndex}` },
            ],
            [
              { text: 'Delete SSH', callback_data: `delete_ssh_${serverIndex}` },
            ],
            [
              { text: 'List SSH', callback_data: `list_member_${serverIndex}` },
            ],
            [
              { text: 'Renew SSH', callback_data: `renew_ssh_${serverIndex}` },
            ],
            [
              { text: 'Detail SSH', callback_data: `detail_ssh_${serverIndex}` },
            ],
            [
              { text: 'Lock SSH', callback_data: `lock_ssh_${serverIndex}` },
            ],
            [
              { text: 'Unlock SSH', callback_data: `unlock_ssh_${serverIndex}` },
            ],              
            [
              { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
            ],
          ],
        };
      } else {
        keyboard = {
          inline_keyboard: [
            [
              { text: 'Create SSH', callback_data: `create_ssh_${serverIndex}` },
            ],
            [
              { text: 'Trial SSH', callback_data: `trial_ssh_${serverIndex}` },
            ],
            [
              { text: 'Renew SSH', callback_data: `renew_ssh_${serverIndex}` },
            ],
            [
              { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
            ],
          ],
        };
      }
      
      const message = `
👋 Hai, ${user.name} (@${user.username})!
💰 Balance: Rp ${user.balance.toLocaleString()}

📋 Keterangan Server:
• Nama: ${server.name}
• Host: ${server.host}
• Domain: ${server.domain}

by @WENDIVPN`;
      await bot.sendMessage(chatId, message, {
        reply_markup: keyboard,
      });
    } else if (data === 'list_servers') {
      // Hapus pesan lama
      await bot.deleteMessage(chatId, messageId);
      showServerList(bot, chatId, servers, user);
    } else if (data === 'edit_welcome_message') {
      // Only allow main admins to edit welcome message
      if (!user.is_main) {
        await bot.answerCallbackQuery(query.id, { text: 'Akses ditolak! Hanya admin utama yang dapat mengedit pesan selamat datang.', show_alert: true });
        return;
      }
      
      // Hapus pesan lama
      await bot.deleteMessage(chatId, messageId);
      
      // Send message with current welcome message and edit options
      const currentMessage = `Ini adalah pesan selamat datang saat ini:\n\n${welcomeMessage}\n\nSilakan kirim pesan baru untuk menggantinya.`;
      
      await bot.sendMessage(chatId, currentMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'list_servers' }]
          ]
        }
      });
      
      // Set up message listener for the new welcome message
      bot.once('message', async (msg) => {
        if (msg.chat.id === chatId && !msg.text.startsWith('/')) {
          // Save the new welcome message (you'll need to implement this storage)
          welcomeMessage = msg.text;
          await bot.sendMessage(chatId, 'Pesan selamat datang telah diperbarui!');
          showServerList(bot, chatId, servers);
        }
      });
    }
  });
  
  // Variable to store welcome message (you might want to store this in a file/database)
  let welcomeMessage = `
👋 Selamat Datang, {name} (@{username})!

💰 Balance Anda: Rp {balance}

📌 WENDI STORE Bot 🚀
Daftar Harga:
- Server SG Perbulan/10k 2 Devices
- Server SG Perbulan/15k STB
- Server ID Perbulan/15k 2 Devices
- Server ID Perbulan/20k STB

Nb: SG/Singapore, ID/Indonesia
by @WENDIVPN

Pilih server:`;
};