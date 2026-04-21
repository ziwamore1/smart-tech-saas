/**
 * Quick Start Script for Smart Tech SaaS System
 * Starts both backend and frontend servers
 */

const { spawn, exec } = require('child_process');
const readline = require('readline');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

let backendRunning = false;
let frontendRunning = false;

function log(type, message) {
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    start: `${colors.cyan}▶${colors.reset}`,
  };
  console.log(`${prefix[type] || '•'} ${message}`);
}

function startBackend() {
  return new Promise((resolve, reject) => {
    log('start', 'Starting Backend Server...');
    console.log(`  ${colors.gray}Directory: C:\\Smart_Tech SaaS System\\backend${colors.reset}`);
    console.log(`  ${colors.gray}Command: npm run start:dev${colors.reset}\n`);
    
    const backend = spawn('npm', ['run', 'start:dev'], {
      cwd: 'C:\\Smart_Tech SaaS System\\backend',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backend.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Nest application successfully started') || 
          output.includes('Application is running on')) {
        if (!backendRunning) {
          backendRunning = true;
          log('success', 'Backend Server Started!');
          log('info', 'API: http://localhost:3001');
          resolve();
        }
      }
    });

    backend.stderr.on('data', (data) => {
      // Suppress common warnings
    });

    backend.on('error', (err) => {
      log('error', `Backend failed to start: ${err.message}`);
      reject(err);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!backendRunning) {
        log('warn', 'Backend taking longer than expected to start...');
      }
    }, 15000);
  });
}

function startFrontend() {
  return new Promise((resolve, reject) => {
    log('start', 'Starting Frontend Server...');
    console.log(`  ${colors.gray}Directory: C:\\Smart_Tech SaaS System\\frontend${colors.reset}`);
    console.log(`  ${colors.gray}Command: npm run dev${colors.reset}\n`);
    
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: 'C:\\Smart_Tech SaaS System\\frontend',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    frontend.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready' || output.includes('started server') || output.includes('localhost:3000'))) {
        if (!frontendRunning) {
          frontendRunning = true;
          log('success', 'Frontend Server Started!');
          log('info', 'App: http://localhost:3000');
          resolve();
        }
      }
    });

    frontend.stderr.on('data', (data) => {
      // Suppress common warnings
    });

    frontend.on('error', (err) => {
      log('error', `Frontend failed to start: ${err.message}`);
      reject(err);
    });
  });
}

function runTests() {
  log('start', 'Running API Tests...\n');
  console.log(`  ${colors.gray}Running: node test-api.js${colors.reset}\n`);
  
  const testProcess = spawn('node', ['test-api.js'], {
    cwd: 'C:\\Smart_Tech SaaS System',
    shell: true,
    stdio: 'inherit',
  });

  testProcess.on('close', (code) => {
    showMenu();
  });
}

function showMenu() {
  console.log(`\n${colors.bold}╔════════════════════════════════════════════════════════════╗`);
  console.log('║   Smart Tech SaaS System - Control Panel                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  
  if (backendRunning) {
    console.log(`  ${colors.green}●${colors.reset} Backend:  ${colors.green}Running${colors.reset} - http://localhost:3001`);
  } else {
    console.log(`  ${colors.red}●${colors.reset} Backend:  ${colors.red}Stopped${colors.reset}`);
  }
  
  if (frontendRunning) {
    console.log(`  ${colors.green}●${colors.reset} Frontend: ${colors.green}Running${colors.reset} - http://localhost:3000`);
  } else {
    console.log(`  ${colors.red}●${colors.reset} Frontend: ${colors.red}Stopped${colors.reset}`);
  }

  console.log(`\n  ${colors.cyan}1${colors.reset} - Test API Endpoints`);
  console.log(`  ${colors.cyan}2${colors.reset} - Open Frontend (http://localhost:3000)`);
  console.log(`  ${colors.cyan}3${colors.reset} - Open Backend API (http://localhost:3001)`);
  console.log(`  ${colors.cyan}4${colors.reset} - View Backend Logs`);
  console.log(`  ${colors.cyan}5${colors.reset} - Restart Servers`);
  console.log(`  ${colors.cyan}6${colors.reset} - Stop All Servers`);
  console.log(`  ${colors.cyan}0${colors.reset} - Exit\n`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Select option: ', async (answer) => {
    rl.close();
    
    switch (answer) {
      case '1':
        runTests();
        break;
      case '2':
        exec('start http://localhost:3000', { shell: true });
        log('info', 'Opening frontend in browser...');
        showMenu();
        break;
      case '3':
        exec('start http://localhost:3001', { shell: true });
        log('info', 'Opening backend API in browser...');
        showMenu();
        break;
      case '4':
        exec('start backend.log', { shell: true, cwd: 'C:\\Smart_Tech SaaS System\\backend' });
        showMenu();
        break;
      case '5':
        exec('taskkill /F /IM node.exe', { shell: true });
        backendRunning = false;
        frontendRunning = false;
        setTimeout(async () => {
          await startBackend();
          await startFrontend();
          showMenu();
        }, 2000);
        break;
      case '6':
        exec('taskkill /F /IM node.exe', { shell: true });
        backendRunning = false;
        frontendRunning = false;
        log('info', 'All servers stopped.');
        break;
      case '0':
        exec('taskkill /F /IM node.exe', { shell: true });
        console.log(`\n${colors.green}Goodbye!${colors.reset}\n`);
        process.exit(0);
      default:
        showMenu();
    }
  });
}

async function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Smart Tech SaaS System - Quick Start                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  log('info', 'Starting servers...\n');
  
  try {
    await startBackend();
    await startFrontend();
    showMenu();
  } catch (error) {
    log('error', 'Failed to start servers');
    console.log(error);
  }
}

main();
