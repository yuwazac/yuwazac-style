import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {CommerceError} from './commerce';


export function sameOrigin(req:Request){
    
    const allowed=process.env.APP_ORIGIN||'http://localhost:3000';if(req.headers.get('origin')!==allowed)throw new CommerceError('Request origin rejected.',403)}

export function equal(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);
    
    return aa.length===bb.length&&timingSafeEqual(aa,bb)}

function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new CommerceError('Run npm run setup before using admin.',503);
    
    return s}
export function session(){const payload=Buffer.from(JSON.stringify({expires:Date.now()+8*3600_000,nonce:randomBytes(12).toString('hex')})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('hex')}
export async function requireAdmin(){const token=(await cookies()).get('ys_admin')?.value||'';const[payload,mac]=token.split('.');if(!payload||!mac||!equal(mac,createHmac('sha256',secret()).update(payload).digest('hex')))throw new CommerceError('Please sign in to admin.',401);try{if(JSON.parse(Buffer.from(payload,'base64url').toString()).expires>Date.now())return}catch{}throw new CommerceError('Admin session expired.',401)}
export async function boundedJson(req:Request){const reader=req.body?.getReader();if(!reader)throw new CommerceError('Request body required.');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw new CommerceError('Request too large.',413)}chunks.push(value)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new CommerceError('Invalid JSON.')}}
export function failure(error:unknown){if(error instanceof CommerceError)return Response.json({error:error.message},{status:error.status});console.error('Request failed:',error instanceof Error?error.message:'Unknown error');return Response.json({error:'Something went wrong. Please try again.'},{status:500})}
