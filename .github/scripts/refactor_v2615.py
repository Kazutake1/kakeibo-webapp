from pathlib import Path
import json
import re
import textwrap

ROOT = Path(__file__).resolve().parents[2]
index = ROOT / 'index.html'
source = index.read_text(encoding='utf-8')
if 'v2.6.14 Stable' not in source:
    raise SystemExit('Expected v2.6.14 Stable in index.html')
source = source.replace('v2.6.14 Stable', 'v2.6.15 Stable')

style_match = re.search(r'<style>\s*(.*?)\s*</style>', source, re.S)
script_match = re.search(r'<script>\s*(.*?)\s*</script>', source, re.S)
if not style_match or not script_match:
    raise SystemExit('Expected one inline style and one inline script block')

(ROOT / 'style.css').write_text(style_match.group(1).rstrip() + '\n', encoding='utf-8')
(ROOT / 'app.js').write_text(script_match.group(1).rstrip() + '\n', encoding='utf-8')

source = source[:style_match.start()] + '  <link rel="stylesheet" href="style.css" />' + source[style_match.end():]
script_match = re.search(r'<script>\s*(.*?)\s*</script>', source, re.S)
if not script_match:
    raise SystemExit('Inline script block disappeared unexpectedly')
source = source[:script_match.start()] + '<script src="app.js"></script>' + source[script_match.end():]
index.write_text(source, encoding='utf-8')

sw = ROOT / 'sw.js'
sws = sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.14-stable' not in sws:
    raise SystemExit('Expected v2.6.14 service-worker cache')
sws = sws.replace('kakeibo-v2.6.14-stable', 'kakeibo-v2.6.15-stable')
old_shell = "const APP_SHELL=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];"
new_shell = "const APP_SHELL=['./','./index.html','./style.css','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];"
if old_shell not in sws:
    raise SystemExit('Expected APP_SHELL declaration')
sw.write_text(sws.replace(old_shell, new_shell, 1), encoding='utf-8')

readme = ROOT / 'README.md'
rs = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.14 Stable' not in rs:
    raise SystemExit('Expected v2.6.14 README heading')
rs = rs.replace('# 家計簿Webアプリ v2.6.14 Stable', '# 家計簿Webアプリ v2.6.15 Stable', 1)
entry = textwrap.dedent('''\
## v2.6.15 Stable
- `index.html` に集中していたCSSを `style.css`、JavaScriptを `app.js` へ分離し、画面構造・見た目・処理の責務を整理
- Service Workerのアプリシェルに `style.css` と `app.js` を追加し、PWAのオフライン動作を維持
- PlaywrightによるUI回帰テストを追加
- ライト/ダーク両モードの収支カード、赤字表示、変動費予算超過、0円凡例、スマホ主要ナビを自動検証
- GitHub Actionsでpush / pull request時に回帰テストを自動実行
- Supabase同期、固定費自動計上、予算継承、グラフ、PWAなど既存機能は変更なし

''')
rs = rs.replace('## v2.6.14 Stable\n', entry + '## v2.6.14 Stable\n', 1)
readme.write_text(rs, encoding='utf-8')

package = {
    'name': 'kakeibo-webapp',
    'version': '2.6.15',
    'private': True,
    'scripts': {'test': 'playwright test'},
    'devDependencies': {'@playwright/test': '^1.55.0'}
}
(ROOT / 'package.json').write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

(ROOT / 'playwright.config.js').write_text(textwrap.dedent('''\
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    port: 4173,
    reuseExistingServer: true
  }
});
'''), encoding='utf-8')

tests_dir = ROOT / 'tests'
tests_dir.mkdir(exist_ok=True)
(tests_dir / 'ui-regression.spec.js').write_text(textwrap.dedent('''\
const { test, expect } = require('@playwright/test');

async function openApp(page, { theme = 'light', transactions = [] } = {}) {
  await page.addInitScript(({ theme, transactions }) => {
    localStorage.setItem('kakeibo-theme', theme);
    localStorage.setItem('kakeibo-v1', JSON.stringify({ transactions, budgets: {}, categories: {} }));
  }, { theme, transactions });
  await page.goto('/');
  await expect(page.locator('#summaryCards .metric')).toHaveCount(5);
}

function currentDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

test('light mode: balance card uses normal card background and red negative amount', async ({ page }) => {
  await openApp(page, { theme: 'light' });
  const balance = page.locator('#summaryCards .metric').nth(2);
  const value = balance.locator('.value');
  const styles = await page.evaluate(() => {
    const cards = document.querySelectorAll('#summaryCards .metric');
    const first = getComputedStyle(cards[0]);
    const balance = getComputedStyle(cards[2]);
    const value = getComputedStyle(cards[2].querySelector('.value'));
    return { firstBg: first.backgroundColor, balanceBg: balance.backgroundColor, borderWidth: balance.borderTopWidth, valueColor: value.color };
  });
  expect(styles.balanceBg).toBe(styles.firstBg);
  expect(styles.borderWidth).toBe('2px');
  expect(styles.valueColor).toBe('rgb(220, 38, 38)');
  await expect(value).toHaveClass(/neg/);
  await expect(balance.locator('.sub')).toHaveText('赤字');
});

test('dark mode: balance card stays neutral and negative amount is red', async ({ page }) => {
  await openApp(page, { theme: 'dark' });
  await expect(page.locator('body')).toHaveClass(/dark-mode/);
  const styles = await page.evaluate(() => {
    const cards = document.querySelectorAll('#summaryCards .metric');
    const first = getComputedStyle(cards[0]);
    const balance = getComputedStyle(cards[2]);
    const value = getComputedStyle(cards[2].querySelector('.value'));
    return { firstBg: first.backgroundColor, balanceBg: balance.backgroundColor, borderWidth: balance.borderTopWidth, valueColor: value.color };
  });
  expect(styles.balanceBg).toBe(styles.firstBg);
  expect(styles.borderWidth).toBe('2px');
  expect(styles.valueColor).toBe('rgb(255, 107, 107)');
  await expect(page.locator('#summaryCards .metric').nth(2).locator('.sub')).toHaveText('赤字');
});

test('positive balance is recognized as positive', async ({ page }) => {
  await openApp(page, {
    transactions: [{ id: 'income-test', date: currentDateKey(), type: 'income', category: '給与', item: 'test', amount: 300000, amountExpression: '300000', memo: '' }]
  });
  const balance = page.locator('#summaryCards .metric').nth(2);
  await expect(balance.locator('.value')).toHaveClass(/pos/);
  await expect(balance.locator('.sub')).toHaveText('黒字');
});

test('over-budget variable expense is shown in red', async ({ page }) => {
  await openApp(page, {
    transactions: [{ id: 'over-budget-test', date: currentDateKey(), type: 'variable', category: 'セブンイレブン', item: 'test', amount: 25000, amountExpression: '25000', memo: '' }]
  });
  const row = page.locator('.budget-section[data-budget-section="variable"] .row').filter({ hasText: 'セブンイレブン' }).first();
  const actual = row.locator('.actual');
  await expect(actual).toHaveClass(/neg/);
  expect(await actual.evaluate(el => getComputedStyle(el).color)).toBe('rgb(220, 38, 38)');
});

test('zero-value categories remain visible in legends', async ({ page }) => {
  await openApp(page);
  const variableRows = page.locator('#variableLegend .donut-legend-row');
  await expect(variableRows).toHaveCount(10);
  await expect(variableRows.first()).toContainText('セブンイレブン');
  await expect(variableRows.first()).toContainText('0%');
  await expect(variableRows.first()).toContainText('¥0');
  const expenseRows = page.locator('#donutLegend .donut-legend-row');
  await expect(expenseRows).toHaveCount(6);
  await expect(expenseRows.first()).toContainText('社会保険・税金');
  await expect(expenseRows.first()).toContainText('0%');
});

test('mobile bottom navigation opens the main pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  for (const key of ['expense', 'income', 'budget', 'settings', 'dashboard']) {
    await page.locator(`#mobileNav [data-tab="${key}"]`).click();
    await expect(page.locator(`section[data-panel="${key}"]`)).toHaveClass(/active/);
  }
});
'''), encoding='utf-8')

workflow_dir = ROOT / '.github' / 'workflows'
workflow_dir.mkdir(parents=True, exist_ok=True)
(workflow_dir / 'ui-regression.yml').write_text(textwrap.dedent('''\
name: UI Regression Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Static checks
        run: |
          node --check app.js
          python3 - <<'PY'
          from pathlib import Path
          import re
          s=Path('index.html').read_text(encoding='utf-8')
          assert '<link rel="stylesheet" href="style.css"' in s
          assert '<script src="app.js"></script>' in s
          assert '<style>' not in s
          ids=re.findall(r'\\bid="([^\"]+)"',s)
          assert len(ids)==len(set(ids)), 'duplicate ids'
          sw=Path('sw.js').read_text(encoding='utf-8')
          assert './style.css' in sw and './app.js' in sw
          js=Path('app.js').read_text(encoding='utf-8')
          assert 'SUPABASE_URL' in js and 'scheduleCloudSync()' in js
          assert 'effectiveTypeSum' in js
          assert 'CHART_COLORS_LIGHT' in js and 'CHART_COLORS_DARK' in js
          assert 'service_role' not in js.lower()
          PY
      - name: Run Playwright regression tests
        run: npm test
      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
'''), encoding='utf-8')

# Static checks before the workflow installs dependencies.
final_index = index.read_text(encoding='utf-8')
if '<style>' in final_index:
    raise SystemExit('Inline style remains')
if re.search(r'<script(?![^>]*\bsrc=)[^>]*>\s*\S', final_index, re.S):
    raise SystemExit('Inline JavaScript remains')
ids = re.findall(r'\bid="([^"]+)"', final_index)
if len(ids) != len(set(ids)):
    raise SystemExit('Duplicate ids found')
js = (ROOT / 'app.js').read_text(encoding='utf-8')
css = (ROOT / 'style.css').read_text(encoding='utf-8')
for token in ['SUPABASE_URL', 'scheduleCloudSync()', 'effectiveTypeSum', 'CHART_COLORS_LIGHT', 'CHART_COLORS_DARK']:
    if token not in js:
        raise SystemExit(f'Missing retained feature token: {token}')
if 'service_role' in js.lower():
    raise SystemExit('Forbidden service_role token found')
if 'body.dark-mode' not in css or 'body:not(.dark-mode)' not in css:
    raise SystemExit('Theme CSS missing')
print('Refactor files generated and static checks passed')
