import fs from 'fs';

const pagePath = './src/app/[locale]/(v2)/journal/page.tsx';
let pContent = fs.readFileSync(pagePath, 'utf8');

pContent = pContent.replace(/\/blog/g, '/journal');

fs.writeFileSync(pagePath, pContent);
