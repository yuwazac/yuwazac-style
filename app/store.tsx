"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { StoreDialog } from "@/components/store/store-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

import { productImage, money, type Product, type CartItem } from "@/lib/catalog";

// Malaysian states for checkout form
const states = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Labuan",
];

// Types

type Receipt = {
  id: string;
  total: number;
  status: string;
};

// Store page

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [option, setOption] = useState("");
  const [toast, setToast] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [state, setState] = useState("Kuala Lumpur");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Refs for dialogs and idempotency key

  const productDialog = useRef<HTMLDialogElement>(null);
  const bagDialog = useRef<HTMLDialogElement>(null);
  const key = useRef("");

  // Load products from the server

  async function load() {
    setLoading(true);
    setError("");

    try {
      const r = await fetch("/api/products", {
        cache: "no-store",
      });

      const data = await r.json();

      if (!r.ok) {
        throw Error(data.error);
      }

      setProducts(data.products);
    } catch {
      setError("Could not load the collection. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Load cart from localStorage and register service worker
  useEffect(() => {
    void load();

    try {
      const saved = JSON.parse(localStorage.getItem("ys-local-bag") || "[]");

      if (Array.isArray(saved)) {
        setCart(
          saved.filter(
            (x) =>
              typeof x.id === "string" &&
              typeof x.option === "string" &&
              Number.isInteger(x.qty) &&
              x.qty > 0 &&
              x.qty <= 20,
          ),
        );
      }
    } catch {}

    setReady(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Save cart to localStorage and hide toast after a delay

  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("ys-local-bag", JSON.stringify(cart));
      } catch {}
    }
  }, [cart, ready]);

  // Hide toast after a delay

  useEffect(() => {
    if (!toast) {
      return;
    }

    const id = setTimeout(() => setToast(""), 2800);

    return () => clearTimeout(id);
  }, [toast]);

  // Show product dialog when a product is selected

  useEffect(() => {
    if (selected) {
      productDialog.current?.showModal();
    }
  }, [selected]);

  useEffect(() => {
    if (bagDialog.current?.open) {
      document.getElementById("bag-title")?.focus();
      const content = bagDialog.current.lastElementChild;
      if (content) {
        content.scrollTop = 0;
      }
    }
  }, [checkout, receipt]);

  const visible = products.filter(
    (p) => filter === "All" || p.category === filter,
  );

  const count = cart.reduce((s, x) => s + x.qty, 0);

  const subtotal = cart.reduce(
    (s, x) =>
      s + (products.find((p) => p.id === x.id)?.priceCents || 0) * x.qty,
    0,
  );

  const shipping = ["Sabah", "Sarawak", "Labuan"].includes(state) ? 1500 : 800;

  function choose(p: Product) {
    setSelected(p);
    setOption(p.options[0]);
  }

  function add() {
    if (!selected) {
      return;
    }

    const allocated = cart
      .filter((x) => x.id === selected.id)
      .reduce((s, x) => s + x.qty, 0);

    if (allocated >= selected.stock) {
      setToast("No more sample stock available.");
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (x) => x.id === selected.id && x.option === option,
      );

      if (existing && existing.qty >= 20) {
        return prev;
      }

      return existing
        ? prev.map((x) =>
            x === existing
              ? {
                  ...x,
                  qty: x.qty + 1,
                }
              : x,
          )
        : [
            ...prev,
            {
              id: selected.id,
              option,
              qty: 1,
            },
          ];
    });

    // Show toast and close product dialog

    setToast(selected.name + " added to your bag");
    productDialog.current?.close();
    setSelected(null);
  }

  // Change quantity of a cart item, respecting stock and sample limits

  function change(index: number, delta: number) {
    const item = cart[index];
    const p = products.find((x) => x.id === item.id);

    const all = cart
      .filter((x) => x.id === item.id)
      .reduce((s, x) => s + x.qty, 0);

    if (delta > 0 && (item.qty >= 20 || !p || all >= p.stock)) {
      setToast("Sample stock limit reached.");
      return;
    }

    setCart((prev) =>
      prev
        .map((x, i) =>
          i === index
            ? {
                ...x,
                qty: x.qty + delta,
              }
            : x,
        )
        .filter((x) => x.qty > 0),
    );

    key.current = "";
  }

  function showBag() {
    setCheckout(false);
    setReceipt(null);
    setCheckoutError("");
    bagDialog.current?.showModal();
  }

  // Submit a order to the server

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setCheckoutError("");

    // Collect customer details from the form

    const data = new FormData(e.currentTarget);

    const customer = {
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: String(data.get("phone")),
      address: String(data.get("address")),
      city: String(data.get("city")),
      postcode: String(data.get("postcode")),
      state,
      country: "MY",
    };

    // Generate an idempotency key if not already set

    if (!key.current) {
      key.current = crypto.randomUUID();
    }

    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: key.current,
          customer,
          items: cart,
          paymentScenario: data.get("paymentScenario"),
        }),
      });

      // Parse the response JSON

      const result = await r.json();

      if (!r.ok) {
        if (r.status < 500) {
          key.current = "";
        }

        throw Error(result.error || "Could not place the test order.");
      }

      setReceipt(result.order);
      setCart([]);
      setCheckout(false);
      key.current = "";

      await load();
    } catch (e) {
      setCheckoutError(
        e instanceof Error
          ? e.message
          : "Unable to reach the server. Retry with the same details.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="announcement">
        Local test mode · Sample products · No real payment or supplier order
      </div>

      <header className="flex flex-wrap items-center justify-between gap-5 border-b px-[5%] py-5 lg:gap-7 lg:py-6">
        <Link className="brand" href="/">
          yuwazac
          <span>style.</span>
        </Link>

        <nav
          className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-sm lg:order-none lg:w-auto"
          aria-label="Main navigation"
        >
          {[
            ["All", "Shop all"],
            ["Phone", "Phone accessories"],
            ["Fashion", "Fashion accessories"],
          ].map(([id, name]) => (
            <a
              key={id}
              className="py-2 hover:underline underline-offset-4"
              href="#collection"
              onClick={() => setFilter(id)}
            >
              {name}
            </a>
          ))}
        </nav>

        <Button
          type="button"
          variant="ghost"
          onClick={showBag}
          className="h-11 gap-2 rounded-full px-4"
        >
          Bag
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {count}
          </span>
        </Button>
      </header>

      <main>
        <section className="hero mx-auto grid max-w-[1600px] grid-cols-1 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="hero-copy">
            <p className="eyebrow">Small details. Everyday difference.</p>

            <h1>
              Everyday essentials.
              <br />
              <em>Your style.</em>
            </h1>

            <p className="intro">
              For the phone in your hand and the places you’re going. Find the
              little things that feel like you.
            </p>

            <a
              href="#collection"
              className={buttonVariants({
                variant: "store",
                size: "store",
                className: "mt-8",
              })}
            >
              Explore the collection ↗
            </a>

            <p className="hero-note">
              Phone accessories &nbsp; / &nbsp; Fashion essentials
            </p>
          </div>

          <div className="hero-image">
            <img
              src="/assets/bag.jpg"
              alt="Navy everyday backpack in a sunlit studio"
            />

            <div className="image-caption">
              <span>THE EVERYDAY EDIT</span>
              <span>01 / Carry your style</span>
            </div>
          </div>
        </section>

        <div className="editorial-line">
          <span>Considered essentials</span>
          <span>Simple choices</span>
          <span>A little more you</span>
        </div>

        <section id="collection" className="collection">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Meet your next everyday favourite</p>

              <h2>The first collection</h2>
            </div>

            <p>Sample products & prices in MYR</p>
          </div>

          <div className="filters" role="group" aria-label="Filter collection">
            {[
              ["All", "All essentials"],
              ["Phone", "Phone accessories"],
              ["Fashion", "Fashion accessories"],
            ].map(([id, name]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {name}
              </button>
            ))}

            <span>{visible.length} essentials</span>
          </div>

          {loading ? (
            <p role="status">Loading the collection…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>

              <Button variant="store" onClick={load}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-6 sm:gap-y-9 lg:grid-cols-3">
              {visible.map((p) => (
                <article key={p.id}>
                  <button
                    className="product-image product-image-frame"
                    onClick={() => choose(p)}
                    aria-label={"View " + p.name}
                  >
                    <img
                      src={productImage(p)}
                      alt={p.name + " — sample image"}
                      loading="lazy"
                    />

                    <span className="tag">{p.category} essentials</span>
                  </button>

                  <div className="product-meta">
                    <div>
                      <p>
                        {p.category === "Phone"
                          ? "For your phone"
                          : "For your everyday"}
                      </p>

                      <h3>{p.name}</h3>

                      <p className="price">{money(p.priceCents)}</p>

                      <p>
                        {p.stock > 0
                          ? p.stock + " sample units"
                          : "Out of sample stock"}
                      </p>
                    </div>

                    <button
                      className="quick-add"
                      disabled={!p.stock}
                      onClick={() => choose(p)}
                      aria-label={"Choose " + p.name}
                    >
                      +
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="brand-note">
          <p className="eyebrow">Yuwazac Style</p>

          <h2>
            Good style is in
            <br />
            the little things.
          </h2>

          <p>
            Practical pieces for your daily routine.
            <br />
            One place for your phone and fashion essentials.
          </p>

          <a href="#collection">Find your everyday favourite ↗</a>
        </section>
      </main>

      <footer className="store-footer">
        <Link className="brand" href="/">
          yuwazac
          <span>style.</span>
        </Link>

        <p>Everyday essentials. Your style.</p>

        <Link className="text-link" href="/admin">
          Store admin
        </Link>

        <small>Local test version · Malaysia</small>
      </footer>

      <StoreDialog
        ref={productDialog}
        title="Product details"
        closeLabel="Close product"
        id="product-dialog"
        aria-labelledby="product-title"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div
            id="product-detail"
            className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8"
          >
            <div className="product-image-frame product-detail-image">
              <img
                src={productImage(selected)}
                alt={selected.name}
              />
            </div>

            <div>
              <p className="eyebrow">
                {selected.category} accessories · Sample
              </p>

              <h2 id="product-title">{selected.name}</h2>

              <p>{money(selected.priceCents)}</p>

              <p className="muted">{selected.description}</p>

              <label htmlFor="product-option">
                {selected.id === "case" ? "Phone model" : "Option"}
              </label>

              <select
                className="store-select"
                id="product-option"
                value={option}
                onChange={(e) => setOption(e.target.value)}
              >
                {selected.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>

              {selected.processingEstimate&&<p>Processing: {selected.processingEstimate}</p>}
              {selected.deliveryEstimate&&<p>Delivery: {selected.deliveryEstimate}</p>}
              <Button variant="store" disabled={!selected.stock} onClick={add}>
                Add to bag →
              </Button>

              <p className="muted">
                Local test stock. No supplier order is placed.
              </p>
            </div>
          </div>
        )}
      </StoreDialog>

      <StoreDialog
        ref={bagDialog}
        id="bag-dialog"
        aria-labelledby="bag-title"
        titleId="bag-title"
        title={
          receipt ? "Test order saved" : checkout ? "Test checkout" : "Your bag"
        }
        closeLabel="Close bag"
        drawer
      >
        {receipt ? (
          <div className="receipt">
            <p>
              Saved to your local database. No money was charged and nothing was
              sent to a supplier.
            </p>

            <p className="order-id">Reference: {receipt.id}</p>

            <h3>{money(receipt.total)}</h3>

            <p>
              Open <Link href="/admin">Store admin</Link> to review this test
              order.
            </p>

            <Button variant="store" onClick={() => bagDialog.current?.close()}>
              Continue shopping
            </Button>
          </div>
        ) : checkout ? (
          <form onSubmit={submit} className="checkout-form">
            <p className="muted">
              Use made-up details while testing. Delivery prices below are test
              estimates.
            </p>

            <fieldset disabled={busy}>
              <label>
                Full name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="email"
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={25}
                  autoComplete="tel"
                />
              </label>

              <label>
                Street address
                <input
                  name="address"
                  required
                  minLength={5}
                  maxLength={250}
                  autoComplete="street-address"
                />
              </label>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <label>
                  City
                  <input
                    name="city"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="address-level2"
                  />
                </label>

                <label>
                  Postcode
                  <input
                    name="postcode"
                    required
                    pattern="[0-9]{5}"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </label>
              </div>

              <label>
                State / territory
                <select
                  className="store-select"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label>
                Country
                <input value="Malaysia" readOnly />
              </label>

              <label>
                Test payment result
                <select className="store-select" name="paymentScenario">
                  <option value="approve">
                    Simulate successful payment — no charge
                  </option>

                  <option value="decline">Simulate declined payment</option>
                </select>
              </label>

              <div className="total-row">
                <span>Products</span>
                <span>{money(subtotal)}</span>
              </div>

              <div className="total-row">
                <span>Test delivery estimate</span>
                <span>{money(shipping)}</span>
              </div>

              <div className="subtotal">
                <span>Test total</span>
                <span>{money(subtotal + shipping)}</span>
              </div>

              {checkoutError && (
                <p role="alert" className="error">
                  {checkoutError}
                </p>
              )}

              <Button variant="store" type="submit">
                {busy ? "Saving test order…" : "Place test order — no charge"}
              </Button>

              <button
                className="text-link"
                type="button"
                onClick={() => setCheckout(false)}
              >
                Back to bag
              </button>
            </fieldset>
          </form>
        ) : cart.length ? (
          <>
            <p className="muted">Bag saved on this device.</p>

            {cart.map((item, i) => {
              const p = products.find((p) => p.id === item.id);

              return (
                <div className="bag-item" key={item.id + item.option}>
                  {p && (
                    <img src={productImage(p)} alt={p.name} />
                  )}

                  <div>
                    <h3>{p?.name || "Unavailable product"}</h3>

                    <p>
                      {item.option} ·{" "}
                      {p ? money(p.priceCents) : "Reload collection"}
                    </p>

                    <div className="quantity">
                      <button
                        aria-label={"Decrease " + p?.name}
                        onClick={() => change(i, -1)}
                      >
                        −
                      </button>

                      <span>{item.qty}</span>

                      <button
                        aria-label={"Increase " + p?.name}
                        onClick={() => change(i, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    className="remove"
                    onClick={() => {
                      setCart((prev) => prev.filter((_, j) => j !== i));

                      key.current = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}

            <div className="subtotal">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>

            <p className="muted">Delivery estimated at test checkout.</p>

            <Button
              variant="store"
              disabled={loading || !!error}
              onClick={() => {
                setCheckout(true);
                setCheckoutError("");
              }}
            >
              Continue to test checkout →
            </Button>
          </>
        ) : (
          <div className="empty">
            <h3>A little room for something you.</h3>

            <p className="muted">Your bag is empty.</p>

            <Button
              variant="store"
              onClick={() => {
                bagDialog.current?.close();

                document.getElementById("collection")?.scrollIntoView();
              }}
            >
              Explore the collection
            </Button>
          </div>
        )}
      </StoreDialog>

      <div
        className={"toast " + (toast ? "visible" : "")}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  );
}
