import fs from 'fs';

// Quick sanity check to ensure the header links also got swapped
const headerPath = './src/lib/nav-menus.ts';
if (fs.existsSync(headerPath)) {
   let content = fs.readFileSync(headerPath, 'utf8');
   content = content.replace(/\/portfolio/g, '/projects');
   content = content.replace(/\/blog/g, '/journal');
   content = content.replace(/\/custom-order/g, '/bespoke');
   fs.writeFileSync(headerPath, content);
}
