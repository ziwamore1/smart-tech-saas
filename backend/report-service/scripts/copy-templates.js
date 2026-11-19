const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src', 'render', 'templates');
const destination = path.join(root, 'dist', 'render', 'templates');

function copyRecursive(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Template source not found: ${from}`);
  }
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const destinationPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

copyRecursive(source, destination);
console.log(`Copied Handlebars templates to ${destination}`);
