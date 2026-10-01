import {z} from 'zod';
import {requireAdmin,sameOrigin,boundedJson,failure} from '@/lib/security';
import {getCJDetail} from '@/lib/cj';
import {CommerceError} from '@/lib/commerce';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){
  try{
    sameOrigin(req);await requireAdmin();
    const data=z.object({productId:z.string().trim().min(1).max(200)}).strict().safeParse(await boundedJson(req));
    if(!data.success)throw new CommerceError('A CJ product ID is required.');
    return Response.json({product:await getCJDetail(data.data.productId)},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return failure(e)}
}
