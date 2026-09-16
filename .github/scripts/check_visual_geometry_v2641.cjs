const { chromium }=require('@playwright/test');
const fs=require('node:fs');
const file='/tmp/kakeibo-v2641-layout.json';
const compare=process.argv.includes('--compare');
const selectors=[
  '.topbar','.topbar-inner','.brand','.monthnav','.monthnav button',
  '.container','.desktop-tabs','.desktop-tabs .tab','.mobile-nav','.mobile-nav button',
  'section.panel.active','#mobileQuickEntry','#mobileQuickEntry .mobile-quick-head',
  '#quickCategory','#quickItem','#quickAmount','#quickSaveBtn',
  '#mobileFullEntry','#mobileFullEntry .mobile-full-head','#quickFullBtn',
  '#summaryCards','#summaryCards .metric','.grid','.grid>.card',
  '.mobile-daily','.mobile-month-calendar','.mobile-day-card','.day-nav-btn',
  '.expense-history-card','.expense-history-filters','.expense-history-filter',
  '#budgetEditor','.budget-section','.settings-box','.settings-box>.card',
  '.sync-status-row','.sync-auth-actions button','.field input','.field select',
  '.toolbar button','.card .card-body'
];
async function main(){
  const browser=await chromium.launch({headless:true});
  const data={};
  try {
    for(const width of [390,820,1440]){
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
      await context.addInitScript(()=>{
        localStorage.setItem('kakeibo-theme','light');
        localStorage.setItem('kakeibo-v1',JSON.stringify({transactions:[],budgets:{},categories:{}}));
      });
      const page=await context.newPage();
      await page.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
      await page.waitForSelector('#summaryCards .metric');
      for(const panel of ['dashboard','expense','income','budget','settings']){
        if(panel!=='dashboard'){
          const nav=width<=700?'#mobileNav':'#tabs';
          await page.locator(`${nav} [data-tab="${panel}"]`).click();
        }
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        data[`${width}/${panel}`]=await page.evaluate((selectors)=>{
          const result={};
          for(const selector of selectors){
            result[selector]=Array.from(document.querySelectorAll(selector)).map(el=>{
              const r=el.getBoundingClientRect();
              return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10);
            });
          }
          return result;
        },selectors);
      }
      await context.close();
    }
  }finally{await browser.close()}
  if(!compare){fs.writeFileSync(file,JSON.stringify(data));console.log('Baseline saved for 3 widths x 5 panels');return}
  const previous=JSON.parse(fs.readFileSync(file,'utf8'));
  let checked=0;
  for(const key of Object.keys(previous)){
    if(!data[key])throw Error(`Missing screen ${key}`);
    for(const selector of selectors){
      const a=previous[key][selector],b=data[key][selector];
      if(a.length!==b.length)throw Error(`Element count changed: ${key} ${selector}`);
      for(let i=0;i<a.length;i++)for(let n=0;n<4;n++){
        checked++;
        if(Math.abs(a[i][n]-b[i][n])>1){
          throw Error(`Layout changed ${key} ${selector}[${i}] coordinate ${n}: ${a[i][n]} -> ${b[i][n]}`);
        }
      }
    }
  }
  console.log(`PASS: ${checked} card, button, input and page geometry coordinates unchanged across phone, iPad and desktop`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
