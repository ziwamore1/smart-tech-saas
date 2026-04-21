const bcrypt = require('bcrypt');

const args = process.argv.slice(2);
const password = args[0] || 'password123';

async function hashPassword() {
  const hash = await bcrypt.hash(password, 10);
  console.log('\nBcrypt hash for:', password);
  console.log('Hash:', hash);
  console.log('\nSQL to update user:');
  console.log(`UPDATE "User" SET password = '${hash}' WHERE email = 'your@email.com';`);
}

hashPassword().catch(console.error);