import fs from 'fs';
// We need to patch the actual sidebar component since it wasn't in the list
const sidebarPath = './src/components/studio/sidebar.tsx';
if (fs.existsSync(sidebarPath)) {
  let content = fs.readFileSync(sidebarPath, 'utf8');
  content = content.replace(/Rivya Living Art Studio/g, 'RIVYA STUDIO');
  // Update links
  content = content.replace(/Portfolio/g, 'Projects');
  content = content.replace(/Blog/g, 'Journal');
  fs.writeFileSync(sidebarPath, content);
  console.log('Patched sidebar');
}
