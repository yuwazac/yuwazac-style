import {z} from 'zod';
import {requireAdmin,sameOrigin,boundedJson,failure} from '@/lib/security';
import {getCJDetail} from '@/lib/cj';
import {findCJImport,importCJDraft,listDraftProducts} from '@/lib/db';
import {CommerceError} from '@/lib/commerce';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){try{await requireAdmin();return Response.json({products:listDraftProducts()},{headers})}catch(e){return failure(e)}}
export async function POST(req:Request){
  try{
    sameOrigin(req);await requireAdmin();
    const data=z.object({productId:z.string().trim().min(1).max(200),variantId:z.string().trim().min(1).max(200)}).strict().safeParse(await boundedJson(req));
    if(!data.success)throw new CommerceError('Select one CJ product and variant.');
    const {productId,variantId}=data.data;
    const prior=findCJImport(productId,variantId);
    // Fetch supplier-owned values on the server; never trust prices or stock from the browser.
    const result=prior?{product:prior,created:false}:importCJDraft(await getCJDetail(productId),variantId);
    return Response.json({...result,published:result.product.status==='published',orderPlaced:false},{status:result.created?201:200,headers});
  }catch(e){return failure(e)}
}
