import fs from 'fs';

const pagePath = './src/app/[locale]/(v2)/wedding/page.tsx';
let pContent = fs.readFileSync(pagePath, 'utf8');

pContent = pContent.replace(/import \{ getTranslations, setRequestLocale \} from "next-intl\/server";/, 'import { setRequestLocale } from "next-intl/server";');

fs.writeFileSync(pagePath, pContent);
