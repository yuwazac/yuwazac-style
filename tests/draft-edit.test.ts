import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {db,importCJDraft,getDraftProduct,updateDraftProduct,listProducts,findCJImport,createOrder} from '../lib/db.ts';
import {parseCJDetail} from '../lib/cj-detail.ts';
const dir=mkdtempSync(join(tmpdir(),'ys-draft-edit-'));
process.env.DATABASE_PATH=join(dir,'db.sqlite');
const source=parseCJDetail({code:200,result:true,data:{pid:'edit-p',productNameEn:'Supplier title',variants:[{vid:'edit-v',variantKey:'Black',variantSellPrice:3.5}]}},'edit-p');
const original=importCJDraft(source,'edit-v').product;
function fields(version=original.createdAt){return {name:'Everyday case',description:'Clear protection.\nMade for everyday use.',images:['https://cf.cjdropshipping.com/test.jpg','/assets/phone.jpg'],category:'Phone',sellingPriceMYR:'39.90',processingEstimate:'2–3 business days',deliveryEstimate:'7–12 business days to Malaysia',version};}
test('edit persists every listing field, keeps identity/snapshot/draft, and reimport keeps edits',()=>{
  const updated=updateDraftProduct(original.id,fields());
  assert.equal(updated.priceCents,3990);
  assert.equal(updated.name,'Everyday case');
  assert.equal(updated.description,fields().description);
  assert.equal(updated.category,'Phone');
  assert.deepEqual(updated.images,fields().images);
  assert.equal(updated.processingEstimate,fields().processingEstimate);
  assert.equal(updated.deliveryEstimate,fields().deliveryEstimate);
  assert.equal(updated.supplierProductId,original.supplierProductId);
  assert.equal(updated.supplierVariantId,original.supplierVariantId);
  assert.deepEqual(updated.supplierSnapshot,original.supplierSnapshot);
  assert.equal(updated.status,'draft');
  assert.equal(updated.stock,0);
  assert.deepEqual(getDraftProduct(original.id),updated);
  assert.deepEqual(findCJImport('edit-p','edit-v'),updated);
  assert.deepEqual(importCJDraft(source,'edit-v').product,updated);
  assert.ok(!listProducts().some(p=>p.id===original.id));
  const reopened=new DatabaseSync(process.env.DATABASE_PATH!);
  const row=reopened.prepare('SELECT * FROM products WHERE id=?').get(original.id)!;
  assert.deepEqual(JSON.parse(String(row.data)),updated);
  assert.equal(row.status,'draft');assert.equal(row.cj_product_id,'edit-p');assert.equal(row.cj_variant_id,'edit-v');
  reopened.close();
});
test('invalid edits cannot change protected fields or partially update the saved draft',()=>{
  const before=getDraftProduct(original.id);
  for(const bad of [{name:''},{sellingPriceMYR:'-1'},{sellingPriceMYR:'1.001'},{sellingPriceMYR:'1e3'},{sellingPriceMYR:'1000000'},{images:['javascript:alert(1)']},{images:['data:image/svg+xml,test']},{images:['//evil.test/image']},{images:['https://user:password@example.com/image']},{category:'Other'},{status:'published'},{supplierProductId:'changed'},{supplierVariantId:'changed'},{stock:5},{supplierSnapshot:{}},{description:'x'.repeat(5001)}]){
    assert.throws(()=>updateDraftProduct(original.id,{...fields(before.revision),...bad}));
    assert.deepEqual(getDraftProduct(original.id),before);
  }
  assert.throws(()=>updateDraftProduct(original.id,fields()),/another tab/);
  assert.throws(()=>updateDraftProduct('case',fields()),/not found/);
  assert.throws(()=>getDraftProduct('missing'),/not found/);
});
test('incomplete drafts can clear optional fields; decimal money stays exact',()=>{
  let before=getDraftProduct(original.id);
  const cleared=updateDraftProduct(original.id,{...fields(before.revision),description:'',category:null,sellingPriceMYR:'',images:[],processingEstimate:'',deliveryEstimate:''});
  assert.equal(cleared.priceCents,null);assert.equal(cleared.category,null);assert.deepEqual(cleared.images,[]);
  assert.equal(cleared.description,'');assert.equal(cleared.processingEstimate,'');assert.equal(cleared.deliveryEstimate,'');
  for(const [value,cents] of [['0',0],['0.29',29],['1.1',110],['999999.99',99999999]] as const){
    before=getDraftProduct(original.id);
    assert.equal(updateDraftProduct(original.id,{...fields(before.revision),sellingPriceMYR:value}).priceCents,cents);
  }
});
test('publishing validates required fields, preserves identity and enables server-priced test checkout',()=>{
  const before=getDraftProduct(original.id);
  const planned=updateDraftProduct(original.id,{...fields(before.revision),testStock:3});
  assert.equal(planned.stock,0);assert.equal(planned.testStock,3);
  assert.ok(!listProducts().some(p=>p.id===original.id));
  const valid={...fields(planned.revision),action:'publish',testStock:3};
  for(const bad of [{category:null},{sellingPriceMYR:''},{sellingPriceMYR:'0'},{images:[]},{processingEstimate:''},{deliveryEstimate:''},{testStock:0},{testStock:1.5},{name:''}]){
    assert.throws(()=>updateDraftProduct(original.id,{...valid,...bad}));
    assert.deepEqual(getDraftProduct(original.id),planned);
    assert.ok(!listProducts().some(p=>p.id===original.id));
  }
  const published=updateDraftProduct(original.id,valid);
  assert.equal(published.status,'published');
  assert.equal(published.stock,3);
  assert.deepEqual(published.supplierSnapshot,original.supplierSnapshot);
  assert.equal(listProducts().find(p=>p.id===original.id)?.priceCents,3990);
  assert.throws(()=>updateDraftProduct(original.id,valid),/another tab/);
  const order=createOrder({idempotencyKey:crypto.randomUUID(),customer:{name:'Test Buyer',email:'buyer@example.com',phone:'+60123456789',address:'123 Test Street',city:'Kuala Lumpur',postcode:'50000',state:'Kuala Lumpur',country:'MY'},items:[{id:original.id,option:'Black',qty:1}],paymentScenario:'approve'});
  assert.equal(order.subtotal,3990);assert.equal(order.supplierSubmitted,false);
  assert.equal(getDraftProduct(original.id).stock,2);
  const saved=updateDraftProduct(original.id,{...fields(published.revision),action:'save'});
  assert.equal(saved.status,'published');assert.equal(saved.stock,2);
});
after(()=>{db().close();rmSync(dir,{recursive:true,force:true});});
