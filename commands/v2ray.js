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
    username: 'Guest'
  };
};

module.exports = (bot, servers) => {
    // Fungsi untuk membuat submenu
    const createSubMenu = (prefix, serverIndex) => {
        return {
            inline_keyboard: [
                [
                    { text: 'Create', callback_data: `${prefix}_create_${serverIndex}` },
                ],
                [
                    { text: 'Trial', callback_data: `${prefix}_trial_${serverIndex}` },
                ],
                [
                    { text: 'Delete', callback_data: `${prefix}_delete_${serverIndex}` },
                ],
                [
                    { text: 'List', callback_data: `${prefix}_list_${serverIndex}` },
                ],
                [
                    { text: 'Renew', callback_data: `${prefix}_renew_${serverIndex}` },
                ],
                [
                    { text: 'Detail', callback_data: `${prefix}_detail_${serverIndex}` },
                ],
                [
                    { text: 'Unlock', callback_data: `${prefix}_unlock_${serverIndex}` },
                ],
                [
                    { text: 'Lock', callback_data: `${prefix}_lock_${serverIndex}` },
                ],
                [
                    { text: '🔙 Kembali', callback_data: `v2ray_${serverIndex}` },
                ],
            ],
        };
    };

    // Tangani callback query (tombol V2RAY)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id; // ID pesan yang akan dihapus
        const data = query.data;
        const user = findUser(chatId);

        try {
            if (data.startsWith('v2ray_')) {
                const serverIndex = data.split('_')[1];
                const server = servers[serverIndex];

                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }

                // Tampilkan Keterangan Server
                const serverDescription = `
👋 Hai, ${user.name} (@${user.username})!
💰 Balance: Rp ${user.balance.toLocaleString()}

📋 Keterangan Server:
• Nama: ${server.name}
• Host: ${server.host}
• Domain: ${server.domain}

by @WENDIVPN`;

                // Tampilkan menu V2RAY dengan semua opsi
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: 'VME', callback_data: `vme_${serverIndex}` },
                         ],
                         [
                            { text: 'VLE', callback_data: `vle_${serverIndex}` },
                          ],
                          [
                            { text: 'Troj', callback_data: `troj_${serverIndex}` },
                          ],
                          [
                            { text: 'SS', callback_data: `ss_${serverIndex}` },
                        ],
                        [
                            { text: '🔙 Kembali', callback_data: `select_server_${serverIndex}` },
                        ],
                    ],
                };

                // Kirim pesan baru dengan menu
                await bot.sendMessage(chatId, serverDescription, {
                    reply_markup: keyboard,
                });

                // Hapus pesan sebelumnya jika masih ada
                try {
                    await bot.deleteMessage(chatId, messageId);
                } catch (deleteError) {
                    console.error('Gagal menghapus pesan:', deleteError);
                }
            }
        } catch (error) {
            console.error('Terjadi kesalahan:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
        }
    });

    // Handler untuk submenu (contoh: VME, VLE, Troj, SS)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const user = findUser(chatId);

        try {
            if (data.startsWith('vme_') || data.startsWith('vle_') || data.startsWith('troj_') || data.startsWith('ss_')) {
                const [prefix, serverIndex] = data.split('_');
                const server = servers[serverIndex];

                if (!server) {
                    await bot.sendMessage(chatId, 'Server tidak ditemukan.');
                    return;
                }
                
const serverDescription = `
👋 Hai, ${user.name} (@${user.username})!
💰 Balance: Rp ${user.balance.toLocaleString()}

📋 Keterangan Server:
• Nama: ${server.name}
• Host: ${server.host}
• Domain: ${server.domain}

by @WENDIVPN
                `;
                // Tampilkan submenu sesuai prefix
                const subMenu = createSubMenu(prefix, serverIndex);

                await bot.sendMessage(chatId, serverDescription, {
                    reply_markup: subMenu,
                });
            }
        } catch (error) {
            console.error('Terjadi kesalahan:', error);
            await bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
        }
    });
};