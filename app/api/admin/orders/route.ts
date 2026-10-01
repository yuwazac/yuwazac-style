import {z} from 'zod';
import {listOrders,updateOrder} from '@/lib/db';
import {requireAdmin,sameOrigin,boundedJson,failure} from '@/lib/security';
import {CommerceError} from '@/lib/commerce';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{await requireAdmin();return Response.json({orders:listOrders()},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function PATCH(req:Request){try{sameOrigin(req);await requireAdmin();const input=z.object({id:z.string().uuid(),status:z.enum(['test_processing','test_shipped','test_delivered','test_cancelled']),tracking:z.string().trim().max(100).default('')}).safeParse(await boundedJson(req));if(!input.success)throw new CommerceError('Invalid order update.');return Response.json({order:updateOrder(input.data.id,input.data.status,input.data.tracking)})}catch(e){return failure(e)}}
