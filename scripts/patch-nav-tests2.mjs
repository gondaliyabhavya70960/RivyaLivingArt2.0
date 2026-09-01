import fs from 'fs';

// Look inside `src/lib/nav-menus.ts` to see what pages are permitted.
const navMenuPath = './src/lib/nav-menus.ts';
if (fs.existsSync(navMenuPath)) {
   let content = fs.readFileSync(navMenuPath, 'utf8');
   // Update `KNOWN_PAGES` to include the renamed ones.
   content = content.replace(/"\/custom-order"/g, '"/bespoke"');
   content = content.replace(/"\/blog"/g, '"/journal"');
   content = content.replace(/"\/portfolio"/g, '"/projects"');
   fs.writeFileSync(navMenuPath, content);
}
