import {cookies} from 'next/headers';
import {sameOrigin,boundedJson,failure,equal,session} from '@/lib/security';
import {CommerceError} from '@/lib/commerce';
let attempts:number[]=[];
export const runtime='nodejs';
export async function POST(req:Request){try{sameOrigin(req);attempts=attempts.filter(t=>t>Date.now()-60000);if(attempts.length>=10)throw new CommerceError('Too many attempts. Wait one minute.',429);attempts.push(Date.now());const key=process.env.ADMIN_KEY;if(!key||key.length<32)throw new CommerceError('Run npm run setup first.',503);const body=await boundedJson(req);if(typeof body.key!=='string'||!equal(body.key,key))throw new CommerceError('Incorrect admin key.',401);(await cookies()).set('ys_admin',session(),{httpOnly:true,sameSite:'strict',secure:(process.env.APP_ORIGIN||'').startsWith('https://'),maxAge:28800,path:'/'});return Response.json({ok:true})}catch(e){return failure(e)}}
