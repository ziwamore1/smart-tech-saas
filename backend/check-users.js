const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ take: 5 }).then(users => {
  console.log(JSON.stringify(users, null, 2));
  p.$disconnect();
}).catch(e => {
  console.error(e.message);
  p.$disconnect();
});