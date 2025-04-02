const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path'); // Untuk handle path file
require('dotenv').config();

// Import commands and handlers
const startCommand = require('./commands/start');
const listCommand = require('./commands/list');
// const addServerCommand = require('./commands/addserver');
// const delServerCommand = require('./commands/delserver');
const v2rayCommand = require('./commands/v2ray');
const createSSH = require('./handlers/createSSH');
const delSSH = require('./handlers/delSSH');
const renewSSH = require('./handlers/renewSSH');
const lockSSH = require('./handlers/lockSSH');
const unlockSSH = require('./handlers/unlockSSH');
const trialSSH = require('./handlers/trialSSH');
const listSSH = require('./handlers/listSSH');
const detailSSH = require('./handlers/detailSSH');
const createVME = require('./handlers/createVME');
const createVLE = require('./handlers/createVLE');
const createSS = require('./handlers/createSS');
const createTroj = require('./handlers/createTroj');
const trialTroj = require('./handlers/trialTroj');
const trialVME = require('./handlers/trialVME');
const trialVLE = require('./handlers/trialVLE');
const trialSS = require('./handlers/trialSS');
const listSS = require('./handlers/listSS');
const listVME = require('./handlers/listVME');
const listVLE = require('./handlers/listVLE');
const listTroj = require('./handlers/listTroj');
const detailTroj = require('./handlers/detailTroj');
const detailVME = require('./handlers/detailVME');
const detailVLE = require('./handlers/detailVLE');
const detailSS = require('./handlers/detailSS');
const renewSS = require('./handlers/renewSS');
const renewVME = require('./handlers/renewVME');
const renewVLE = require('./handlers/renewVLE');
const renewTroj = require('./handlers/renewTroj');
const lockTroj = require('./handlers/lockTroj');
const unlockTroj = require('./handlers/unlockTroj');
const lockVME = require('./handlers/lockVME');
const unlockVME = require('./handlers/unlockVME');
const unlockVLE = require('./handlers/unlockVLE');
const lockVLE = require('./handlers/lockVLE');
const delTroj = require('./handlers/delTroj');
const delVME = require('./handlers/delVME');
const delVLE = require('./handlers/delVLE');
const delSS = require('./handlers/delSS');
const hadleSetting = require('./commands/hadleSetting');
const info = require('./commands/info');
const link = require('./commands/link');
const reboot = require('./commands/reboot')
const menuRegist = require('./commands/menuRegist');
const registIP = require('./commands/registIP');
const deletIP = require('./commands/deletIP');
const listIP = require('./commands/listIP');
const renewIP = require('./commands/renewIP');
const manageDetail = require('./commands/manageDetail');
const cmd = require('./commands/cmd');
const Topup = require('./Topup');
const broadcast = require('./broadcast');// Import modul broadcast

// Import modul broadcast
// Konfigurasi bot
const token = process.env.TELEGRAM_BOT_TOKEN; // Gunakan environment variable
const bot = new TelegramBot(token, { polling: true });

// Baca file konfigurasi server
let servers;
try {
    servers = JSON.parse(fs.readFileSync('servers.json', 'utf8'));
} catch (error) {
    console.error('Error reading servers.json:', error);
    servers = [];
}

// Baca file konfigurasi admin
let admins;
try {
    admins = JSON.parse(fs.readFileSync('admins.json', 'utf8'));
} catch (error) {
    console.error('Error reading admins.json:', error);
    admins = [];
}

// Daftar pengguna (chat ID)
let users = [];
// Jika Anda memiliki database atau file JSON untuk menyimpan pengguna, baca datanya di sini.

// Objek untuk menyimpan status pengguna
const userState = {};

// Daftarkan perintah
const commands = [
    { command: startCommand, params: [bot] },
    { command: listCommand, params: [bot, servers] },
  // { command: addServerCommand, params: [bot, userState, servers] },
  //   { command: delServerCommand, params: [bot, userState, servers] },
    { command: v2rayCommand, params: [bot, servers] },
    { command: createSSH, params: [bot, servers] },
    { command: delSSH, params: [bot, servers] },
    { command: renewSSH, params: [bot, servers] },
    { command: lockSSH, params: [bot, servers] },
    { command: unlockSSH, params: [bot, servers] },
    { command: trialSSH, params: [bot, servers] },
    { command: listSSH, params: [bot, servers] },
    { command: detailSSH, params: [bot, servers] },
    { command: createVME, params: [bot, servers] },
    { command: createVLE, params: [bot, servers] },
    { command: createTroj, params: [bot, servers] },
    { command: createSS, params: [bot, servers] },
    { command: detailSS, params: [bot, servers] },
    { command: detailVME, params: [bot, servers] },
    { command: detailVLE, params: [bot, servers] },
    { command: detailTroj, params: [bot, servers] },
    { command: listSS, params: [bot, servers] },
    { command: listVME, params: [bot, servers] },
    { command: listVLE, params: [bot, servers] },
    { command: listTroj, params: [bot, servers] },
    { command: trialSS, params: [bot, servers] },
    { command: trialVLE, params: [bot, servers] },
    { command: trialVME, params: [bot, servers] },
    { command: trialTroj, params: [bot, servers] },
    { command: renewTroj, params: [bot, servers] },
    { command: renewVLE, params: [bot, servers] },
    { command: renewVME, params: [bot, servers] },
    { command: renewSS, params: [bot, servers] },
    { command: lockTroj, params: [bot, servers] },
    { command: lockVLE, params: [bot, servers] },
    { command: lockVME, params: [bot, servers] },
    { command: unlockTroj, params: [bot, servers] },
    { command: unlockVLE, params: [bot, servers] },
    { command: unlockVME, params: [bot, servers] },
    { command: delSS, params: [bot, servers] },
    { command: delTroj, params: [bot, servers] },
    { command: delVME, params: [bot, servers] },
    { command: delVLE, params: [bot, servers] },
   { command: hadleSetting, params: [bot, servers] },
    { command: info, params: [bot, servers] },
    { command: link, params: [bot, servers] },
    { command: reboot, params: [bot, servers] },
    { command: renewIP, params: [bot, servers] },
    { command: listIP, params: [bot, servers] },
    { command: deletIP, params: [bot, servers] },
    { command: registIP, params: [bot, servers] },
    { command: menuRegist, params: [bot, servers] },
    { command: Topup, params: [bot, servers] },
   { command: manageDetail, params: [bot, servers] },
   { command: cmd, params: [bot, servers] },
];
commands.forEach(cmd => {
    try {
        if (typeof cmd.command === 'function') {
            cmd.command(...cmd.params); // Spread operator untuk mengurai array params
        } else {
            throw new Error(`Invalid command: ${cmd.command} is not a function`);
        }
    } catch (error) {
        console.error(`Error executing command:`, error);
    }
});

// Import dan inisialisasi perintah admin
// require('./commands/addadmin')(bot, userState);
// require('./commands/deladmin')(bot);
// require('./commands/listadmin')(bot);
// require('./commands/detailadmin')(bot);
require('./commands/menuAdmin')(bot);
// require('./commands/topup')(bot);

// Inisialisasi modul broadcast
broadcast(bot, users);

console.log('Bot sedang berjalan...');
