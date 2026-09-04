from pathlib import Path

# Hide the small native date picker on smartphone and iPad layouts only.
style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.22: hide compact date picker on smartphone and iPad */'
if marker not in s:
    s += '\n\n' + marker + '\n@media (max-width:1366px){\n  .daily-native-date{display:none!important}\n}\n'
style.write_text(s, encoding='utf-8')

# Bump visible version only.
index = Path('index.html')
i = index.read_text(encoding='utf-8')
i = i.replace('v2.6.21 Stable','v2.6.22 Stable')
index.write_text(i, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.22 Stable' not in r:
    r = r.replace('# 家計簿Webアプリ v2.6.21 Stable', '# 家計簿Webアプリ v2.6.22 Stable', 1)
    insert = '\n## v2.6.22 Stable\n- iPad版の支出・収入ページでも、選択日の下に表示されていた小さな日付カレンダー入力を非表示\n- スマホ版の非表示仕様は維持\n- その他の機能・表示仕様は変更なし\n'
    pos = r.find('\n## v2.6.21 Stable')
    r = r[:pos] + insert + r[pos:] if pos >= 0 else r + insert
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8').replace("kakeibo-v2.6.21-stable","kakeibo-v2.6.22-stable")
sw.write_text(w, encoding='utf-8')
