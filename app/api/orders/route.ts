import { createOrder } from '@/lib/db';
import { sameOrigin, boundedJson, failure } from '@/lib/security';
export const runtime = 'nodejs';

//
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        return Response.json({ order: createOrder(await boundedJson(req)) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    } catch (e) {
        return failure(e)
    }
}
