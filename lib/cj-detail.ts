import {z} from 'zod';
import {CommerceError} from './commerce.ts';

const text=z.string().nullish();
const amount=z.union([z.string(),z.number()]).nullish();
const quantity=z.number().int().nonnegative().nullish();
const inventory=z.object({countryCode:text,totalInventory:quantity,cjInventory:quantity,factoryInventory:quantity,verifiedWarehouse:z.union([z.string(),z.number()]).nullish()});
const variant=z.object({vid:z.string().min(1),pid:text,variantNameEn:text,variantSku:text,variantKey:text,variantImage:text,variantSellPrice:amount,variantWeight:amount,variantLength:amount,variantWidth:amount,variantHeight:amount,inventories:z.array(inventory).nullish()});
const product=z.object({pid:z.string().min(1),productNameEn:z.string().min(1),productSku:text,bigImage:text,productImageSet:z.array(z.string()).nullish(),sellPrice:amount,packingWeight:amount,productProEnSet:z.array(z.string()).nullish(),addMarkStatus:z.number().nullish(),variants:z.array(variant)});

// Only render HTTPS images on documented CJ/CDN hosts; never fetch arbitrary supplier URLs on the server.
export function cjImage(value:string|null|undefined):string|null {
  if(!value)return null;
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    if(!['cjdropshipping.com','aliyuncs.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))return null;
    return u.href;
  }catch{return null}
}
const supplied=(value:string|number|null|undefined)=>value===null||value===undefined||value===''?null:String(value);
export function parseCJDetail(raw:unknown,expectedPid:string){
  const parsed=z.object({code:z.literal(200),result:z.literal(true),data:product}).safeParse(raw);
  if(!parsed.success)throw new CommerceError('CJ returned an unexpected product detail response.',502);
  const p=parsed.data.data;
  if(p.pid!==expectedPid||p.variants.some(v=>v.pid&&v.pid!==p.pid)||new Set(p.variants.map(v=>v.vid)).size!==p.variants.length)throw new CommerceError('CJ product or variant identifiers did not match.',502);
  return {
    supplierProductId:p.pid,name:p.productNameEn,sku:p.productSku||'',
    images:[...new Set([p.bigImage,...p.productImageSet||[]].map(cjImage).filter((s):s is string=>s!==null))],
    supplierPrice:supplied(p.sellPrice),priceCurrency:null,
    fetchedAt:new Date().toISOString(),
    shipping:{packingWeightGrams:supplied(p.packingWeight),logisticsAttributes:p.productProEnSet||[],freeShippingFlag:p.addMarkStatus===1?true:p.addMarkStatus===0?false:null},
    variants:p.variants.map(v=>({supplierVariantId:v.vid,name:v.variantNameEn||v.variantKey||v.vid,sku:v.variantSku||'',option:v.variantKey||v.variantNameEn||v.vid,image:cjImage(v.variantImage),supplierPrice:supplied(v.variantSellPrice),currency:'USD' as const,
      weightGrams:supplied(v.variantWeight),lengthMm:supplied(v.variantLength),widthMm:supplied(v.variantWidth),heightMm:supplied(v.variantHeight),
      inventories:(v.inventories||[]).map(i=>({countryCode:i.countryCode||null,total:i.totalInventory??null,cj:i.cjInventory??null,factory:i.factoryInventory??null,verified:i.verifiedWarehouse==null?null:String(i.verifiedWarehouse)}))}))
  };
}
export type CJDetail=ReturnType<typeof parseCJDetail>;
export type DraftProduct={id:string;status:'draft'|'published';name:string;category:'Phone'|'Fashion'|null;priceCents:number|null;description?:string;processingEstimate?:string;deliveryEstimate?:string;updatedAt?:string;revision?:string;stock:number;testStock?:number;options:string[];supplier:'cj';supplierProductId:string;supplierVariantId:string;images:string[];supplierSnapshot:Omit<CJDetail,'variants'> & {variant:CJDetail['variants'][number]};createdAt:string};
