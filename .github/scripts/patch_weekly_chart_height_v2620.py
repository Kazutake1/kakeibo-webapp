from pathlib import Path

style=Path('style.css')
css=style.read_text(encoding='utf-8')
marker='/* v2.6.20: taller weekly chart on iPad and desktop */'
if marker not in css:
    css += '\n\n/* v2.6.20: taller weekly chart on iPad and desktop */\n@media (min-width:701px) and (max-width:1000px){\n  .weekly-canvas{height:350px;min-height:350px}\n}\n@media (min-width:1001px){\n  .weekly-canvas{height:400px;min-height:400px}\n}\n'
style.write_text(css,encoding='utf-8')

index=Path('index.html')
html=index.read_text(encoding='utf-8')
html=html.replace('v2.6.19 Stable','v2.6.20 Stable')
index.write_text(html,encoding='utf-8')

sw=Path('sw.js')
s=sw.read_text(encoding='utf-8')
s=s.replace("kakeibo-v2.6.19-stable","kakeibo-v2.6.20-stable")
sw.write_text(s,encoding='utf-8')

readme=Path('README.md')
r=readme.read_text(encoding='utf-8')
r=r.replace('# 家計簿Webアプリ v2.6.19 Stable','# 家計簿Webアプリ v2.6.20 Stable',1)
entry='## v2.6.20 Stable\n- iPadの「変動費 週間比較」棒グラフの高さを350pxへ拡大\n- PCの「変動費 週間比較」棒グラフの高さを400pxへ拡大\n- スマホ版およびその他の機能・表示仕様は変更なし\n\n'
if '## v2.6.20 Stable' not in r:
    pos=r.find('\n## v2.6.19 Stable')
    r=r[:pos+1]+entry+r[pos+1:]
readme.write_text(r,encoding='utf-8')
