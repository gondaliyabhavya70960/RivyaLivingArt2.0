import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

/* Every committed file under public/, and whether ANY tracked source,
   script, registry, manifest, test or document mentions it. */
const assets = execSync("git ls-files public", { encoding: "utf8" })
  .split("\n").filter(Boolean);

// One haystack: every tracked text file outside public/ and node_modules.
const textFiles = execSync(
  "git ls-files -- src scripts prisma docs tests messages data '*.md' '*.json' '*.ts' '*.mts' '*.mjs' '*.css'",
  { encoding: "utf8" },
).split("\n").filter(Boolean).filter((f) => !f.startsWith(".claude/"));

let hay = "";
for (const f of textFiles) {
  try { hay += readFileSync(f, "utf8") + "\n"; } catch {}
}

const unused = [];
let usedBytes = 0, unusedBytes = 0;
for (const a of assets) {
  const web = "/" + a.replace(/^public\//, "");   // how next/image refers to it
  const base = a.split("/").pop();
  const size = statSync(a).size;
  const referenced = hay.includes(web) || hay.includes(base);
  if (referenced) usedBytes += size;
  else { unused.push([a, size]); unusedBytes += size; }
}
unused.sort((x, y) => y[1] - x[1]);
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
console.log(`public/: ${assets.length} committed files, ${mb(usedBytes + unusedBytes)}`);
console.log(`referenced: ${assets.length - unused.length} (${mb(usedBytes)})`);
console.log(`NOT referenced anywhere: ${unused.length} (${mb(unusedBytes)})\n`);
const byDir = {};
for (const [a, s] of unused) {
  const d = a.split("/").slice(0, 3).join("/");
  byDir[d] = byDir[d] || { n: 0, b: 0 };
  byDir[d].n++; byDir[d].b += s;
}
for (const [d, v] of Object.entries(byDir).sort((a, b) => b[1].b - a[1].b)) {
  console.log(`  ${String(v.n).padStart(4)} files  ${mb(v.b).padStart(9)}  ${d}`);
}
