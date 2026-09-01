import fs from 'fs';

const testPath = './src/lib/footer-tagline.test.ts';
let content = fs.readFileSync(testPath, 'utf8');

// The test is looking for `src/app/[locale]/(v2)/blog/[slug]/opengraph-image.tsx`
// but we renamed `/blog` to `/journal`. Let's fix the test.
content = content.replace(/blog\/\[slug\]/g, 'journal/[slug]');

fs.writeFileSync(testPath, content);
