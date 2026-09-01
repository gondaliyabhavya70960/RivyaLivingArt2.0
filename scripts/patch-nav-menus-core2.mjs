import fs from 'fs';

const navMenuPath = './src/lib/nav-menus.ts';
let content = fs.readFileSync(navMenuPath, 'utf8');

// I also need to make sure the dynamically shipped actual default values for the navigation menu are correct.
content = content.replace(/href: "\/custom-order"/g, 'href: "/bespoke"');
content = content.replace(/href: "\/blog"/g, 'href: "/journal"');
content = content.replace(/href: "\/portfolio"/g, 'href: "/projects"');

fs.writeFileSync(navMenuPath, content);
