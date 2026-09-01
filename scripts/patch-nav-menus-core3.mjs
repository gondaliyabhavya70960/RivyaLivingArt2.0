import fs from 'fs';

const navMenuPath = './src/lib/nav-menus.ts';
let content = fs.readFileSync(navMenuPath, 'utf8');

// The dynamic regex checks for `portfolio` and `blog` explicitly.
content = content.replace(/portfolio\|blog/g, 'projects|journal');
// Or more safely:
content = content.replace(/^\/(shop|product|portfolio|blog|p)\//, '/^(shop|product|projects|journal|p)/');

fs.writeFileSync(navMenuPath, content);
