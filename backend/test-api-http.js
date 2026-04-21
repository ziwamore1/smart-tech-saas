const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testAPI() {
  const baseUrl = 'http://localhost:3001/api/v1';
  
  console.log('🧪 Testing SmartTech API Endpoints\n');
  
  // Test 1: Health check
  console.log('1️⃣ Testing server health...');
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 3001, path: '/' });
    console.log('   Server responded with status:', res.status);
  } catch (e) {
    console.log('   ⚠️ Server not running. Start with: npm run start:dev');
    console.log('\nTo test after starting server:');
    console.log('curl -X POST http://localhost:3001/api/v1/auth/login \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"email":"your@email.com","password":"password"}\'');
    return;
  }
  
  // Test 2: Login
  console.log('\n2️⃣ Testing login...');
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'test@school.com', password: 'password' }));
    
    const body = JSON.parse(loginRes.body);
    console.log('   Status:', loginRes.status);
    if (body.access_token) {
      console.log('   ✓ Got token!');
      varToken = body.access_token;
    } else {
      console.log('   Response:', body.message || 'Login failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
  }
  
  console.log('\n✅ API Test script ready!');
  console.log('\nStart the server: npm run start:dev');
  console.log('Then run this script: node test-api-http.js');
}

testAPI();
