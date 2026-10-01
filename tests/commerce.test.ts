import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createOrder,listProducts,listOrders,updateOrder,db} from '../lib/db.ts';
import {parseCJProducts} from '../lib/cj.ts';
const directory=mkdtempSync(join(tmpdir(),'ys-tests-'));process.env.DATABASE_PATH=join(directory,'test.sqlite');
const customer={name:'Test Buyer',email:'buyer@example.com',phone:'+60123456789',address:'123 Test Street',city:'Kuala Lumpur',postcode:'50000',state:'Kuala Lumpur',country:'MY'};
function input(){return{idempotencyKey:randomUUID(),customer,items:[{id:'case',option:'iPhone 15',qty:2}],paymentScenario:'approve'}}
test('checkout saves once, calculates server prices, decrements stock, cancellation restores once',()=>{const before=listProducts().find(p=>p.id==='case')!.stock;const payload=input();const o=createOrder(payload);assert.equal(o.total,6600);assert.equal(listProducts().find(p=>p.id==='case')!.stock,before-2);assert.equal(createOrder(payload).id,o.id);assert.equal(listProducts().find(p=>p.id==='case')!.stock,before-2);assert.throws(()=>createOrder({...payload,customer:{...customer,name:'Changed'}}),/changed/);assert.ok(listOrders().some(x=>x.id===o.id));updateOrder(o.id,'test_cancelled','');assert.equal(listProducts().find(p=>p.id==='case')!.stock,before);assert.throws(()=>updateOrder(o.id,'test_cancelled',''),/transition/)});
test('decline and invalid model leave orders and stock unchanged',()=>{const stock=listProducts(),count=listOrders().length;assert.throws(()=>createOrder({...input(),paymentScenario:'decline'}),/declined/);assert.throws(()=>createOrder({...input(),items:[{id:'case',option:'Wrong model',qty:1}]}),/available/);assert.throws(()=>createOrder({...input(),total:1}),/Check/);assert.equal(listOrders().length,count);assert.deepEqual(listProducts(),stock)});
test('overselling across options is blocked atomically',()=>{const before=listProducts();assert.throws(()=>createOrder({...input(),items:[{id:'watch',option:'Light strap',qty:10}]}),/remain/);assert.deepEqual(listProducts(),before)});
test('valid tracking required; status cannot skip stages',()=>{const o=createOrder(input());assert.throws(()=>updateOrder(o.id,'test_shipped','TRACK'),/transition/);updateOrder(o.id,'test_processing','');assert.throws(()=>updateOrder(o.id,'test_shipped',''),/tracking/);updateOrder(o.id,'test_shipped','TEST-123');assert.equal(updateOrder(o.id,'test_delivered','').tracking,'TEST-123')});
test('CJ documented response maps safely; malformed/failed responses are rejected',()=>{assert.deepEqual(parseCJProducts({code:200,result:true,data:{content:[{productList:[{id:'sample-id',nameEn:'Sample product',sellPrice:'2.00',warehouseInventoryNum:4}]}]}}),[{supplierProductId:'sample-id',name:'Sample product',sku:'',supplierPrice:'2.00',reportedStock:4}]);assert.throws(()=>parseCJProducts({code:401,result:false,data:null}),/unexpected/)});
after(()=>{db().close();rmSync(directory,{recursive:true,force:true})});
