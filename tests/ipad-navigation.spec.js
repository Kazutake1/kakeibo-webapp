const {test,expect}=require('@playwright/test');

for(const browserName of ['chromium','webkit']){
  test.describe(browserName+' iPad navigation',()=>{
    for(const mode of ['iPad','desktop-site']){
      test(mode+' keeps all five tabs reachable after scrolling and rotation',async()=>{
        const browser=await require('@playwright/test')[browserName].launch();
        const page=await browser.newPage({hasTouch:true,baseURL:'http://127.0.0.1:4173'});
        try{
        await page.addInitScript(({mode})=>{
          Object.defineProperty(navigator,'platform',{get:()=>mode==='iPad'?'iPad':'MacIntel'});
          Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
          if(mode==='iPad')Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'});
        },{mode});
        await page.setViewportSize({width:1194,height:834});
        await page.goto('/');
        const tabs=page.locator('#tabs');
        await expect(tabs).toHaveClass(/ipad-fixed-tabs/);
        for(const width of [1194,1180,834]){
          await page.setViewportSize({width,height:834});
          for(const panel of ['dashboard','expense','income','budget','settings']){
            await tabs.locator('[data-tab="'+panel+'"]').click();
            await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
            await expect.poll(()=>tabs.evaluate(nav=>{
              const r=nav.getBoundingClientRect();
              const h=document.querySelector('.topbar').getBoundingClientRect();
              return r.top>=h.bottom-1&&r.bottom<innerHeight&&r.left>=0&&r.right<=innerWidth+1;
            })).toBe(true);
            for(const label of ['概要','支出','収入','予算','設定']){
              const button=tabs.getByRole('button',{name:label,exact:true});
              await expect(button).toBeVisible();
              expect(await button.evaluate(el=>{
                const r=el.getBoundingClientRect();
                return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
              })).toBe(true);
            }
          }
        }
        await page.setViewportSize({width:600,height:834});
        await expect(tabs).not.toHaveClass(/ipad-fixed-tabs/);
        await expect(page.locator('#mobileNav')).toBeVisible();
        }finally{await browser.close()}
      });
    }
  });
}

test('PC keeps its existing navigation rules without the iPad override',async({page})=>{
  await page.goto('/');
  for(const width of [1024,1280,1440]){
    await page.setViewportSize({width,height:900});
    const tabs=page.locator('#tabs');
    await expect(tabs).not.toHaveClass(/ipad-fixed-tabs/);
    const expected=width<=1366?'sticky':'static';
    expect(await tabs.evaluate(el=>getComputedStyle(el).position)).toBe(expected);
    if(expected==='sticky'){
      await page.evaluate(()=>window.scrollTo(0,1000));
      expect((await tabs.boundingBox()).y).toBeGreaterThanOrEqual(59);
    }
  }
});
