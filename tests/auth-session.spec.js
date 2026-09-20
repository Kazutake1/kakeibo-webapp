const {test,expect}=require('@playwright/test');

const SESSION_KEY='kakeibo-sync-session-v1';
const SUPABASE_PATTERN='https://blyyxmhehubufqzyqapq.supabase.co/**';

function session(accessToken,refreshToken,expiresAt){
  return {
    access_token:accessToken,
    refresh_token:refreshToken,
    expires_at:expiresAt,
    expires_in:3600,
    token_type:'bearer',
    user:{id:'user-1',email:'user@example.com'}
  }
}

async function seedSession(page,value){
  await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:SESSION_KEY,value})
}

async function mockCloud(page,{refreshStatus=200,refreshedSession}={}){
  const stats={refreshes:0};
  await page.route(SUPABASE_PATTERN,async route=>{
    const request=route.request();
    const url=request.url();
    if(url.includes('/auth/v1/token?grant_type=refresh_token')){
      stats.refreshes+=1;
      await route.fulfill({status:refreshStatus,contentType:'application/json',body:JSON.stringify(refreshStatus===200?refreshedSession:{message:'temporarily unavailable'})});
      return
    }
    if(url.includes('/auth/v1/user')){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'user-1',email:'user@example.com'})});
      return
    }
    if(request.method()==='GET'){
      await route.fulfill({status:200,contentType:'application/json',body:'[]'});
      return
    }
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify([{sync_version:1}])})
  });
  return stats
}

test('login form supports device password managers and keyboard submit',async({page})=>{
  await page.goto('/');
  const form=page.locator('#syncSignedOut');
  await expect(form).toHaveJSProperty('tagName','FORM');
  await expect(form).toHaveAttribute('autocomplete','on');
  await expect(page.locator('#syncEmail')).toHaveAttribute('name','email');
  await expect(page.locator('#syncEmail')).toHaveAttribute('autocomplete','username');
  await expect(page.locator('#syncPassword')).toHaveAttribute('name','password');
  await expect(page.locator('#syncPassword')).toHaveAttribute('autocomplete','current-password');
  await expect(page.locator('#syncSignInBtn')).toHaveAttribute('type','submit')
});

test('an expiring session refreshes before expiry and saves the replacement',async({page})=>{
  const oldSession=session('old-access','old-refresh',Math.floor(Date.now()/1000)+1);
  const newSession=session('new-access','new-refresh',Math.floor(Date.now()/1000)+3600);
  await seedSession(page,oldSession);
  await mockCloud(page,{refreshedSession:newSession});
  await page.goto('/');
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.access_token,SESSION_KEY)).toBe('new-access');
  await expect.poll(()=>page.locator('#syncSignedIn').evaluate(element=>element.hidden)).toBe(false);
  await expect(page.locator('#syncUserEmail')).toContainText('user@example.com')
});

test('a temporary refresh failure keeps the saved login session',async({page})=>{
  const oldSession=session('kept-access','kept-refresh',Math.floor(Date.now()/1000)+1);
  await seedSession(page,oldSession);
  const stats=await mockCloud(page,{refreshStatus:503});
  await page.goto('/');
  await expect.poll(()=>page.locator('#syncSignedIn').evaluate(element=>element.hidden)).toBe(false);
  await expect.poll(()=>stats.refreshes).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.refresh_token,SESSION_KEY)).toBe('kept-refresh')
});
