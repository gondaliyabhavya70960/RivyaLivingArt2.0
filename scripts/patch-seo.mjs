import fs from 'fs';

const enPath = './messages/en.json';
let enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

if (enData.Home && enData.Home.meta) {
    enData.Home.meta.title = "Rivya Living Art | Luxury Resin Furniture & Bespoke Tables";
    enData.Home.meta.description = "Discover handcrafted luxury resin furniture, bespoke river tables, and contemporary resin art designed for extraordinary spaces.";
}

if (enData.About && enData.About.meta) {
    enData.About.meta.title = "Our Craft & Heritage | Rivya Living Art";
    enData.About.meta.description = "Learn about our craftsmanship, materials, and the vision behind our luxury resin furniture and sculptural art.";
}

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));

// Copy over to other locales to pass validation
const locales = ['ar', 'de', 'es', 'fr', 'gu', 'hi', 'ja', 'zh'];
locales.forEach(locale => {
  const filePath = `./messages/${locale}.json`;
  if (fs.existsSync(filePath)) {
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.Home && data.Home.meta) {
      data.Home.meta.title = enData.Home.meta.title;
      data.Home.meta.description = enData.Home.meta.description;
    }
    if (data.About && data.About.meta) {
      data.About.meta.title = enData.About.meta.title;
      data.About.meta.description = enData.About.meta.description;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
});
