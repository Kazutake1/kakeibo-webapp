from pathlib import Path

# app.js: hide income and tax only from the budget setting UI and budget edit dialog.
app=Path('app.js')
a=app.read_text(encoding='utf-8')
old="function renderBudgetEditor(){const b=getBudget();budgetEditor.innerHTML=TYPES.map(t=>"
new="function renderBudgetEditor(){const b=getBudget();const budgetTypes=TYPES.filter(t=>t.key!=='income'&&t.key!=='tax');budgetEditor.innerHTML=budgetTypes.map(t=>"
if old not in a:
    raise SystemExit('renderBudgetEditor target not found')
a=a.replace(old,new,1)
old="    TYPES.map(t=>`<h3>${t.label}</h3><div class=\"form-grid\">${catsFor(t.key).map(c=>`<div class=\"field\"><label>${escapeHtml(c)}</label><input type=\"number\" min=\"0\" data-budget-type=\"${t.key}\" data-budget-cat=\"${escapeHtml(c)}\" value=\"${b[t.key]?.[c]||0}\"></div>`).join('')||'<div class=\"hint\">項目がありません</div>'}</div>`).join('');"
new="    TYPES.filter(t=>t.key!=='income'&&t.key!=='tax').map(t=>`<h3>${t.label}</h3><div class=\"form-grid\">${catsFor(t.key).map(c=>`<div class=\"field\"><label>${escapeHtml(c)}</label><input type=\"number\" min=\"0\" data-budget-type=\"${t.key}\" data-budget-cat=\"${escapeHtml(c)}\" value=\"${b[t.key]?.[c]||0}\"></div>`).join('')||'<div class=\"hint\">項目がありません</div>'}</div>`).join('');"
if old not in a:
    raise SystemExit('openBudget target not found')
a=a.replace(old,new,1)
app.write_text(a,encoding='utf-8')

# Version label.
index=Path('index.html')
s=index.read_text(encoding='utf-8')
if 'v2.6.17 Stable' not in s:
    raise SystemExit('Expected v2.6.17 Stable in index')
index.write_text(s.replace('v2.6.17 Stable','v2.6.18 Stable'),encoding='utf-8')

# Service worker cache bump.
sw=Path('sw.js')
w=sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.17-stable' not in w:
    raise SystemExit('Expected v2.6.17 cache')
sw.write_text(w.replace('kakeibo-v2.6.17-stable','kakeibo-v2.6.18-stable'),encoding='utf-8')

# README: record only this requested change.
readme=Path('README.md')
r=readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.17 Stable' not in r:
    raise SystemExit('Expected v2.6.17 README')
r=r.replace('# 家計簿Webアプリ v2.6.17 Stable','# 家計簿Webアプリ v2.6.18 Stable',1)
entry='''## v2.6.18 Stable
- 予算ページの予算設定から「収入」と「社会保険・税金」を非表示
- 「予算を編集」ダイアログでも同2項目を非表示
- 内部データ構造、項目管理、集計、同期など他の機能は変更なし

'''
r=r.replace('## v2.6.17 Stable\n',entry+'## v2.6.17 Stable\n',1)
readme.write_text(r,encoding='utf-8')

# Regression test for this exact UI change.
test=Path('tests/ui-regression.spec.js')
t=test.read_text(encoding='utf-8')
name='budget page hides income and tax budget sections'
if name not in t:
    t += '''

test('budget page hides income and tax budget sections', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-tab="budget"]').first().click();
  const budgetEditor=page.locator('#budgetEditor');
  await expect(budgetEditor).toBeVisible();
  await expect(budgetEditor).not.toContainText('収入');
  await expect(budgetEditor).not.toContainText('社会保険・税金');
  await expect(budgetEditor).toContainText('貯蓄');
  await expect(budgetEditor).toContainText('固定費');
  await expect(budgetEditor).toContainText('変動費');

  await budgetEditor.getByRole('button',{name:'予算を編集'}).click();
  const dialog=page.locator('#budgetDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('社会保険・税金');
  await expect(dialog.locator('[data-budget-type="income"]')).toHaveCount(0);
  await expect(dialog.locator('[data-budget-type="tax"]')).toHaveCount(0);
  await expect(dialog.locator('[data-budget-type="fixed"]')).not.toHaveCount(0);
});
'''
test.write_text(t,encoding='utf-8')
