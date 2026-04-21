const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = 'C:\\Smart_Tech SaaS System\\backend';
const outDir = path.join(projectDir, 'dist', 'src');

console.log('Building SmartTech Backend...\n');

async function run() {
  // Ensure dist directory exists
  if (!fs.existsSync(path.join(projectDir, 'dist'))) {
    fs.mkdirSync(path.join(projectDir, 'dist'));
  }
  
  // Build with tsc using less memory
  const tscCmd = `npx tsc --outDir "${path.join(projectDir, 'dist')}" --declaration false --removeComments --skipLibCheck --incremental false`;
  
  const child = exec(tscCmd, { cwd: projectDir }, (error, stdout, stderr) => {
    if (error) {
      console.error('Build error:', stderr || error.message);
      process.exit(1);
    }
    console.log('Build output:', stdout || 'Compiled successfully');
    
    // Copy main.ts to dist as main.js
    console.log('\n✓ Build completed! Starting server...');
    
    // Run the built application
    const startCmd = `node "${path.join(projectDir, 'dist', 'main.js')}"`;
    exec(startCmd, { cwd: projectDir }, (e, o, er) => {
      if (e) console.log('Error:', e.message);
      console.log(o.substring(0, 1000));
    });
  });
  
  let output = '';
  child.stdout.on('data', d => output += d);
  child.stderr.on('data', d => output += d);
  
  setTimeout(() => {
    console.log(output.substring(0, 500));
    console.log('\nServer should be running. Test with:');
    console.log('curl http://localhost:3001/api/v1');
    process.exit(0);
  }, 45000);
}

run();
