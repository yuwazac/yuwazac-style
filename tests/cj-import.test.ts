import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseCJDetail,cjImage} from '../lib/cj-detail.ts';
import {getCJDetail} from '../lib/cj.ts';
import {db,listProducts,listOrders,listDraftProducts,importCJDraft,createOrder} from '../lib/db.ts';
import {seedProducts} from '../lib/catalog.ts';

const directory=mkdtempSync(join(tmpdir(),'ys-cj-tests-'));
process.env.DATABASE_PATH=join(directory,'legacy.sqlite');
// Reproduce the prior schema with existing stock and order data before opening the app DB.
const legacy=new DatabaseSync(process.env.DATABASE_PATH);
legacy.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0));
CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT INTO settings VALUES('seeded','1');
CREATE TABLE orders(id TEXT PRIMARY KEY,idempotency TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL,customer TEXT NOT NULL,items TEXT NOT NULL,subtotal INTEGER NOT NULL,shipping INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,tracking TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
INSERT INTO orders VALUES('existing-order','existing-key','hash','{}','[]',100,800,900,'test_received','','2026-01-01');`);
legacy.prepare('INSERT INTO products VALUES(?,?,?)').run('case',JSON.stringify(seedProducts[0]),7);
legacy.close();
const raw={code:200,result:true,data:{pid:'cj-p',productNameEn:'Phone case',productSku:'CJ-P',bigImage:'https://cf.cjdropshipping.com/main.jpg',productImageSet:['https://cf.cjdropshipping.com/main.jpg','javascript:alert(1)','https://example.com/untrusted.jpg'],sellPrice:'2.00-3.00',packingWeight:'120',productProEnSet:['COMMON'],addMarkStatus:0,description:'<script>alert(1)</script>',variants:[{pid:'cj-p',vid:'cj-v',variantNameEn:'Clear iPhone 15',variantKey:'Clear-iPhone15',variantSku:'CJ-P-CLEAR',variantImage:'https://cf.cjdropshipping.com/variant.jpg',variantSellPrice:2.5,variantWeight:100,variantLength:150,variantWidth:80,variantHeight:10,inventories:[{countryCode:'CN',totalInventory:5,cjInventory:0,factoryInventory:5,verifiedWarehouse:2}]},{pid:'cj-p',vid:'cj-v2',variantSellPrice:null,inventories:null}]}};

test('detail preserves supplier units, safe images, variant stock, and unknown values',()=>{
  const detail=parseCJDetail(raw,'cj-p');
  assert.deepEqual(detail.images,['https://cf.cjdropshipping.com/main.jpg']);
  assert.equal(detail.priceCurrency,null);
  assert.equal(detail.variants[0].supplierPrice,'2.5');
  assert.equal(detail.variants[0].currency,'USD');
  assert.equal(detail.variants[0].inventories[0].cj,0);
  assert.equal(detail.variants[0].inventories[0].factory,5);
  assert.equal(detail.shipping.freeShippingFlag,false);
  assert.equal(detail.variants[1].supplierPrice,null);
  assert.deepEqual(detail.variants[1].inventories,[]);
  assert.ok(!('description' in detail));
  assert.equal(cjImage('https://cjdropshipping.com.evil.test/a.jpg'),null);
  assert.equal(cjImage('http://cf.cjdropshipping.com/a.jpg'),null);
  assert.equal(cjImage('https://user:pass@cf.cjdropshipping.com/a.jpg'),null);
});
test('malformed responses and mismatched or duplicate variant identities fail closed',()=>{
  assert.throws(()=>parseCJDetail({code:200,result:true,data:null},'cj-p'),/unexpected/);
  assert.throws(()=>parseCJDetail(raw,'wrong'),/identifiers/);
  assert.throws(()=>parseCJDetail({...raw,data:{...raw.data,variants:[{...raw.data.variants[0],pid:'other'}]}},'cj-p'),/identifiers/);
  assert.throws(()=>parseCJDetail({...raw,data:{...raw.data,variants:[raw.data.variants[0],raw.data.variants[0]]}},'cj-p'),/identifiers/);
  assert.throws(()=>parseCJDetail({...raw,data:{...raw.data,variants:[{...raw.data.variants[0],inventories:[{totalInventory:-1}]}]}},'cj-p'),/unexpected/);
});
test('legacy migration keeps stock and orders, imports just one variant, persists and deduplicates',()=>{
  assert.equal(listProducts().length,1);
  assert.equal(listProducts()[0].stock,7);
  assert.equal(listOrders()[0].id,'existing-order');
  const detail=parseCJDetail(raw,'cj-p');
  const first=importCJDraft(detail,'cj-v');
  assert.equal(first.created,true);
  assert.equal(first.product.status,'draft');
  assert.equal(first.product.priceCents,null);
  assert.equal(first.product.stock,0);
  assert.deepEqual(first.product.options,['Clear-iPhone15']);
  assert.ok(!('variants' in first.product.supplierSnapshot));
  const again=importCJDraft({...detail,name:'Changed supplier title'},'cj-v');
  assert.equal(again.created,false);
  assert.deepEqual(again.product,first.product);
  assert.equal(importCJDraft(detail,'cj-v2').created,true);
  assert.equal(listDraftProducts().length,2);
  assert.throws(()=>importCJDraft(detail,'foreign-variant'),/does not belong/);
  const persisted=new DatabaseSync(process.env.DATABASE_PATH!);
  const row=persisted.prepare('SELECT * FROM products WHERE id=?').get(first.product.id)!;
  assert.equal(row.status,'draft');
  assert.equal(row.cj_product_id,'cj-p');
  assert.equal(row.cj_variant_id,'cj-v');
  assert.deepEqual(JSON.parse(String(row.data)),first.product);
  assert.throws(()=>persisted.prepare("INSERT INTO products(id,data,stock,status,cj_product_id,cj_variant_id) VALUES('duplicate','{}',0,'draft','cj-p','cj-v')").run(),/UNIQUE/);
  persisted.close();
});
test('drafts are excluded from catalogue and rejected by checkout even if stock is manipulated',()=>{
  const draft=listDraftProducts()[0];
  db().prepare('UPDATE products SET stock=100 WHERE id=?').run(draft.id);
  assert.ok(!listProducts().some(p=>p.id===draft.id));
  const count=listOrders().length;
  assert.throws(()=>createOrder({idempotencyKey:randomUUID(),customer:{name:'Test Buyer',email:'buyer@example.com',phone:'+60123456789',address:'123 Test Street',city:'Kuala Lumpur',postcode:'50000',state:'Kuala Lumpur',country:'MY'},items:[{id:draft.id,option:draft.options[0],qty:1}],paymentScenario:'approve'}),/no longer available/);
  assert.equal(listOrders().length,count);
});
test('detail uses only CJ auth and read endpoint; token stays out of normalized data',async()=>{
  const original=globalThis.fetch;
  const priorKey=process.env.CJ_API_KEY;
  process.env.CJ_API_KEY='test-private-key';
  const calls:{url:string;init:RequestInit}[]=[];
  globalThis.fetch=async(input,init={})=>{
    const url=String(input);calls.push({url,init});
    if(url.endsWith('/authentication/getAccessToken'))return Response.json({code:200,result:true,data:{accessToken:'test-private-token',accessTokenExpiryDate:new Date(Date.now()+3600000).toISOString()}});
    assert.equal(url,'https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=cj-p');
    assert.equal(init.method,'GET');
    assert.equal(new Headers(init.headers).get('CJ-Access-Token'),'test-private-token');
    return Response.json(raw);
  };
  try {
    const result=await getCJDetail('cj-p');
    assert.equal(calls.length,2);
    assert.equal(JSON.stringify(result).includes('test-private'),false);
    assert.equal(calls[1].init.cache,'no-store');
  }finally{globalThis.fetch=original;if(priorKey===undefined)delete process.env.CJ_API_KEY;else process.env.CJ_API_KEY=priorKey;}
});
after(()=>{db().close();rmSync(directory,{recursive:true,force:true})});
