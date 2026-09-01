import fs from 'fs';

const pagePath = './src/app/[locale]/(v2)/wedding/page.tsx';
let pContent = fs.readFileSync(pagePath, 'utf8');

pContent = pContent.replace(/const \{ locale \} = await params;\n  return \{/, 'await params;\n  return {');

fs.writeFileSync(pagePath, pContent);
