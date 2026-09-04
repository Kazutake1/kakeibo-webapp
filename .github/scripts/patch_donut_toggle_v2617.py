from pathlib import Path

# Version label only; no other HTML structure changes.
index = Path('index.html')
s = index.read_text(encoding='utf-8')
if 'v2.6.16 Stable' not in s:
    raise SystemExit('Expected v2.6.16 Stable')
index.write_text(s.replace('v2.6.16 Stable', 'v2.6.17 Stable'), encoding='utf-8')

# Add compact percentage/amount toggle behavior to donut legends.
app = Path('app.js')
a = app.read_text(encoding='utf-8')
old = """function drawDonut(canvasId,legendId,data){
  let [ctx,w,h]=prepCanvas(canvasId);
  ctx.clearRect(0,0,w,h);
  const allData=data.slice();
  const drawableData=allData.map((entry,index)=>[...entry,index]).filter(x=>x[1]>0);
  let total=sum(allData.map(x=>x[1]));"""
new = """const donutLegendModes={donutLegend:'percent',variableLegend:'percent'};
function setDonutLegendMode(legendId,mode){
  if(mode!=='percent'&&mode!=='amount')return;
  donutLegendModes[legendId]=mode;
  const root=document.getElementById(legendId);
  if(!root)return;
  root.dataset.mode=mode;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>{
    const active=btn.dataset.mode===mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
}
function drawDonut(canvasId,legendId,data){
  let [ctx,w,h]=prepCanvas(canvasId);
  ctx.clearRect(0,0,w,h);
  const allData=data.slice();
  const drawableData=allData.map((entry,index)=>[...entry,index]).filter(x=>x[1]>0);
  let total=sum(allData.map(x=>x[1]));"""
if old not in a:
    raise SystemExit('drawDonut start not found')
a = a.replace(old, new, 1)
old_legend = """  document.getElementById(legendId).innerHTML=allData.map(([l,v],i)=>`<div class=\"donut-legend-row\"><div class=\"donut-legend-name\"><i class=\"dot\" style=\"background:${chartColor(i)}\"></i><span>${escapeHtml(l)}</span></div><span class=\"donut-legend-pct\">${total?Math.round(v/total*100):0}%</span><strong class=\"donut-legend-amt\">${money(v)}</strong></div>`).join('')
}"""
new_legend = """  const mode=donutLegendModes[legendId]||'percent';
  const root=document.getElementById(legendId);
  root.dataset.mode=mode;
  root.innerHTML=`<div class=\"donut-mode-toggle\" role=\"group\" aria-label=\"凡例の表示切替\"><button type=\"button\" class=\"donut-mode-btn ${mode==='percent'?'active':''}\" data-mode=\"percent\" aria-pressed=\"${mode==='percent'}\">割合</button><button type=\"button\" class=\"donut-mode-btn ${mode==='amount'?'active':''}\" data-mode=\"amount\" aria-pressed=\"${mode==='amount'}\">金額</button></div><div class=\"donut-legend-list\">${allData.map(([l,v],i)=>`<div class=\"donut-legend-row\"><div class=\"donut-legend-name\"><i class=\"dot\" style=\"background:${chartColor(i)}\"></i><span>${escapeHtml(l)}</span></div><span class=\"donut-legend-value donut-value-percent\">${total?Math.round(v/total*100):0}%</span><strong class=\"donut-legend-value donut-value-amount\">${money(v)}</strong></div>`).join('')}</div>`;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>btn.addEventListener('click',()=>setDonutLegendMode(legendId,btn.dataset.mode)));
  setDonutLegendMode(legendId,mode);
}"""
if old_legend not in a:
    raise SystemExit('drawDonut legend block not found')
a = a.replace(old_legend, new_legend, 1)
app.write_text(a, encoding='utf-8')

# Replace the iPad workaround with a cleaner shared layout driven by the compact legend.
css = Path('style.css')
c = css.read_text(encoding='utf-8')
marker = '/* v2.6.17: compact donut legend toggle */'
if marker not in c:
    c += '''

/* v2.6.17: compact donut legend toggle */
.donut-side-legend{align-self:stretch;justify-content:center}
.donut-mode-toggle{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;margin:0 0 12px;border:1px solid var(--line-soft);border-radius:12px;background:var(--header2)}
.donut-mode-btn{border:0;border-radius:9px;padding:7px 12px;background:transparent;color:var(--muted);font-size:12px;font-weight:750;line-height:1.2}
.donut-mode-btn.active{background:var(--card);color:var(--accent);box-shadow:0 1px 5px rgba(30,70,120,.10)}
.donut-legend-list{display:flex;flex-direction:column;gap:11px;min-width:0}
.donut-legend-row{grid-template-columns:minmax(0,1fr) minmax(72px,auto)}
.donut-legend-value{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.donut-side-legend[data-mode="percent"] .donut-value-amount{display:none}
.donut-side-legend[data-mode="amount"] .donut-value-percent{display:none}
.donut-value-percent{color:#70819d}
.donut-value-amount{color:#173b67;font-weight:750}
body.dark-mode .donut-value-percent{color:#a9bbd3}
body.dark-mode .donut-value-amount{color:#dce9f8}

/* With a single value column, iPad can keep the cleaner side-by-side donut layout. */
@media (min-width:701px) and (max-width:1000px){
  .donut-layout{grid-template-columns:minmax(220px,.9fr) minmax(260px,1.1fr);gap:16px;min-height:300px}
  .donut-canvas-wrap{height:270px}
  .donut-legend-row{grid-template-columns:minmax(0,1fr) minmax(68px,auto);gap:9px}
  .donut-card .card-body{padding:16px}
}
'''
css.write_text(c, encoding='utf-8')

# Cache bump.
sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.16-stable' not in w:
    raise SystemExit('Expected v2.6.16 cache')
sw.write_text(w.replace('kakeibo-v2.6.16-stable','kakeibo-v2.6.17-stable'),encoding='utf-8')

# README: record only this UI change.
readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.16 Stable' not in r:
    raise SystemExit('Expected v2.6.16 README')
r = r.replace('# 家計簿Webアプリ v2.6.16 Stable','# 家計簿Webアプリ v2.6.17 Stable',1)
entry = '''## v2.6.17 Stable
- 「支出構成」と「変動費カテゴリ」の凡例を「割合 / 金額」のワンタッチ切替方式へ変更
- 初期表示は割合。金額を選ぶと同じ位置に金額だけを表示し、項目名の表示幅を確保
- iPadではドーナツと凡例を横並びに戻し、コンパクトな2列凡例で見切れを防止
- その他の機能・表示仕様は変更なし

'''
r = r.replace('## v2.6.16 Stable\n', entry+'## v2.6.16 Stable\n',1)
readme.write_text(r,encoding='utf-8')

# Extend UI regression coverage without altering existing cases.
test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
case_name = 'donut legends switch between percentage and amount'
if case_name not in t:
    t += '''

test('donut legends switch between percentage and amount', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);

  for (const legendId of ['donutLegend','variableLegend']) {
    const legend=page.locator(`#${legendId}`);
    await expect(legend.locator('.donut-mode-btn')).toHaveCount(2);
    await expect(legend.locator('.donut-mode-btn[data-mode="percent"]')).toHaveClass(/active/);
    await expect(legend.locator('.donut-value-percent').first()).toBeVisible();
    await expect(legend.locator('.donut-value-amount').first()).toBeHidden();

    await legend.locator('.donut-mode-btn[data-mode="amount"]').click();
    await expect(legend.locator('.donut-mode-btn[data-mode="amount"]')).toHaveClass(/active/);
    await expect(legend.locator('.donut-value-percent').first()).toBeHidden();
    await expect(legend.locator('.donut-value-amount').first()).toBeVisible();
  }

  const variableCard=page.locator('.card').filter({has:page.locator('#variableDonut')}).first();
  const geometry=await variableCard.evaluate(card=>({clientWidth:card.clientWidth,scrollWidth:card.scrollWidth}));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
});
'''
test.write_text(t,encoding='utf-8')
