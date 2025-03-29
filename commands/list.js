const fs = require('fs');
const path = require('path');

// Initialize userState if not already defined
const userState = {};

const updateUserSaldo = (userId, amount) => {
  const data = getAdminData();
  const user = data.find(u => u.id.toString() === userId.toString());
  
  if (user) {
    user.saldo += amount;
    fs.writeFileSync(
      path.join(__dirname, '../admins.json'),
      JSON.stringify(data, null, 2)
    );
    return true;
  }
  return false;
};

const admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
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
    saldo: 0,
    username: 'Guest'
  };
};

let welcomePhoto = 'https://example.com/default-welcome.jpg';

// Fungsi untuk update foto welcome
const updateWelcomePhoto = (newPhoto) => {
  welcomePhoto = newPhoto;
  // Simpan ke file jika ingin persistensi
  fs.writeFileSync(path.join(__dirname, 'welcome_photo.txt'), newPhoto);
};

// Baca foto welcome saat startup (jika ada)
if (fs.existsSync(path.join(__dirname, 'welcome_photo.txt'))) {
  welcomePhoto = fs.readFileSync(path.join(__dirname, 'welcome_photo.txt'), 'utf8');
}

const showServerList = (bot, chatId, servers) => {
  const user = findUser(chatId);
  
  const keyboard = servers.map((server, index) => [
    {
      text: server.name,
      callback_data: `select_server_${index}`,
    },
  ]);
  keyboard.push([{ text: '💳 Topup', callback_data: 'topup_saldo' }]);
  
  const caption = `
👋 Selamat Datang, ${user.name} (@${user.username})!

💰 Saldo Anda: Rp ${user.saldo.toLocaleString()}

📌 WENDI STORE Bot 🚀
\`\`\`
Daftar Harga:
- Server SG Perbulan/10k 2 Devices
- Server SG Perbulan/15k STB
- Server ID Perbulan/15k 2 Devices
- Server ID Perbulan/20k STB
\`\`\`
Nb: SG/Singapore, ID/Indonesia
by @WENDIVPN

Pilih server:`;

  bot.sendPhoto(chatId, welcomePhoto, {
    caption: caption,
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'Markdown'
  });
};

// Modifikasi handler callback untuk menyertakan data user
module.exports = (bot, servers) => {
  // Perintah /menu
  bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    showServerList(bot, chatId, servers);
  });
  
  bot.onText(/\/setwelcomephoto/, async (msg) => {
    const chatId = msg.chat.id;
    const user = findUser(chatId);
    
    // Cek apakah admin
      const adminData = admins.find(admin => admin.id === chatId);
      const isAdmin = adminData !== undefined;
      const isPrimaryAdmin = isAdmin && admins[0].id === chatId;

       if (!isPrimaryAdmin) {
  return bot.sendMessage(chatId, '❌ Hanya admin utama');
       }

        bot.sendMessage(chatId, 'Silakan kirim foto baru untuk welcome message:', {
          reply_markup: { force_reply: true }
       });

    // Simpan state untuk menunggu foto
    userState[chatId] = { waitingForPhoto: true };
  });

  // Tangani foto yang dikirim
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const user = findUser(chatId);
    
    if (userState[chatId]?.waitingForPhoto) {
      try {
        // Dapatkan file_id foto dengan kualitas terbaik (yang terakhir di array)
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        updateWelcomePhoto(fileId);
        
        await bot.sendMessage(chatId, '✅ Foto welcome berhasil diperbarui!');
        delete userState[chatId];
        
        // Tampilkan preview
        await bot.sendPhoto(chatId, fileId, { caption: 'Foto welcome baru:' });
      } catch (error) {
        await bot.sendMessage(chatId, '❌ Gagal mengupdate foto: ' + error.message);
      }
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const user = findUser(chatId);

    if (data.startsWith('select_server_')) {
      const serverIndex = data.split('_')[2];
      const server = servers[serverIndex];

      if (!server) {
        await bot.sendMessage(chatId, 'Server tidak ditemukan.');
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: ' SSH', callback_data: `ssh_${serverIndex}` }],
          [{ text: ' V2RAY', callback_data: `v2ray_${serverIndex}` }],
          [{ text: 'Setting', callback_data: `Setting_${serverIndex}` }],
          [{ text: '🔙 Kembali', callback_data: 'list_servers' }],
        ],
      };
      
      const message = `
👋 Hai, ${user.name} (@${user.username})!
💰 Saldo: Rp ${user.saldo.toLocaleString()}
\`\`\`
📋 Keterangan Server:
• Nama: ${server.name}
• Host: ${server.host}
• Domain: ${server.domain}
\`\`\`
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

      if (!server) {
        await bot.sendMessage(chatId, 'Server tidak ditemukan.');
        return;
      }

      // Hapus pesan lama
      await bot.deleteMessage(chatId, messageId);

      // Tampilkan sub menu SSH
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Create SSH', callback_data: `create_ssh_${serverIndex}` }],
          [{ text: 'Trial SSH', callback_data: `trial_ssh_${serverIndex}` }],
          [{ text: 'Delete SSH', callback_data: `delete_ssh_${serverIndex}` }],
          [{ text: 'List SSH', callback_data: `list_member_${serverIndex}` }],
          [{ text: 'Renew SSH', callback_data: `renew_ssh_${serverIndex}` }],
          [{ text: 'Detail SSH', callback_data: `detail_ssh_${serverIndex}` }],
          [{ text: 'Lock SSH', callback_data: `lock_ssh_${serverIndex}` }],
          [{ text: 'Unlock SSH', callback_data: `unlock_ssh_${serverIndex}` }],              
          [{ text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` }],
        ],
      };
      
      const message = `
👋 Hai, ${user.name} (@${user.username})!
💰 Saldo: Rp ${user.saldo.toLocaleString()}
\`\`\`
📋 Keterangan Server Dipilih:
- Nama: ${server.name}
- Host: ${server.host}
- Domain: ${server.domain}
\`\`\`
by @WENDIVPN
`;
      await bot.sendMessage(chatId, message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } else if (data === 'list_servers') {
      // Hapus pesan lama
      await bot.deleteMessage(chatId, messageId);
      showServerList(bot, chatId, servers);
    }
  });
};