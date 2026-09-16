from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, f'{label}: expected exactly one match, got {count}'
    return text.replace(old, new, 1)


css_path = Path('style.css')
css = css_path.read_text(encoding='utf-8')
selector = '.expense-panel #expenseMonthCalendar .mobile-cal-day:not(.empty)'
assert selector not in css, 'Expense calendar alignment rule already exists'
css += '''\n\n/* v2.6.50: align expense calendar dates to the top, with or without an amount. */
@media(max-width:700px){
  .expense-panel #expenseMonthCalendar .mobile-cal-day:not(.empty){
    display:flex;
    flex-direction:column;
    align-items:stretch;
    justify-content:flex-start;
  }
}
'''
css_path.write_text(css, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = replace_once(index, 'style.css?v=2.6.49', 'style.css?v=2.6.50', 'stylesheet version')
index = replace_once(index, 'app.js?v=2.6.49', 'app.js?v=2.6.50', 'JavaScript cache URL')
index_path.write_text(index, encoding='utf-8')

sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
assert sw.count('2.6.49') == 3, 'Unexpected service worker version references'
sw_path.write_text(sw.replace('2.6.49', '2.6.50'), encoding='utf-8')

readme_path = Path('README.md')
readme = readme_path.read_text(encoding='utf-8')
readme = replace_once(readme, '# 家計簿Webアプリ v2.6.49 Stable', '# 家計簿Webアプリ v2.6.50 Stable', 'README title')
readme = replace_once(readme, '## v2.6.49 Stable', '''## v2.6.50 Stable
- iPhone版の支出カレンダーだけ、金額がある日とない日の日付を同じ上端に配置
- 日付・金額の内容や日付選択の挙動、収入画面、iPad・PC、データ保存・同期は変更なし

## v2.6.49 Stable''', 'README release note')
readme_path.write_text(readme, encoding='utf-8')

test_path = Path('tests/ui-regression.spec.js')
tests = test_path.read_text(encoding='utf-8')
assert tests.count('2.6.49') >= 3, 'Expected asset version assertions absent'
tests = tests.replace('2.6.49', '2.6.50')
assert 'aligns dates regardless of whether an expense amount exists' not in tests
# Geometry assertion tests the actual bug; merely checking CSS selectors is insufficient.
tests += '''

test('iPhone expense calendar aligns dates regardless of whether an expense amount exists', async ({page})=>{
  const month=currentDateKey().slice(0,7);
  const spentDate=`${month}-05`;
  const emptyDate=`${month}-06`;
  const transactions=[{
    id:'expense-date-alignment',date:spentDate,type:'variable',category:'セブンイレブン',
    item:'calendar test',amount:850,amountExpression:'850',memo:''
  }];
  for(const theme of ['light','dark']){
    for(const width of [320,375,390,430]){
      await page.setViewportSize({width,height:844});
      await openApp(page,{theme,transactions});
      await page.locator('#mobileNav [data-tab="expense"]').click();
      const spent=page.locator(`#expenseMonthCalendar [data-expense-date="${spentDate}"]`);
      const empty=page.locator(`#expenseMonthCalendar [data-expense-date="${emptyDate}"]`);
      await expect(spent.locator('.mobile-cal-money')).toHaveText('¥850');
      await expect(empty.locator('.mobile-cal-money')).toHaveCount(0);
      const positions=await page.locator(`#expenseMonthCalendar [data-expense-date="${spentDate}"], #expenseMonthCalendar [data-expense-date="${emptyDate}"]`).evaluateAll(cells=>cells.map(cell=>{
        const cellRect=cell.getBoundingClientRect();
        const dateRect=cell.querySelector('.mobile-cal-date').getBoundingClientRect();
        const amount=cell.querySelector('.mobile-cal-money');
        const amountRect=amount?.getBoundingClientRect();
        return {dateTop:dateRect.top-cellRect.top,dateBottom:dateRect.bottom,amountTop:amountRect?.top??null,cellHeight:cellRect.height,display:getComputedStyle(cell).display};
      }));
      expect(positions).toHaveLength(2);
      expect(positions[0].display).toBe('flex');
      expect(positions[1].display).toBe('flex');
      expect(Math.abs(positions[0].dateTop-positions[1].dateTop)).toBeLessThanOrEqual(1);
      expect(Math.abs(positions[0].dateTop-7)).toBeLessThanOrEqual(1);
      expect(positions[0].amountTop).toBeGreaterThan(positions[0].dateBottom);
      expect(positions[0].cellHeight).toBeGreaterThanOrEqual(64);
      expect(positions[1].cellHeight).toBeGreaterThanOrEqual(64);
      await empty.click();
      await expect(page.locator('#expenseDateLabel')).toContainText('6日');
      await expect(page.locator('#expenseDayTotal')).toHaveText('¥0');
      await expect(spent.locator('.mobile-cal-money')).toHaveText('¥850');
    }
  }
  // No desktop/tablet layout rules were altered by the phone-only selector.
  for(const width of [820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page,{transactions});
    await page.locator('#tabs [data-tab="expense"]').click();
    await expect(page.locator('#expenseMonthCalendar')).toBeHidden();
    await expect(page.locator('#expenseCalendarWrap .cal-table')).toBeVisible();
  }
});
'''
test_path.write_text(tests, encoding='utf-8')
