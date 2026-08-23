require('dotenv/config');
require('reflect-metadata');
console.log('probe: requiring dist/app.module.js ...');
const t = setTimeout(() => { console.log('IMPORT-HANG: 60s elapsed, AppModule never finished loading'); process.exit(2); }, 60000);
const m = require('../dist/app.module.js');
clearTimeout(t);
console.log('IMPORT-OK: AppModule loaded, type =', typeof m.AppModule);
