// Run after npm run build. Uses port 3197, mocked CJ, synthetic credentials and a temporary DB.
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'ys-http-'));
const origin='http://localhost:3197';
const key=randomBytes(32).toString('hex');
const fixture={code:200,result:true,data:{pid:'http-p',productNameEn:'HTTP fixture case',productSku:'HTTP-P',productImageSet:['https://cf.cjdropshipping.com/example.jpg'],packingWeight:'90',productProEnSet:['COMMON'],variants:[{pid:'http-p',vid:'http-v',variantNameEn:'Clear',variantKey:'Clear',variantSellPrice:'3.40',inventories:[{countryCode:'CN',totalInventory:12,cjInventory:2,factoryInventory:10}]}]}};
const mock=join(dir,'mock.mjs');
writeFileSync(mock,`const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
if(u.hostname!=='developers.cjdropshipping.com')return original(input,init);
if(u.pathname.endsWith('/authentication/getAccessToken'))return Response.json({code:200,result:true,data:{accessToken:'fixture-token',accessTokenExpiryDate:new Date(Date.now()+3600000).toISOString()}});
if(u.pathname.endsWith('/product/query')&&u.searchParams.get('pid')==='http-p')return Response.json(${JSON.stringify(fixture)});
throw Error('Unexpected CJ call in smoke test');
};`);
let server;
let logs='';
async function start(){
  logs='';
  server=spawn(process.execPath,['--import',mock,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3197'],{cwd:process.cwd(),env:{...process.env,APP_ORIGIN:origin,ADMIN_KEY:key,SESSION_SECRET:randomBytes(32).toString('hex'),DATABASE_PATH:join(dir,'db.sqlite'),CJ_API_KEY:'fixture-key'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
  for(let n=0;n<120;n++){
    if(server.exitCode!==null)throw Error('Test server exited: '+logs);
    try{const r=await fetch(origin+'/api/products');if(r.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,250));
  }throw Error('Server not ready: '+logs);
}
async function stop(){if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}}
let cookie='';
async function request(path,body,authed=true,requestOrigin=origin,method){
  const r=await fetch(origin+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'Content-Type':'application/json',origin:requestOrigin}),...(authed&&cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await r.json();
  assert.ok(!JSON.stringify(value).includes('fixture-key'));
  assert.ok(!JSON.stringify(value).includes('fixture-token'));
  return {r,value};
}
async function login(){const {r}=await request('/api/admin/login',{key});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];}
try{
  await start();
  assert.equal((await request('/api/admin/supplier/import',undefined,false)).r.status,401);
  assert.equal((await request('/api/admin/supplier/import',{productId:'http-p',variantId:'http-v'},false)).r.status,401);
  assert.equal((await request('/api/admin/supplier/detail',{productId:'http-p'},false)).r.status,401);
  await login();
  assert.equal((await request('/api/admin/supplier/import',{productId:'http-p',variantId:'http-v'},true,'https://evil.test')).r.status,403);
  assert.equal((await request('/api/admin/supplier/detail',{productId:'http-p'},true,'https://evil.test')).r.status,403);
  assert.equal((await request('/api/admin/supplier/import',{productId:'http-p',variantId:'http-v',priceCents:1,status:'published'})).r.status,400);
  const detail=await request('/api/admin/supplier/detail',{productId:'http-p'});
  assert.equal(detail.r.status,200);assert.equal(detail.value.product.variants[0].currency,'USD');
  assert.equal((await request('/api/admin/supplier/import',{productId:'http-p',variantId:'wrong'})).r.status,400);
  const imported=await request('/api/admin/supplier/import',{productId:'http-p',variantId:'http-v'});
  assert.equal(imported.r.status,201);assert.equal(imported.value.product.status,'draft');assert.equal(imported.value.published,false);assert.equal(imported.value.orderPlaced,false);
  assert.equal(imported.r.headers.get('cache-control'),'no-store');
  const retry=await request('/api/admin/supplier/import',{productId:'http-p',variantId:'http-v'});
  assert.equal(retry.r.status,200);assert.equal(retry.value.created,false);assert.equal(retry.value.product.id,imported.value.product.id);
  const publicProducts=(await request('/api/products')).value.products;
  assert.equal(publicProducts.length,6);assert.ok(!publicProducts.some(p=>p.id===imported.value.product.id));
  const order=await request('/api/orders',{idempotencyKey:crypto.randomUUID(),customer:{name:'Test Buyer',email:'buyer@example.com',phone:'+60123456789',address:'123 Test Street',city:'Kuala Lumpur',postcode:'50000',state:'Kuala Lumpur',country:'MY'},items:[{id:imported.value.product.id,option:'Clear',qty:1}],paymentScenario:'approve'});
  assert.equal(order.r.status,409);
  const id=imported.value.product.id;
  const editPath='/api/admin/drafts/'+id;
  const editPage='/admin/drafts/'+id;
  const previewPath=editPage+'/preview';
  const fields={name:'Edited fixture title',description:'Draft description <script>alert(1)</script>\nSecond line',images:['/assets/phone.jpg','/assets/cap.jpg'],category:'Fashion',sellingPriceMYR:'49.29',processingEstimate:'3 business days',deliveryEstimate:'10 business days to Malaysia',version:imported.value.product.createdAt};
  assert.equal((await request(editPath,undefined,false)).r.status,401);
  assert.equal((await request(editPath,fields,false,origin,'PATCH')).r.status,401);
  assert.equal((await request(editPath,fields,true,'https://evil.test','PATCH')).r.status,403);
  for(const path of [editPage,previewPath]){
    const denied=await fetch(origin+path,{redirect:'manual'});
    assert.equal(denied.status,307);assert.equal(denied.headers.get('location'),'/admin');
    assert.ok(!(await denied.text()).includes('HTTP fixture case'));
  }
  assert.equal((await request(editPath,{...fields,status:'published'},true,origin,'PATCH')).r.status,400);
  const edit=await request(editPath,fields,true,origin,'PATCH');
  assert.equal(edit.r.status,200);assert.equal(edit.value.product.priceCents,4929);assert.equal(edit.value.product.status,'draft');
  assert.equal(edit.value.product.supplierProductId,'http-p');assert.equal(edit.value.product.supplierVariantId,'http-v');
  assert.equal((await request(editPath,fields,true,origin,'PATCH')).r.status,409);
  const loaded=(await request(editPath)).value.product;
  assert.deepEqual(loaded,edit.value.product);
  const editor=await fetch(origin+editPage,{headers:{cookie}});
  assert.equal(editor.status,200);
  const editorHtml=await editor.text();
  assert.ok(editorHtml.includes('Edited fixture title'));assert.ok(editorHtml.includes('49.29'));
  const preview=await fetch(origin+previewPath,{headers:{cookie}});
  assert.equal(preview.status,200);assert.ok(preview.headers.get('cache-control').includes('no-store'));
  const html=await preview.text();
  for(const content of ['Edited fixture title','49.29','Fashion accessories','/assets/phone.jpg','/assets/cap.jpg','3 business days','10 business days to Malaysia','Not published'])assert.ok(html.includes(content),content);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html,/<button[^>]*disabled/);
  assert.ok(!(await request('/api/products')).value.products.some(p=>p.id===id));
  await stop();await start();await login();
  assert.equal((await request(editPath)).value.product.name,'Edited fixture title');
  const afterRestart=await fetch(origin+previewPath,{headers:{cookie}});
  assert.equal(afterRestart.status,200);assert.ok((await afterRestart.text()).includes('Edited fixture title'));

  const drafts=(await request('/api/admin/supplier/import')).value.products;
  assert.equal(drafts.length,1);assert.equal(drafts[0].id,imported.value.product.id);assert.equal(drafts[0].supplierSnapshot.variant.supplierPrice,'3.40');
  const version=(await request(editPath)).value.product.revision;
  const publishBody={...fields,version,action:'publish',testStock:4};
  assert.equal((await request(editPath,{...publishBody,deliveryEstimate:''},true,origin,'PATCH')).r.status,400);
  assert.equal((await request(editPath,publishBody,false,origin,'PATCH')).r.status,401);
  assert.equal((await request(editPath,publishBody,true,'https://evil.test','PATCH')).r.status,403);
  if(!process.env.PLAYWRIGHT_MODULE){
    const published=await request(editPath,publishBody,true,origin,'PATCH');
    assert.equal(published.r.status,200);assert.equal(published.value.product.status,'published');
  }
  if(process.env.PLAYWRIGHT_MODULE){
    const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
    const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
    try{
      const page=await browser.newPage();
      await page.context().addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
      await page.goto(origin+editPage,{waitUntil:'domcontentloaded'});
      await page.getByLabel('Local Test Stock (test inventory)',{exact:true}).fill('4');
      const publishRequest=page.waitForRequest(req=>req.url()===origin+editPath&&req.method()==='PATCH');
      await page.getByRole('button',{name:'Publish to local shop',exact:true}).click();
      assert.equal((await publishRequest).postDataJSON().testStock,4);
      await page.getByText('Published in the local shop. Checkout remains test-only.',{exact:true}).waitFor();
      assert.equal((await request(editPath)).value.product.status,'published');
      const measurements=[];
      const artifactDir=join(process.cwd(),'artifacts','publishing');mkdirSync(artifactDir,{recursive:true});
      for(const width of [390,1280]){
        await page.setViewportSize({width,height:900});
        await page.goto(origin+previewPath);
        await page.locator('.product-detail-image img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
        const frames=await page.locator('.product-detail-image').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el.querySelector('img'));return {width:r.width,height:r.height,fit:style.objectFit,position:style.objectPosition,padding:style.padding,overflow:document.documentElement.scrollWidth>innerWidth};}));
        for(const m of frames){assert.ok(Math.abs(m.width/m.height-4/3)<0.01);assert.ok(m.width<=400);assert.equal(m.fit,'contain');assert.equal(m.position,'50% 50%');assert.equal(m.padding,'12px');assert.equal(m.overflow,false);}
        measurements.push({view:'preview',viewport:width,frames});
        await page.goto(origin);
        await page.getByRole('button',{name:'View Edited fixture title',exact:true}).waitFor();
        await page.getByRole('button',{name:'View Edited fixture title',exact:true}).locator('img').evaluate(img=>img.decode());
        const catalogue=await page.getByRole('button',{name:'View Edited fixture title',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el.querySelector('img'));return {width:r.width,height:r.height,fit:style.objectFit,position:style.objectPosition};});
        measurements.push({view:'catalogue',viewport:width,...catalogue});
        assert.ok(Math.abs(catalogue.width/catalogue.height-4/3)<0.01);assert.equal(catalogue.fit,'contain');assert.equal(catalogue.position,'50% 50%');

        await page.getByRole('button',{name:'View Edited fixture title',exact:true}).click();
        await page.getByText('Delivery: 10 business days to Malaysia',{exact:true}).waitFor();
        await page.locator('.product-detail-image img').evaluate(img=>img.decode());
        measurements.push(await page.locator('.product-detail-image').evaluate(el=>{
          const r=el.getBoundingClientRect(),img=el.querySelector('img'),style=getComputedStyle(img);
          return {width:r.width,height:r.height,fit:style.objectFit,position:style.objectPosition,padding:style.padding,src:img.getAttribute('src'),overflow:document.documentElement.scrollWidth>innerWidth};
        }));
        const m=measurements.at(-1);
        assert.ok(Math.abs(m.width/m.height-4/3)<0.01);assert.ok(m.width<=400);
        assert.equal(m.fit,'contain');assert.equal(m.position,'50% 50%');assert.equal(m.padding,'12px');assert.equal(m.src,'/assets/phone.jpg');assert.equal(m.overflow,false);

        await page.getByRole('button',{name:'Add to bag →',exact:true}).click();
        await page.waitForFunction(id=>(localStorage.getItem('ys-local-bag')||'').includes(id),id);
      }
      writeFileSync(join(artifactDir,'measurements.json'),JSON.stringify(measurements,null,2));
      console.log('PASS: browser Edit/Publish, product visibility, mobile/desktop catalogue/detail/preview layout and add-to-bag.',JSON.stringify(measurements));
    }finally{await browser.close();}
  }
  assert.equal((await request('/api/products')).value.products.find(p=>p.id===id).priceCents,4929);
  await stop();await start();await login();
  assert.equal((await request(editPath)).value.product.status,'published');
  assert.ok((await request('/api/products')).value.products.some(p=>p.id===id));
  console.log('PASS: draft editing HTTP auth/CSRF, protected fields, saved values, reload, stale-edit conflict, protected editor and preview, escaped text, disabled purchase, preserved CJ IDs, draft exclusion, publication validation and visibility, and draft/published persistence after server restart.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
