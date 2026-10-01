import {requireAdmin,sameOrigin,boundedJson,failure} from '@/lib/security';
import {getDraftProduct,updateDraftProduct} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Context){
  try{await requireAdmin();return Response.json({product:getDraftProduct((await params).id)},{headers});}catch(e){return failure(e);}
}
export async function PATCH(req:Request,{params}:Context){
  try{sameOrigin(req);await requireAdmin();return Response.json({product:updateDraftProduct((await params).id,await boundedJson(req))},{headers});}catch(e){return failure(e);}
}
