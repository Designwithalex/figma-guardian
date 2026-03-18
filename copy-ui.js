const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src', 'ui.html');
const dest = path.join(__dirname, 'dist', 'ui.html');
if (!fs.existsSync(path.join(__dirname, 'dist'))) fs.mkdirSync(path.join(__dirname, 'dist'));
fs.copyFileSync(src, dest);
console.log('UI copied.');
