const fs = require('fs');

module.exports = (admins) => {
    fs.writeFileSync('admins.json', JSON.stringify(admins, null, 2));
};