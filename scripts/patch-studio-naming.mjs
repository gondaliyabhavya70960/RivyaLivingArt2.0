import fs from 'fs';
import path from 'path';

// Recursively find and replace "Rivya Living Art Studio" with "RIVYA STUDIO" or similar luxury naming.
// We'll just patch a few prominent layout files where the admin header lives.
const filesToPatch = [
  './src/app/studio/layout.tsx',
  './src/components/studio/layout/sidebar.tsx',
  './src/app/studio/(dashboard)/layout.tsx'
];

filesToPatch.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/Rivya Living Art Studio/g, 'RIVYA STUDIO');
    content = content.replace(/Rivya Living Art/g, 'RIVYA STUDIO'); // A bit aggressive, but fits the requirement to rename Studio to RIVYA STUDIO
    fs.writeFileSync(filePath, content);
    console.log(`Patched ${filePath}`);
  }
});
