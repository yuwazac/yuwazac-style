import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/security';
import {getDraftProduct} from '@/lib/db';
import {CommerceError} from '@/lib/commerce';
import {money} from '@/lib/catalog';
import {Button} from '@/components/ui/button';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function DraftPreview({params}:{params:Promise<{id:string}>}){
  try{await requireAdmin();}catch(e){if(e instanceof CommerceError&&e.status===401)redirect('/admin');throw e;}
  let product;
  try{product=getDraftProduct((await params).id);}catch(e){if(e instanceof CommerceError&&e.status===404)notFound();throw e;}
  return <>
    <div className="bg-[#2d4537] px-4 py-3 text-center text-white">Admin preview · {product.status==='published'?'Published locally':'Saved draft · Not published'}</div>
    <header className="header flex flex-wrap items-center justify-between gap-4 px-[5%] py-5"><Link className="brand" href="/admin">yuwazac<span>style.</span></Link><Link href={`/admin/drafts/${encodeURIComponent(product.id)}`}>← Edit draft</Link></header>
    <main className="mx-auto my-10 max-w-[1000px] px-5">
      <div id="product-detail" className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8 [overflow-wrap:anywhere]">
        <div className="product-image-gallery">{product.images.length?product.images.map((src,i)=><div key={src} className="product-image-frame product-detail-image"><img src={src} alt={`${product.name}${i?` — image ${i+1}`:''}`} referrerPolicy="no-referrer" loading={i?'lazy':'eager'}/></div>):<div className="product-image-frame product-detail-image">No product image yet</div>}</div>
        <div>
          <p className="eyebrow">{product.category?`${product.category} accessories`:'Category not set'}</p>
          <h2>{product.name}</h2>
          <p>{product.priceCents===null?'Selling price not set':money(product.priceCents)}</p>
          <p className="muted whitespace-pre-wrap">{product.description||'No description yet.'}</p>
          <label htmlFor="preview-option">Option</label><select id="preview-option" className="store-select" defaultValue={product.options[0]}>{product.options.map(option=><option key={option}>{option}</option>)}</select>
          <Button variant="store" disabled>Add to bag →</Button>
          <p><strong>Processing:</strong> {product.processingEstimate||'Estimate not set'}</p>
          <p><strong>Delivery:</strong> {product.deliveryEstimate||'Estimate not set'}</p>
          <p className="muted">Preview only. Purchasing is unavailable.</p>
        </div>
      </div>
    </main>
  </>;
}
