import {z} from 'zod';
import {requireAdmin,sameOrigin,boundedJson,failure} from '@/lib/security';
import {searchCJ} from '@/lib/cj';
import {CommerceError} from '@/lib/commerce';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{await requireAdmin();return Response.json({cjConfigured:Boolean(process.env.CJ_API_KEY?.trim()),liveOrdering:false},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function POST(req:Request){try{sameOrigin(req);await requireAdmin();const data=z.object({keyword:z.string().trim().min(2).max(100)}).safeParse(await boundedJson(req));if(!data.success)throw new CommerceError('Enter a search of 2–100 characters.');return Response.json({products:await searchCJ(data.data.keyword),connected:true,imported:false,orderPlaced:false},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
