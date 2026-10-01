import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/security';
import {getDraftProduct} from '@/lib/db';
import {CommerceError} from '@/lib/commerce';
import DraftEditor from './editor';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function EditDraft({params}:{params:Promise<{id:string}>}){
  try{await requireAdmin();}catch(e){if(e instanceof CommerceError&&e.status===401)redirect('/admin');throw e;}
  let product;
  try{product=getDraftProduct((await params).id);}catch(e){if(e instanceof CommerceError&&e.status===404)notFound();throw e;}
  return <main className="admin mx-auto my-10 max-w-[1000px] px-4 sm:px-6"><Link href="/admin">← Back to admin</Link><h1>Edit draft</h1><DraftEditor initial={product}/></main>;
}
