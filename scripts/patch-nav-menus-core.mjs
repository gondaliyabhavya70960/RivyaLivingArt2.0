import fs from 'fs';

const navMenuPath = './src/lib/nav-menus.ts';
let content = fs.readFileSync(navMenuPath, 'utf8');

// The KNOWN_PAGES definition in `src/lib/nav-menus.ts` defines the validation.
// The tests say: "ships only hrefs its own validator accepts" and points out `/custom-order` still exists in the menu somewhere.
content = content.replace(/"\/custom-order"/g, '"/bespoke"');
content = content.replace(/"\/portfolio"/g, '"/projects"');
content = content.replace(/\/custom-order/g, '/bespoke');

fs.writeFileSync(navMenuPath, content);
