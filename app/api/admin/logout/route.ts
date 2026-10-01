import {cookies} from 'next/headers';
import {sameOrigin,failure} from '@/lib/security';
export async function POST(req:Request){try{sameOrigin(req);(await cookies()).delete('ys_admin');return Response.json({ok:true})}catch(e){return failure(e)}}
