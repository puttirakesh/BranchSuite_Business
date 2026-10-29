// Run after the browser audit to browse and compare its screenshots locally.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const cases = new Map();
for (const folder of ['responsive-audit', 'responsive-audit-followup']) {
  const file = path.join(root, folder, 'results.json');
  if (!fs.existsSync(file)) continue;
  for (const result of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const screenshot = `${result.width}-${result.route.replace(/\//g, '_')}.png`;
    if (fs.existsSync(path.join(root, folder, screenshot))) cases.set(`${result.route}@${result.width}`, { ...result, screenshot: `${folder}/${screenshot}` });
  }
}
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const results = [...cases.values()].sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width);
const widths = [...new Set(results.map(result => result.width))].sort((a, b) => a - b);
const cards = results.map(result => `<article data-route="${escape(result.route)}" data-width="${result.width}">
<a href="${escape(result.screenshot)}" target="_blank" rel="noopener"><div class="preview"><img loading="lazy" src="${escape(result.screenshot)}" alt="${escape(result.route)} at ${result.width} pixels"></div>
<p>${escape(result.route)}</p><span>${result.width}px · Open full screenshot</span></a></article>`).join('\n');
fs.writeFileSync(path.join(root, 'responsive-gallery.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BranchSuite responsive visual review</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#17243b;font:15px system-ui,sans-serif}
header{padding:24px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:1}
h1{font-size:22px;margin:0 0 8px}header p{color:#607089;margin:0 0 16px}
.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center}label{display:flex;align-items:center;gap:8px}
input,select{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;font:inherit;max-width:100%}
input{width:280px}input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
main{padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:20px}
article{border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}article[hidden]{display:none}
a{display:block;color:inherit;text-decoration:none}.preview{height:380px;overflow:hidden;background:#e2e8f0}img{width:100%;height:auto;display:block}
article p{padding:0 16px;margin:16px 0 8px;overflow-wrap:anywhere;font-weight:600}article span{display:block;padding:0 16px 16px;color:#607089;font-size:13px}
@media(max-width:480px){header,main{padding:16px}label{flex-wrap:wrap}input{width:100%}}
</style>
<header><h1>BranchSuite responsive visual review</h1><p>Mocked data · Compare the same screen across sizes. Open an image to inspect it at full size.</p>
<div class="filters"><label>Screen <input id="route" type="search" placeholder="Filter by route"></label>
<label>Width <select id="width"><option value="">All widths</option>${widths.map(width => `<option value="${width}">${width}px</option>`).join('')}</select></label>
<output id="count" aria-live="polite"></output></div></header><main>${cards}</main>
<script>
const route=document.getElementById('route'),width=document.getElementById('width'),count=document.getElementById('count');
function filter(){let visible=0;for(const card of document.querySelectorAll('article')){card.hidden=!card.dataset.route.toLowerCase().includes(route.value.trim().toLowerCase())||!!width.value&&card.dataset.width!==width.value;if(!card.hidden)visible++}count.textContent=visible+' screenshots'}
route.addEventListener('input',filter);width.addEventListener('change',filter);filter();
</script></html>`);
console.log(`Created dist/responsive-gallery.html with ${results.length} screenshots.`);
