import fs from 'fs';

// Rename the Scraper UI in the Studio to "Market Intelligence Studio"
const scraperPage = './src/app/studio/(dashboard)/scraper/page.tsx';
if (fs.existsSync(scraperPage)) {
    let content = fs.readFileSync(scraperPage, 'utf8');
    content = content.replace(/Product Scraper/g, 'Market Intelligence Studio');
    fs.writeFileSync(scraperPage, content);
}

const sidebarPath = './src/components/studio/sidebar.tsx';
if (fs.existsSync(sidebarPath)) {
    let content = fs.readFileSync(sidebarPath, 'utf8');
    content = content.replace(/Scraper/g, 'Market Intelligence');
    fs.writeFileSync(sidebarPath, content);
}
