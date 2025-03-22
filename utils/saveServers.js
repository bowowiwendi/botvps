const fs = require('fs');

module.exports = (servers) => {
    fs.writeFileSync('servers.json', JSON.stringify(servers, null, 2));
};
