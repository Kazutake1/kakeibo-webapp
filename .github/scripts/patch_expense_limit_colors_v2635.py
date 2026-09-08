from pathlib import Path

# v2.6.35: highlight PC/iPad expense daily and weekly totals only when limits are exceeded.

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old = '''    if(type==='variable'){\n      const weekTotal=sum(tx.filter(t=>ds.includes(+t.date.slice(-2))).map(t=>t.amount));\n      html+=`<tr class="expense-week-total-row"><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{\n        if(!d)return '<td class="cal-cell expense-week-total-cell"></td>';\n        const date=ym()+'-'+String(d).padStart(2,'0');\n        const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));\n        return `<td class="cal-cell expense-week-total-cell"><b>${a?money(a):''}</b></td>`\n      }).join('')}<td class="cal-cell expense-week-total-cell"><b>${money(weekTotal)}</b></td></tr>`;\n    }else{'''
new = '''    if(type==='variable'){\n      const weekTotal=sum(tx.filter(t=>ds.includes(+t.date.slice(-2))).map(t=>t.amount));\n      html+=`<tr class="expense-week-total-row"><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{\n        if(!d)return '<td class="cal-cell expense-week-total-cell"></td>';\n        const date=ym()+'-'+String(d).padStart(2,'0');\n        const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));\n        return `<td class="cal-cell expense-week-total-cell"><b class="${a>2000?'expense-limit-over':''}">${a?money(a):''}</b></td>`\n      }).join('')}<td class="cal-cell expense-week-total-cell"><b class="${weekTotal>14000?'expense-limit-over':''}">${money(weekTotal)}</b></td></tr>`;\n    }else{'''
assert old in s, 'expense week total rendering block not found'
s = s.replace(old, new, 1)
app.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.35: PC/iPad expense daily and weekly limit highlighting */'
assert marker not in s, 'v2.6.35 style already exists'
s += '''\n\n/* v2.6.35: PC/iPad expense daily and weekly limit highlighting */\n.expense-week-total-cell .expense-limit-over{color:#dc2626!important}\nbody.dark-mode .expense-week-total-cell .expense-limit-over{color:#ff6b6b!important}\n'''
style.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.34' in s and 'app.js?v=2.6.34' in s, 'v2.6.34 asset refs not found'
s = s.replace('style.css?v=2.6.34', 'style.css?v=2.6.35')
s = s.replace('app.js?v=2.6.34', 'app.js?v=2.6.35')
s = s.replace('v2.6.34 Stable', 'v2.6.35 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert 'kakeibo-v2.6.34-stable' in s, 'v2.6.34 cache not found'
s = s.replace('kakeibo-v2.6.34-stable', 'kakeibo-v2.6.35-stable')
s = s.replace('./style.css?v=2.6.34', './style.css?v=2.6.35')
s = s.replace('./app.js?v=2.6.34', './app.js?v=2.6.35')
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.34 Stable'), 'README current version unexpected'
marker = '## v2.6.34 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.34 section not found'
release = '''# 家計簿Webアプリ v2.6.35 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.35 Stable\n- PC・iPad版の支出日別入力表で、1日の支出合計が2,000円を超えた場合のみ赤文字で表示\n- 同じ表で、1週間の支出合計が14,000円を超えた場合のみ赤文字で表示\n- 2,000円ちょうど・14,000円ちょうどは赤文字にしない\n- 収入表・週間比較グラフ・その他の表示や機能仕様は変更なし\n\n'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.34 cache-busting URLs', 'release assets use v2.6.35 cache-busting URLs')
s = s.replace('style.css?v=2.6.34', 'style.css?v=2.6.35')
s = s.replace('app.js?v=2.6.34', 'app.js?v=2.6.35')
name = "desktop expense daily and weekly totals turn red only above limits"
if name not in s:
    s += r'''


test('desktop expense daily and weekly totals turn red only above limits', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    current = new Date(2026, 8, 1);
    state.transactions = [
      {id:'limit-2000',date:'2026-09-01',type:'variable',category:'セブンイレブン',item:'boundary',amount:2000,amountExpression:'2000',memo:''},
      {id:'limit-2001',date:'2026-09-02',type:'variable',category:'セブンイレブン',item:'over',amount:2001,amountExpression:'2001',memo:''},
      {id:'week-over',date:'2026-09-03',type:'variable',category:'セブンイレブン',item:'week over',amount:10000,amountExpression:'10000',memo:''},
      {id:'week-boundary',date:'2026-09-07',type:'variable',category:'セブンイレブン',item:'week boundary',amount:14000,amountExpression:'14000',memo:''}
    ];
    renderCalendar();
  });

  const rows = page.locator('#expenseCalendarWrap .expense-week-total-row');
  await expect(rows).toHaveCount(5);

  const firstWeek = rows.nth(0);
  const dayAt2000 = firstWeek.locator('td').nth(2).locator('b');
  const dayAt2001 = firstWeek.locator('td').nth(3).locator('b');
  const firstWeekTotal = firstWeek.locator('td').last().locator('b');

  await expect(dayAt2000).toHaveText('¥2,000');
  await expect(dayAt2000).not.toHaveClass(/expense-limit-over/);
  await expect(dayAt2001).toHaveText('¥2,001');
  await expect(dayAt2001).toHaveClass(/expense-limit-over/);
  await expect(firstWeekTotal).toHaveText('¥14,001');
  await expect(firstWeekTotal).toHaveClass(/expense-limit-over/);

  const red = await dayAt2001.evaluate(el => getComputedStyle(el).color);
  expect(red).toBe('rgb(220, 38, 38)');

  const secondWeekTotal = rows.nth(1).locator('td').last().locator('b');
  await expect(secondWeekTotal).toHaveText('¥14,000');
  await expect(secondWeekTotal).not.toHaveClass(/expense-limit-over/);
});
'''
test.write_text(s, encoding='utf-8')
