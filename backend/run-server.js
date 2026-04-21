const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SmartTech Backend...\n');

const server = spawn('npx', ['ts-node', '--transpile-only', 'src/main.ts'], {
  cwd: __dirname,
  shell: true,
  stdio: 'pipe',
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096'
  }
});

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  // Check if server started
  if (output.includes('running on') || output.includes('Application is running')) {
    console.log('\n✅ Server is running at http://localhost:3001/api/v1');
    console.log('\n📝 Test endpoints:');
    console.log('  curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"email":"test@test.com","password":"test"}\'');
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  // Only show errors, not all output
  if (output.includes('ERROR') || output.includes('Error') || output.includes('Exception')) {
    console.error('ERR:', output.substring(0, 300));
  }
});

server.on('close', (code) => {
  console.log('\nServer stopped with code:', code);
});

server.on('error', (err) => {
  console.error('Failed to start:', err.message);
});

// Give it 30 seconds to start
setTimeout(() => {
  console.log('\n⏳ Server should be ready. Testing...');
}, 30000);
