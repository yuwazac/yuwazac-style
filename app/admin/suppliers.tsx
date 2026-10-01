"use client";

import Link from "next/link";
import type {CJDetail, DraftProduct} from "@/lib/cj-detail";
import { Button, buttonVariants } from "@/components/ui/button";

import { useEffect, useState } from "react";

type Result = {
  supplierProductId: string;
  name: string;
  sku: string;
  supplierPrice: string;
  reportedStock: number | null;
};

export default function Suppliers() {
  const [detail, setDetail] = useState<CJDetail | null>(null);
  const [variantId, setVariantId] = useState("");
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const selected = detail?.variants.find(v => v.supplierVariantId === variantId);
  const imported = drafts.some(p => p.supplierProductId === detail?.supplierProductId && p.supplierVariantId === variantId);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/supplier/import").then(async r => {
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDrafts(d.products);
    }).catch(() => setError("Could not read imported drafts. Refresh to try again."));
    fetch("/api/admin/supplier")
      .then((r) => r.json())
      .then((d) => setConfigured(d.cjConfigured ?? null))
      .catch(() => setError("Could not read supplier settings."));
  }, []);

  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setRows([]);
    setDetail(null);
    setVariantId("");

    try {
      const keyword = new FormData(e.currentTarget).get("keyword");
      const r = await fetch("/api/admin/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRows(d.products);
      setMessage(
        "CJ responded successfully. " +
          d.products.length +
          " products found. Nothing imported or ordered.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(productId: string) {
    setBusy(true); setError(""); setMessage(""); setDetail(null); setVariantId("");
    try {
      const r = await fetch("/api/admin/supplier/detail", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({productId})});
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDetail(d.product);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not load CJ detail.");}
    finally {setBusy(false);}
  }

  async function importProduct() {
    if (!detail || !selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/admin/supplier/import", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({productId:detail.supplierProductId,variantId})});
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDrafts(previous => [d.product, ...previous.filter(p => p.id !== d.product.id)]);
      setMessage(d.created ? "Selected variant saved as a draft. It is hidden from the store and cannot be purchased." : "This variant was already imported. The existing draft was kept.");
    } catch(e) {setError(e instanceof Error ? e.message : "Could not import draft.");}
    finally {setBusy(false);}
  }

  return (
    <section className="supplier-status">
      <h2>Supplier connections</h2>
      <p>
        <strong>Kumoten / SaveValue2u:</strong> custom API access not verified.
        No connection is configured.
      </p>
      <p>
        <strong>CJdropshipping:</strong>{" "}
        {configured === null
          ? "Checking configuration…"
          : configured
            ? "API key configured — use search to verify live access."
            : "Not configured. Add CJ_API_KEY privately to .env.local and restart."}
      </p>
      <p>
        Search CJ, inspect a product, and import one variant as a local draft.
        Search, detail and import checks use your CJ API quota. Stock is a snapshot;
        live stock synchronisation and supplier ordering are not implemented.
      </p>
      <form
        onSubmit={search}
        className="supplier-search grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <label>
          Search CJ products
          <input
            name="keyword"
            required
            minLength={2}
            maxLength={100}
            placeholder="phone case"
          />
        </label>
        <Button type="submit" variant="store" disabled={busy || !configured}>
          {busy ? "Checking CJ…" : "Search CJ catalogue"}
        </Button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {rows.length > 0 && (
        <div className="supplier-results">
          {rows.map((row) => (
            <article key={row.supplierProductId}>
              <h3>{row.name}</h3>
              <p>SKU: {row.sku || row.supplierProductId}</p>
              <p>
                Supplier price field: {row.supplierPrice} · Reported stock:{" "}
                {row.reportedStock ?? "Unknown"}
              </p>
              <Button type="button" variant="store" disabled={busy} onClick={() => openDetail(row.supplierProductId)}>View product details</Button>
              <p className="muted">
                Currency, variant price, shipping and availability must be
                confirmed before listing.
              </p>
            </article>
          ))}
        </div>
      )}
      {detail && (
        <article className="order-card cj-detail" aria-label="CJ product detail" aria-busy={busy}>
          <h3>{detail.name}</h3>
          <p>CJ product ID: {detail.supplierProductId} · SKU: {detail.sku || "Not supplied"}</p>
          <ImageGallery images={detail.images} name={detail.name} />
          <p>Product price/range: {detail.supplierPrice ?? "Not supplied"} · Currency: not specified for this product field; see variant USD price below.</p>
          <p>Supplier snapshot: {new Date(detail.fetchedAt).toLocaleString()}</p>
          <label>Choose one variant ({detail.variants.length})
            <select className="store-select" value={variantId} disabled={busy} onChange={e => setVariantId(e.target.value)}>
              <option value="">Select a variant to inspect and import</option>
              {detail.variants.map(v => <option key={v.supplierVariantId} value={v.supplierVariantId}>{v.name} · {v.sku || v.supplierVariantId} · {v.supplierPrice ?? "Unknown price"} USD</option>)}
            </select>
          </label>
          {!detail.variants.length && <p>No variants returned. Import is unavailable.</p>}
          {selected && <>
            <h4>{selected.name}</h4>
            <p>Variant ID: {selected.supplierVariantId} · SKU: {selected.sku || "Not supplied"} · Option: {selected.option}</p>
            {selected.image && <ImageGallery images={[selected.image]} name={selected.name} />}
            <p>Supplier variant price: {selected.supplierPrice ?? "Not supplied"} · Currency: {selected.currency} (CJ documented currency). No MYR conversion or retail price has been set.</p>
            <h4>Reported variant stock</h4>
            {selected.inventories.length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Country</th><th>Total</th><th>CJ</th><th>Factory</th><th>Verification</th></tr></thead><tbody>{selected.inventories.map((i,index) => <tr key={index}><td>{i.countryCode ?? "Unknown"}</td><td>{i.total ?? "Unknown"}</td><td>{i.cj ?? "Unknown"}</td><td>{i.factory ?? "Unknown"}</td><td>{i.verified === "1" ? "Verified" : i.verified === "2" ? "Unverified" : "Unknown"}</td></tr>)}</tbody></table></div> : <p>Stock not supplied. This does not mean zero.</p>}
            <p>Stock is not reserved and is not copied into sellable store stock.</p>
            <p>Variant weight: {selected.weightGrams ?? "Unknown"} g · Dimensions: {selected.lengthMm ?? "?"} × {selected.widthMm ?? "?"} × {selected.heightMm ?? "?"} mm</p>
          </>}
          <h4>Available shipping information</h4>
          <p>Package weight: {detail.shipping.packingWeightGrams ?? "Unknown"} g · Logistics attributes: {detail.shipping.logisticsAttributes.join(", ") || "Not supplied"}</p>
          <p>CJ free shipping flag: {detail.shipping.freeShippingFlag === null ? "Not supplied" : detail.shipping.freeShippingFlag ? "Yes — destination eligibility unconfirmed" : "No"}.</p>
          <p>Destination-specific methods, freight price, delivery time, duties and eligibility are not supplied by this detail endpoint. Confirm a quote for the selected variant, quantity, dispatch warehouse and Malaysian address before publishing.</p>
          <Button type="button" variant="store" disabled={busy || !selected || imported} onClick={importProduct}>{imported ? "Already imported as draft" : busy ? "Checking CJ…" : "Import product"}</Button>
          <p>Imports only the selected variant as a draft. Supplier details are checked again on import. No publication or supplier order occurs.</p>
        </article>
      )}
      <h3>Imported products ({drafts.length})</h3>
      {!drafts.length && <p>No CJ drafts imported yet.</p>}
      {drafts.map(p => <article key={p.id} className="order-card">
        <h4>{p.name} · Draft</h4>
        <p>{p.options[0]} · Supplier price: {p.supplierSnapshot.variant.supplierPrice ?? "Unknown"} {p.supplierSnapshot.variant.currency}</p>
        <p>CJ product: {p.supplierProductId} · Variant: {p.supplierVariantId}</p>
        <p>Store ID: {p.id} · Saved: {new Date(p.createdAt).toLocaleString()}</p>
        <p>{p.status==='published'?'Published in the local shop. Test checkout only.':'Draft: hidden from catalogue and checkout. Edit, preview, then publish when ready.'}</p>
        <div className="my-3 flex flex-wrap gap-4">
          <Link className={buttonVariants({variant:"store",size:"store"})} href={`/admin/drafts/${encodeURIComponent(p.id)}`}>Edit</Link>
          <a className="text-link" href={`/admin/drafts/${encodeURIComponent(p.id)}/preview`} target="_blank" rel="noopener noreferrer">Preview ↗</a>
        </div>
        <Button type="button" variant="store" disabled={busy} onClick={() => {setDetail({...p.supplierSnapshot,variants:[p.supplierSnapshot.variant]});setVariantId(p.supplierVariantId);setError("");setMessage("Showing the saved import snapshot. Use a new CJ search to inspect current supplier data.");}}>Review supplier snapshot</Button>
      </article>)}
      <p>
        Storefront products remain local samples. Test orders never go to a
        supplier.
      </p>
    </section>
  );
}

function ImageGallery({images,name}:{images:string[];name:string}) {
  return images.length ? <div className="flex flex-wrap gap-3 my-4">{images.map((src,index) => <figure key={src} className="w-40 max-w-full"><div className="product-image-frame"><img src={src} alt={`${name} — supplier image ${index+1}`} width={160} height={160} loading="lazy" referrerPolicy="no-referrer"  onError={e => {e.currentTarget.hidden=true;}} /></div><figcaption className="text-sm">Supplier image {index+1} (unverified)</figcaption></figure>)}</div> : <p>No supported supplier images supplied.</p>;
}
