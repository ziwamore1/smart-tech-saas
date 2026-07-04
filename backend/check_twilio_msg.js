const twilio = require('twilio');
const c = twilio('ACc7828da398564f1f951bffc733e92a2b', 'bb29212101ac6d636784989d0ecc4186');
c.messages('SM82e14aa8f6d7535e7b78e6948c688a80').fetch()
  .then(m => {
    console.log(JSON.stringify({
      status: m.status,
      errorCode: m.errorCode,
      errorMessage: m.errorMessage,
      to: m.to,
      from: m.from,
      price: m.price,
      priceUnit: m.priceUnit,
      direction: m.direction
    }));
  })
  .catch(e => console.error('Error:', e.message));
