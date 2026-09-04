from pathlib import Path

css=Path('style.css')
c=css.read_text(encoding='utf-8')
marker='/* v2.6.17: iPad full-width donut cards */'
if marker not in c:
    c += '''

/* v2.6.17: iPad full-width donut cards */
@media (min-width:701px) and (max-width:1366px){
  .grid>.donut-card{grid-column:1/-1}
  .donut-card .donut-layout{grid-template-columns:minmax(220px,.85fr) minmax(280px,1.15fr);gap:20px;min-height:300px}
  .donut-card .donut-canvas-wrap{height:280px}
  .card:has(#variableDonut) .donut-layout{grid-template-columns:minmax(220px,.85fr) minmax(280px,1.15fr)}
}
'''
css.write_text(c,encoding='utf-8')

test=Path('tests/ui-regression.spec.js')
t=test.read_text(encoding='utf-8')
name='iPad donut cards use full width with side-by-side legend'
if name not in t:
    t += '''

test('iPad donut cards use full width with side-by-side legend', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  for (const canvasId of ['donutChart','variableDonut']) {
    const card=page.locator('.card').filter({has:page.locator(`#${canvasId}`)}).first();
    const layout=card.locator('.donut-layout');
    const columns=await layout.evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length);
    expect(columns).toBeGreaterThanOrEqual(2);
    const geometry=await card.evaluate(el=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
  }
});
'''
test.write_text(t,encoding='utf-8')
