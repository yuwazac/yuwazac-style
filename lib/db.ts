import {draftEditSchema,myrCents} from './draft.ts';
import type {CJDetail,DraftProduct} from './cj-detail.ts';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {seedProducts,type Product} from './catalog.ts';
import {checkoutSchema,deliveryCents,CommerceError,transitions,type CheckoutInput,type OrderStatus} from './commerce.ts';
let connection:DatabaseSync|undefined;
export function db(){if(connection)return connection;const path=resolve(process.env.DATABASE_PATH||'./data/yuwazac.sqlite');mkdirSync(dirname(path),{recursive:true});const d=new DatabaseSync(path);d.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,data TEXT NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0));
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,idempotency TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL,customer TEXT NOT NULL,items TEXT NOT NULL,subtotal INTEGER NOT NULL,shipping INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,tracking TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
// Additive migration preserves existing products, stock and orders.
d.exec('BEGIN IMMEDIATE');
try {
const columns=new Set(d.prepare('PRAGMA table_info(products)').all().map(r=>String(r.name)));
if(!columns.has('status'))d.exec("ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published'))");
if(!columns.has('cj_product_id'))d.exec('ALTER TABLE products ADD COLUMN cj_product_id TEXT');
if(!columns.has('cj_variant_id'))d.exec('ALTER TABLE products ADD COLUMN cj_variant_id TEXT');
d.exec('CREATE UNIQUE INDEX IF NOT EXISTS products_cj_identity ON products(cj_product_id,cj_variant_id)');
d.exec('COMMIT');
}catch(e){d.exec('ROLLBACK');d.close();throw e}
const initialized=d.prepare("SELECT value FROM settings WHERE key='seeded'").get();if(!initialized){d.exec('BEGIN IMMEDIATE');try{const insert=d.prepare('INSERT INTO products(id,data,stock) VALUES(?,?,?)');for(const p of seedProducts)insert.run(p.id,JSON.stringify(p),p.stock);d.prepare("INSERT INTO settings VALUES('seeded','1')").run();d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}}connection=d;return d}
export function listProducts():Product[]{
  return db().prepare("SELECT data,stock FROM products WHERE status='published' ORDER BY rowid").all().map(r=>{
    const p=JSON.parse(String(r.data));
    return {id:p.id,name:p.name,category:p.category,priceCents:p.priceCents,image:p.image||'',images:p.images,options:p.options,stock:Number(r.stock),description:p.description||'',supplier:p.supplier,processingEstimate:p.processingEstimate,deliveryEstimate:p.deliveryEstimate};
  });
}
type OrderRow={id:string;idempotency:string;request_hash:string;customer:string;items:string;subtotal:number;shipping:number;total:number;status:OrderStatus;tracking:string;created_at:string};
export function orderView(row:OrderRow){return{id:row.id,customer:JSON.parse(row.customer),items:JSON.parse(row.items),subtotal:row.subtotal,shipping:row.shipping,total:row.total,status:row.status,tracking:row.tracking,createdAt:row.created_at,payment:'test_approved',supplierSubmitted:false}}
export function listOrders(){return (db().prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all() as unknown as OrderRow[]).map(orderView)}
export function createOrder(raw:unknown){const parsed=checkoutSchema.safeParse(raw);if(!parsed.success)throw new CommerceError('Check the delivery details and bag items.');const input:CheckoutInput=parsed.data;const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');const d=db();d.exec('BEGIN IMMEDIATE');try{const prior=d.prepare('SELECT * FROM orders WHERE idempotency=?').get(input.idempotencyKey) as OrderRow|undefined;if(prior){if(prior.request_hash!==fingerprint)throw new CommerceError('Checkout request changed. Start a new checkout.',409);d.exec('COMMIT');return orderView(prior)}if(input.paymentScenario==='decline')throw new CommerceError('Test payment declined. No order was created and stock was not changed.',402);
const catalog=listProducts();const combined=new Map<string,{id:string;name:string;option:string;qty:number;priceCents:number}>();const totals=new Map<string,number>();for(const item of input.items){const p=catalog.find(p=>p.id===item.id);if(!p||!p.options.includes(item.option))throw new CommerceError('One of the products or options is no longer available.',409);const key=JSON.stringify([item.id,item.option]);const previous=combined.get(key);const qty=(previous?.qty||0)+item.qty;if(qty>20)throw new CommerceError('Maximum 20 units per option.');combined.set(key,{id:p.id,name:p.name,option:item.option,qty,priceCents:p.priceCents});totals.set(p.id,(totals.get(p.id)||0)+item.qty)}for(const [id,qty]of totals){const p=catalog.find(p=>p.id===id)!;if(qty>p.stock)throw new CommerceError(`${p.name}: only ${p.stock} sample units remain.`,409)}const items=[...combined.values()],subtotal=items.reduce((sum,x)=>sum+x.qty*x.priceCents,0),shipping=deliveryCents(input.customer.state),id=randomUUID(),now=new Date().toISOString();for(const [productId,qty]of totals)d.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(qty,productId);d.prepare('INSERT INTO orders(id,idempotency,request_hash,customer,items,subtotal,shipping,total,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,input.idempotencyKey,fingerprint,JSON.stringify(input.customer),JSON.stringify(items),subtotal,shipping,subtotal+shipping,'test_received',now);d.prepare('INSERT INTO audit(order_id,status,created_at) VALUES(?,?,?)').run(id,'test_received',now);const row=d.prepare('SELECT * FROM orders WHERE id=?').get(id) as OrderRow;d.exec('COMMIT');return orderView(row)}catch(e){d.exec('ROLLBACK');throw e}}
export function updateOrder(id:string,status:OrderStatus,tracking:string){const d=db();d.exec('BEGIN IMMEDIATE');try{const row=d.prepare('SELECT * FROM orders WHERE id=?').get(id) as OrderRow|undefined;if(!row)throw new CommerceError('Order not found.',404);if(!transitions[row.status]?.includes(status))throw new CommerceError('Invalid order status transition.',409);if(status==='test_shipped'&&!tracking.trim())throw new CommerceError('Enter a test tracking reference before marking shipped.');if(status==='test_cancelled'){for(const item of JSON.parse(row.items))d.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.qty,item.id)}d.prepare('UPDATE orders SET status=?,tracking=? WHERE id=?').run(status,status==='test_shipped'?tracking.trim():row.tracking,id);d.prepare('INSERT INTO audit(order_id,status,created_at) VALUES(?,?,?)').run(id,status,new Date().toISOString());d.exec('COMMIT');return{...orderView(row),status,tracking:status==='test_shipped'?tracking.trim():row.tracking}}catch(e){d.exec('ROLLBACK');throw e}}

export function listDraftProducts():DraftProduct[]{
  return db().prepare("SELECT data,stock FROM products WHERE cj_product_id IS NOT NULL ORDER BY rowid DESC").all().map(r=>({...JSON.parse(String(r.data)),stock:Number(r.stock)}));
}
export function findCJImport(pid:string,vid:string):DraftProduct|undefined{
  const row=db().prepare('SELECT data,stock FROM products WHERE cj_product_id=? AND cj_variant_id=?').get(pid,vid);
  return row?{...JSON.parse(String(row.data)),stock:Number(row.stock)}:undefined;
}
export function importCJDraft(detail:CJDetail,vid:string){
  const variant=detail.variants.find(v=>v.supplierVariantId===vid);
  if(!variant)throw new CommerceError('Selected variant does not belong to this CJ product.',400);
  const {variants:_,...snapshot}=detail;
  const draft:DraftProduct={id:randomUUID(),status:'draft',name:detail.name,category:null,priceCents:null,stock:0,options:[variant.option],supplier:'cj',supplierProductId:detail.supplierProductId,supplierVariantId:vid,images:[...new Set([variant.image,...detail.images].filter((s):s is string=>!!s))],supplierSnapshot:{...snapshot,variant},createdAt:new Date().toISOString()};
  const result=db().prepare("INSERT INTO products(id,data,stock,status,cj_product_id,cj_variant_id) VALUES(?,?,0,'draft',?,?) ON CONFLICT(cj_product_id,cj_variant_id) DO NOTHING").run(draft.id,JSON.stringify(draft),detail.supplierProductId,vid);
  return {product:findCJImport(detail.supplierProductId,vid)!,created:Number(result.changes)===1};
}

export function getDraftProduct(id:string):DraftProduct{
  const row=db().prepare("SELECT data,stock FROM products WHERE id=? AND cj_product_id IS NOT NULL AND cj_variant_id IS NOT NULL").get(id);
  if(!row)throw new CommerceError('Imported draft not found.',404);
  return {...JSON.parse(String(row.data)),stock:Number(row.stock)};
}
export function updateDraftProduct(id:string,raw:unknown):DraftProduct{
  const parsed=draftEditSchema.safeParse(raw);
  if(!parsed.success)throw new CommerceError(parsed.error.issues[0]?.message||'Check the draft fields.');
  const d=db();d.exec('BEGIN IMMEDIATE');
  try{
    const current=getDraftProduct(id);
    const input=parsed.data;
    if(input.version!==(current.revision||current.createdAt))throw new CommerceError('This draft changed in another tab. Reload the editor before saving again.',409);
    const priceCents=myrCents(input.sellingPriceMYR);
    const publishing=input.action==='publish'||current.status==='published';
    const stock=input.testStock??(current.status==='draft'?current.testStock:undefined)??current.stock;
    if(publishing&&(!input.category||priceCents===null||priceCents<=0||!input.images.length||!input.processingEstimate||!input.deliveryEstimate))throw new CommerceError('Publishing requires a title, category, positive MYR price, image, processing estimate and delivery estimate.');
    if(input.action==='publish'&&stock<1)throw new CommerceError('Enter at least one local test-stock unit before publishing.');
    // Explicit editable fields only. Keep the original CJ identity and supplier snapshot intact.
    const updated:DraftProduct={...current,name:input.name,description:input.description,images:[...new Set(input.images)],category:input.category,priceCents:myrCents(input.sellingPriceMYR),processingEstimate:input.processingEstimate,deliveryEstimate:input.deliveryEstimate,updatedAt:new Date().toISOString(),revision:randomUUID(),stock:publishing?stock:0,testStock:publishing?undefined:stock,status:publishing?'published':'draft'};
    d.prepare("UPDATE products SET data=?,stock=?,status=? WHERE id=?").run(JSON.stringify(updated),updated.stock,updated.status,id);
    d.exec('COMMIT');return updated;
  }catch(e){d.exec('ROLLBACK');throw e;}
}
