import fs from 'fs';

const testPath = './src/lib/nav-menus.test.ts';
let content = fs.readFileSync(testPath, 'utf8');

// Update tests testing the old paths
content = content.replace(/\/custom-order/g, '/bespoke');
content = content.replace(/\/blog/g, '/journal');

fs.writeFileSync(testPath, content);
