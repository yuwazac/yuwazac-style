import {z} from 'zod';

// Images load in the browser only. No URL is fetched or proxied by the server.
export function draftImageUrl(value:string){
  if(/^\/assets\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/.test(value))return true;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
}
export const draftEditSchema=z.object({
  name:z.string().trim().min(1,'Enter a product title.').max(200),
  description:z.string().trim().max(5000),
  images:z.array(z.string().trim().max(1000).refine(draftImageUrl,'Use HTTPS image URLs or local /assets image paths.')).max(12),
  category:z.enum(['Phone','Fashion']).nullable(),
  sellingPriceMYR:z.string().trim().regex(/^(?:|\d{1,6}(?:\.\d{1,2})?)$/,'Use a MYR price with up to two decimal places (maximum 999999.99).'),
  processingEstimate:z.string().trim().max(200),
  deliveryEstimate:z.string().trim().max(200),
  action:z.enum(['save','publish']).default('save'),
  testStock:z.number().int().min(0).max(10000).optional(),
  version:z.string().min(1).max(100),
}).strict();
export type DraftEditInput=z.infer<typeof draftEditSchema>;
export function myrCents(value:string):number|null {
  if(value==='')return null;
  const [whole,fraction='']=value.split('.');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
