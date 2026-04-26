const fs = require('fs');
const path = require('path');

const distCjsDir = path.join(__dirname, '..', 'dist', 'cjs');
const packageJsonPath = path.join(distCjsDir, 'package.json');

fs.mkdirSync(distCjsDir, { recursive: true });
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
