import fs from 'fs';
const constPath = './src/lib/constants.ts';
let content = fs.readFileSync(constPath, 'utf8');
content = content.replace(/\/custom-order/g, '/bespoke');
content = content.replace(/\/portfolio/g, '/projects');
content = content.replace(/\/blog/g, '/journal');
fs.writeFileSync(constPath, content);
