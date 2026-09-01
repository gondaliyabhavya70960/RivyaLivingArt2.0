import fs from 'fs';

const pagePath = './src/app/[locale]/(v2)/projects/page.tsx';
let pContent = fs.readFileSync(pagePath, 'utf8');

pContent = pContent.replace(/\/portfolio/g, '/projects');

fs.writeFileSync(pagePath, pContent);
