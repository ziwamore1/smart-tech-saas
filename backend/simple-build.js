const { exec } = require('child_process');
const path = require('path');

console.log('Building SmartTech Backend...\n');

const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' };

exec('npx tsc --outDir dist/src --declaration false --removeComments', 
  { cwd: __dirname, env },
  (error, stdout, stderr) => {
    if (error) {
      console.error('Build error:', stderr || error.message);
      process.exit(1);
    }
    if (stdout) console.log(stdout);
    console.log('✓ Build completed!');
  }
);
