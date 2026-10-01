import {parseCJDetail} from './cj-detail.ts';
import {z} from 'zod';
import {CommerceError} from './commerce.ts';
const base='https://developers.cjdropshipping.com/api2.0/v1';
const productSchema=z.object({id:z.string(),nameEn:z.string(),sku:z.string().optional(),sellPrice:z.union([z.string(),z.number()]).optional(),warehouseInventoryNum:z.number().optional()});
export function parseCJProducts(raw:unknown){const schema=z.object({code:z.number(),result:z.boolean(),data:z.object({content:z.array(z.object({productList:z.array(productSchema)})),totalRecords:z.number().optional()})});const result=schema.safeParse(raw);if(!result.success||result.data.code!==200||!result.data.result)throw new CommerceError('CJ returned an unexpected product response. Check API access and try again.',502);return result.data.data.content.flatMap(group=>group.productList).map(p=>({supplierProductId:p.id,name:p.nameEn,sku:p.sku||'',supplierPrice:p.sellPrice===undefined?'Not supplied':String(p.sellPrice),reportedStock:p.warehouseInventoryNum??null}))}
let cached:{token:string;expires:number}|undefined,lastCall=0,inflight=false;
async function request(path:string,init:RequestInit){const gap=1100-(Date.now()-lastCall);if(gap>0)await new Promise(resolve=>setTimeout(resolve,gap));lastCall=Date.now();let response:Response;try{response=await fetch(base+path,{...init,cache:'no-store',signal:AbortSignal.timeout(15000),redirect:'error'})}catch{throw new CommerceError('Could not reach CJ. Check your connection and try again.',502)}if(!response.ok)throw new CommerceError(`CJ request failed (HTTP ${response.status}). Check your account access or retry later.`,502);let body;try{body=await response.json()}catch{throw new CommerceError('CJ returned an unreadable response.',502)}if(body.code!==200||body.result!==true){if(body.code===1600001)cached=undefined;throw new CommerceError('CJ rejected the request. Check your API key, account permissions and quota in CJ.',502)}return body}
async function token(){if(cached&&cached.expires>Date.now()+60000)return cached.token;const key=process.env.CJ_API_KEY?.trim();if(!key)throw new CommerceError('CJ is not configured. Add CJ_API_KEY to .env.local, then restart the app.',503);const body=await request('/authentication/getAccessToken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key})});const parsed=z.object({accessToken:z.string().min(1),accessTokenExpiryDate:z.string()}).safeParse(body.data);if(!parsed.success)throw new CommerceError('CJ authentication response was not recognized.',502);const expiry=Date.parse(parsed.data.accessTokenExpiryDate);if(!Number.isFinite(expiry)||expiry<=Date.now())throw new CommerceError('CJ returned an expired token.',502);cached={token:parsed.data.accessToken,expires:expiry};return cached.token}
export async function searchCJ(keyword:string){if(inflight)throw new CommerceError('A CJ request is already running. Please wait.',429);inflight=true;try{const access=await token();const query=new URLSearchParams({page:'1',size:'8',keyWord:keyword});const data=await request('/product/listV2?'+query,{method:'GET',headers:{'CJ-Access-Token':access}});return parseCJProducts(data)}finally{inflight=false}}

export async function getCJDetail(pid:string){
  if(inflight)throw new CommerceError('A CJ request is already running. Please wait.',429);
  inflight=true;
  try{
    const access=await token();
    const data=await request('/product/query?'+new URLSearchParams({pid}),{method:'GET',headers:{'CJ-Access-Token':access}});
    return parseCJDetail(data,pid);
  }finally{inflight=false}
}
