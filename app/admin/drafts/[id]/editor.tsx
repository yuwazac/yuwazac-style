"use client";
import {useState} from 'react';
import type {DraftProduct} from '@/lib/cj-detail';
import {Button} from '@/components/ui/button';

export default function DraftEditor({initial}:{initial:DraftProduct}){
  const [product,setProduct]=useState(initial);
  const [testStock,setTestStock]=useState(String(initial.status==='draft'?(initial.testStock??0):initial.stock));
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData(event.currentTarget);
    const body={name:String(form.get('name')),description:String(form.get('description')),images:String(form.get('images')).split(/\r?\n/).map(s=>s.trim()).filter(Boolean),category:form.get('category')||null,sellingPriceMYR:String(form.get('sellingPriceMYR')),processingEstimate:String(form.get('processingEstimate')),deliveryEstimate:String(form.get('deliveryEstimate')),action:(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')||'save',testStock:Number(testStock),version:product.revision||product.createdAt};
    try{
      const response=await fetch(`/api/admin/drafts/${encodeURIComponent(product.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setProduct(data.product);setTestStock(String(data.product.status==='draft'?(data.product.testStock??0):data.product.stock));setDirty(false);setMessage(data.product.status==='published'?'Published in the local shop. Checkout remains test-only.':'Draft saved. Preview shows this saved version.');
    }catch(e){setError(e instanceof Error?e.message:'Could not save this draft.');}finally{setBusy(false);}
  }
  return <>
    <p>{product.status==='published'?'Published · Visible in the local shop. Test checkout only.':'Draft · Hidden from the store and checkout.'}</p>
    <p className="muted">CJ product: {product.supplierProductId} · Variant: {product.supplierVariantId}</p>
    <p className="muted">Variant option: {product.options.join(', ')}. CJ identifiers and the original supplier snapshot are preserved.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status">{message}</p>}
    <form className="draft-editor" key={product.revision||product.createdAt} onSubmit={save} onChange={()=>{setDirty(true);setMessage('');}}>
      <fieldset disabled={busy} className="grid gap-5 border-0 p-0">
        <label>Product title<input name="name" required maxLength={200} defaultValue={product.name}/></label>
        <label>Description<textarea className="w-full border p-3" name="description" rows={6} maxLength={5000} defaultValue={product.description||''}/></label>
        <label>Images — one URL per line<textarea className="w-full border p-3" name="images" rows={5} defaultValue={product.images.join('\n')} aria-describedby="image-help"/></label>
        <p id="image-help" className="muted">Up to 12 HTTPS image URLs (or existing /assets image paths). The first image is the main product image; change their order here. Leave blank to remove all images.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <label>Category<select name="category" className="store-select" defaultValue={product.category||''}><option value="">Not set</option><option value="Phone">Phone</option><option value="Fashion">Fashion</option></select></label>
          <label>Selling price (MYR)<input name="sellingPriceMYR" inputMode="decimal" placeholder="e.g. 39.90" pattern="[0-9]{1,6}([.][0-9]{1,2})?" defaultValue={product.priceCents===null?'':(product.priceCents/100).toFixed(2)}/></label>
        </div>
        <label>Processing estimate<input name="processingEstimate" maxLength={200} placeholder="e.g. 2–3 business days before dispatch" defaultValue={product.processingEstimate||''}/></label>
        <label>Delivery estimate<input name="deliveryEstimate" maxLength={200} placeholder="e.g. 7–12 business days after dispatch to Malaysia" defaultValue={product.deliveryEstimate||''}/></label>
        <label htmlFor="local-test-stock">Local Test Stock (test inventory)</label>
        <input id="local-test-stock" name="testStock" type="number" required min={0} max={10000} step={1} value={testStock} onChange={event=>setTestStock(event.target.value)} aria-describedby="test-stock-help"/>
        <p id="test-stock-help" className="muted">Local test inventory only. Enter at least 1 unit to publish. This quantity is not live CJ stock and is not synced with the supplier.</p>
        <p className="muted">Publishing requires a title, category, positive MYR price, image, processing and delivery estimates, and positive local test stock. This stock is not synced with CJ.</p>
        <p className="muted">Estimates are your draft copy. Saving does not verify supplier shipping terms. Price, category and other unfinished fields can remain blank.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" value="save" variant="store">{busy?'Saving…':product.status==='published'?'Save product':'Save draft'}</Button>
          {product.status==='draft'&&<Button type="submit" value="publish" variant="store">Publish to local shop</Button>}
          {product.status==='published'&&<a className="text-link" href="/">Open shop →</a>}
          {!dirty&&!busy&&<a className="text-link" href={`/admin/drafts/${encodeURIComponent(product.id)}/preview`} target="_blank" rel="noopener noreferrer">Preview saved draft ↗</a>}
          {dirty&&<span role="status">Unsaved changes — save to preview this version.</span>}
        </div>
      </fieldset>
    </form>
    <p className="muted">Last saved: {new Date(product.updatedAt||product.createdAt).toLocaleString()}</p>
  </>;
}
