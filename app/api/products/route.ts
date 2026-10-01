import { listProducts } from '@/lib/db';


export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';
export async function GET() {
    try {

        return Response.json({
            products: listProducts(),

            mode: 'local-test'
        },
            { headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return Response.json({ error: 'Could not load products.' }, { status: 500 })
    }
}
