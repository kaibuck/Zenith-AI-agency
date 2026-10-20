// Bundles public/ into a single self-contained HTML file for uploading to any static host.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
const out = path.join(__dirname, '..', 'zenith-ai-website.html');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  .replace('<link rel="stylesheet" href="/styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script src="/main.js" defer></script>', () => `<script>\n${js}</script>`);

if (html.includes('href="/styles.css"') || html.includes('src="/main.js"')) {
  throw new Error('Failed to inline styles.css or main.js');
}
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(1)} KB)`);
