# Yuwazac Style — local commerce app

Design 1, with phone accessories and fashion accessories. This is a working **local test foundation**, not a live shop or Play Store release.

## Start on your Mac

Use **Node.js 24 LTS**. Extract the ZIP, open Terminal in the `yuwazac-style-local` folder, then:

```bash
npm ci
npm run setup
npm run dev
```

Open **http://localhost:3000**. The server binds to your computer only. Keep Terminal open.

For admin, open **http://localhost:3000/admin**. Open `.env.local` privately in your editor and copy the value after `ADMIN_KEY=` into the login. Do not share that value or commit `.env.local`. `npm run setup` preserves an existing configuration.

## Tijaabada koowaad (Somali)

1. Fur http://localhost:3000.
2. Dooro product, dooro option/model, kadib ku dar bag-ka.
3. Fur bag-ka → Continue to test checkout.
4. Geli xog tijaabo ah, tusaale `Test Buyer`, `buyer@example.com`, `+60123456789`, `123 Test Street`, `Kuala Lumpur`, `50000`.
5. Dooro “Simulate successful payment” kadib “Place test order”. Lacag lagama qaadayo.
6. Fur `/admin`, gal adigoo adeegsanaya ADMIN_KEY, kadib arag dalabka.
7. U beddel `processing`, kadib `shipped` adigoo gelinaya tracking tijaabo ah. Suppliers looma dirayo dalabka.

Database-ka waxaa lagu abuuraa `data/yuwazac.sqlite`. Dalabku wuu joogayaa marka app-ka la damiyo oo la shido. Bag-ku browser-ka ayuu ku kaydsan yahay. Xog dhab ah ha isticmaalin inta aad tijaabinayso.

## Implemented

- Responsive selected storefront, two collections, six illustrative products and options.
- Local cart, quantity/remove actions and empty/error states.
- Server-controlled price calculation in MYR, stock checks and transactional persistence.
- Test approved/declined payment flow. Approved means simulated only.
- Idempotency prevents duplicate orders on retry. Cancellation returns stock once.
- Owner admin, cookie session, order list, status transitions and test tracking.
- CJ API configuration detection, authenticated search/detail views, and local draft import of one selected variant.
- Web manifest, install icons and network-only service worker with offline message. No personal data is cached by the worker.

## Supplier decision

User preference: Malaysia supplier if approved custom API exists, otherwise an international supplier with a documented API.

**Kumoten** permits selling through your own website, and publishes marketplace integration guidance. Its public FAQ does not establish custom developer API access for this app. **SaveValue2u** documents marketplace sync; custom API access remains unverified. This is not proof that private/partner APIs do not exist.

**CJdropshipping** has public authentication, products, inventory, logistics and orders documentation. This package implements the first bounded connector: authenticate, read catalogue search/details, and save a selected variant as a local draft. No CJ key was available during development, so live connectivity is unverified. It does not submit orders or charge a CJ wallet.

### Test CJ after local checkout works

1. Use your CJ account to enable its API app and create an API key using the official instructions below.
2. Add `CJ_API_KEY=your_private_key` to `.env.local` yourself. Do not use a `NEXT_PUBLIC_` variable.
3. Restart the local app.
4. Sign in to `/admin`, find Supplier connections, and search `phone case`.
5. Only a successful response verifies that your key and product-search permission work. API account limits/points may apply.

Search results and unpublished drafts stay in admin. Explicitly publishing an imported product adds it to the local test shop. Before publication confirm variant IDs, price currency, shipping origin/destination, stock and product/image usage. Before fulfilment we must verify real freight, payment, idempotent supplier-order creation, status sync and failure/refund handling.

An international supplier can still serve a Malaysia-focused test market. Supplier location and customer market are separate decisions. This checkpoint retains Malaysian test addresses and MYR; it does not claim international checkout readiness.

## Verified and limitations

`npm test` covers commerce totals, idempotency, cancellation, stock, lifecycle, CJ search/detail parsing, draft persistence, legacy schema migration, duplicate import prevention, and draft checkout exclusion.

`npm run build`: production bundle and TypeScript check passed. HTTP smoke checks passed for storefront, admin login/logout, CSRF rejection, missing CJ key, order persistence, authoritative totals, idempotent retry and required tracking. No browser visual QA or Android-device install test was available in this run. No lint configuration has been added.

The starter is deliberately **not production-ready**. Missing: real gateway, reviewed supplier publication and live stock sync, automatic fulfilment, verified shipping/tax calculations, notifications, production customer/owner auth, legal/store policies and deployment hardening. Local API keys are stored only in `.env.local`; login throttling is per process.

### Web, Google and Play Store

The responsive website is the shared foundation. The manifest/service worker prepares for installation, but does not publish anything to Google Play. Later: host on HTTPS with a domain, verify the web app on mobile, build/sign an Android Trusted Web Activity, configure Digital Asset Links, complete Play Console requirements and submit for review. A public crawlable site with SEO and Search Console is a separate step; search ranking/indexing is never guaranteed. Local pages are currently `noindex`.

No public deployment has been made. There is no APK/AAB in this package.

## Commands

```bash
npm run typecheck
npm test
npm run build
npm start
```

If port 3000 is occupied, stop the other local app or change both the port and `APP_ORIGIN`. For example set `APP_ORIGIN=http://localhost:3001` and run `npm run dev -- --port 3001`.

To start a fresh demo database, first stop the server and **move** the `data` folder to a backup location. On next start a new database is seeded. Existing databases are never cleared automatically.

## Official references checked 2026-09-26

- Kumoten own-site FAQ: https://www.kumoten.com/helps
- Kumoten marketplace integration: https://www.kumoten.com/lazada-shopee?setLang=en
- SaveValue2u sync: https://www.savevalue2u.com.my/how-to-sync.php
- CJ authentication/key setup: https://developers.cjdropshipping.com/en/api/api2/api/auth.html
- CJ product search: https://developers.cjdropshipping.com/en/api/api2/api/product.html
- CJ integration flow: https://developers.cjdropshipping.com/en/api/start/Products-Synchronization-Processing.html
- CJ sandbox: https://developers.cjdropshipping.com/en/api/start/sandbox.html
- Android Trusted Web Activity: https://developer.chrome.com/docs/android/trusted-web-activity/

Sample photographs are from Unsplash, reused from the approved design previews. They are illustrative, not supplier product evidence. Source photo IDs: bag `photo-1553062407-98eeb64c6a62`, headphones `photo-1505740420928-5e560c06d30e`, watch `photo-1523275335684-37898b6baf30`, phone `photo-1603891128711-11b4b03bb138`, sunglasses `photo-1511499767150-a48a237f0083`, cap `photo-1588850561407-ed78c282e89b`.

## CJ detail and draft import (2026-09-29)

In `/admin`, search CJ → **View product details** → select a variant → **Import product**. Saved imports appear under **Imported products**, including after restarting the app; **Review saved draft** shows the stored snapshot without another CJ request. Search again for current data. The editor supports validated publication to the local test shop.

- The detail view shows allowed HTTPS product/variant images, IDs/SKUs/options, supplier prices, inventory split by country/CJ/factory, weights/dimensions, logistics attributes and the reported free-shipping flag. Missing values stay unknown; unknown stock is not zero.
- CJ documents `variantSellPrice` in USD. The product-level price field has no explicit currency in this endpoint's field definition, so it remains unspecified. No FX conversion or MYR retail price is invented.
- Destination-specific freight methods, cost and delivery estimates are unavailable from the detail endpoint. A free-shipping flag is not a Malaysia quote. This feature does not call logistics or ordering endpoints.
- Import accepts only product/variant IDs, fetches authoritative details again on the server, validates membership, and saves one variant's snapshot. The refreshed snapshot can differ from the preview; review the saved draft. A retry returns the existing record without updating its snapshot.
- The additive SQLite migration adds product status and CJ identity columns, preserving existing products and orders. A unique index on `(cj_product_id,cj_variant_id)` prevents duplicates, including concurrent inserts. Existing samples retain their prior visibility. CJ imports have `status=draft`, null retail price/category and zero sellable stock; both public catalogue and checkout exclude them.
- New endpoints: admin-only `POST /api/admin/supplier/detail`, `GET/POST /api/admin/supplier/import`. POST requests require the configured same origin. API responses are not cached. Credentials remain in server environment/token cache. Supplier HTML is neither rendered nor imported. Images are displayed directly from allowed CJ/CDN HTTPS hosts with no referrer and URLs are saved, not image files.
- All CJ calls remain bounded by timeout, a shared in-flight guard and a 1.1-second spacing. Import only writes local SQLite; it never calls CJ add-to-my-products, order or payment APIs.

### Supplier verification needed before a real launch

1. **Live access and identity:** successful search/detail using your private CJ key and permitted quota; exact product ID, variant ID, SKU, model/size/colour and included contents. Confirm the listing is still available and the supplier accepts fulfilment for it.
2. **Content and quality:** correct variant images and permission to reuse them; truthful title/description, compatibility, materials, dimensions, sizing, certifications/safety claims and category. Inspect a sample when needed. Supplier images/specifications remain unverified.
3. **Price:** actual current account price in USD, any variant/MOQ or quantity conditions, fees, FX rate, tax/duties and landed cost; choose a profitable MYR retail price. No retail price is set by import.
4. **Inventory:** current stock for the exact variant and dispatch warehouse, CJ versus factory/unverified inventory, replenishment/processing time, and a policy for stale/out-of-stock data. Imported stock is only a timestamped snapshot, never a reservation.
5. **Shipping:** actual quote for the selected variant, quantity, dispatch country/warehouse and Malaysian destination/postcode; supported carrier/method, freight currency/cost, tracking, processing/transit estimates, remote-area charges, batteries/restrictions, duties/taxes and any claimed free-shipping eligibility.
6. **After-sales:** cancellation window, returns address, return freight responsibility, defective/lost parcel handling, refunds and customer-facing shipping/returns/privacy terms.

These confirmations do not make the app launch-ready. A production publication review, real payment/refund path, supplier fulfilment/tracking integration, stock revalidation, production authentication and durable hosting, mobile QA and production smoke tests still need implementation/verification. Deployment and live commerce remain disabled.

Detail mapping reference: https://developers.cjdropshipping.com/en/api/api2/api/product.html (checked 2026-09-29). New tests use documented-shape fixtures and a mocked CJ transport; no successful live CJ detail/import request is claimed.

Validation for this change: `npm run typecheck`, all 10 `npm test` cases and `npm run build` passed. Isolated production-server HTTP smoke checks with mocked CJ responses passed for anonymous access rejection, CSRF, strict import payloads, detail retrieval, mismatched variant rejection, draft creation/retry, no credential exposure, public catalogue exclusion, checkout rejection and persistence across a server restart. These checks used synthetic credentials and a temporary database, not the owner's data. Browser visual QA and live CJ API access remain unverified. No lint command is configured or claimed.

## Edit and preview imported drafts

Under `/admin` → **Imported products**, choose **Edit**. Change the title, plain-text description, image URLs (one per line, first is the main image), Phone/Fashion category, selling price in MYR, and processing/delivery estimates. Choose **Save draft**, then **Preview saved draft**. The preview opens in a new tab using the storefront product-detail layout; its purchase button is disabled. The draft list also has a **Preview** link.

- Edits persist in SQLite. Existing imported drafts work without a data reset. Empty price/category remain unset; optional content and images can be cleared while drafting.
- Selling prices accept at most two decimal places and are stored as integer MYR cents. Supplier USD costs are preserved separately and never converted automatically.
- Images are up to 12 HTTPS URLs or existing `/assets` image paths, not uploads. Reorder/remove them by editing the lines. They load directly in the browser with no referrer; the server does not fetch or proxy them. Description and estimates render as plain text.
- CJ product/variant IDs, selected option and original supplier snapshot are preserved. Draft saves stay hidden; published product saves retain published status. Local test stock is owner-entered and never synced from CJ. Reimporting the same CJ variant preserves your edits.
- Unsaved changes must be saved before previewing that version. Preview reads the persisted draft; reload an existing preview tab after later edits. A version check rejects conflicting saves from another tab without overwriting either silently.
- Protected routes: `/admin/drafts/[id]` and `/admin/drafts/[id]/preview`; protected read/write API: `GET/PATCH /api/admin/drafts/[id]`. Writes require the configured origin. Preview is dynamic, uncached and not indexed; anonymous visitors are redirected to admin login before any draft is read.

The original draft-editing checkpoint added no publication workflow. Local publication is now supported as described below; supplier requests, stock sync and live commerce are still excluded. Processing and delivery estimates are owner-entered copy, not verified freight quotes.

Draft editing verification: `npm run typecheck`, all **13** `npm test` cases, and `npm run build` passed. `npm run test:drafts:http` (run after building; requires localhost port 3197) verifies authenticated editing, CSRF, immutable fields, exact MYR values, reloading, conflict handling, protected preview HTML, escaped descriptions, disabled purchasing, and save/preview persistence across a server restart. The HTTP check uses mocked CJ, synthetic credentials and a temporary database that is removed afterward. These checks passed; browser visual interaction testing remains unverified.

## Product image layout verification

Product image frames use a shared 4:3 ratio, neutral background, 12px padding and centered `object-fit: contain`. Catalogue frames stay within their cards; storefront detail and admin preview frames have a 400px maximum width and shrink to fit mobile. The old mobile fixed image height and card hover zoom were removed.

Verified in headless Chrome at 390×844 (mobile) and 1440×1000 (desktop), using the actual imported phone-case images. Checked catalogue, product dialog and protected admin preview: all frame ratios were 4:3, images loaded and matched their frame bounds, containment/centering/padding were applied, and pages had no horizontal overflow. Desktop preview frames measured 400×300; mobile preview frames measured 350×262.5. Screenshots and measurements are in `artifacts/image-layout/`.

The browser check used an isolated database and a browser-only catalogue fixture to exercise the imported draft in storefront components; no product was published or changed in the owner's database. Typecheck, all 13 tests and production build passed. This verifies responsive browser layout, not physical-device testing.

## Local product publishing (2026-10-01)

Under **Imported products**, choose **Edit**. Set the title, Phone/Fashion category, selling price in MYR, at least one image, processing estimate, delivery estimate and positive **Local Test Stock (test inventory)**. Choose **Publish to local shop**, then **Open shop**. Refresh an already-open shop tab to fetch the updated catalogue. Select the product and choose **Add to bag**. Publishing does not deploy the website, verify shipping, charge a payment or order from CJ.

Server validation rejects incomplete publication atomically. Drafts stay excluded from public catalogue and checkout; published imports use their saved main image and delivery copy. Published imports remain accessible through the admin Edit button. Revision checks, admin sessions and same-origin protection apply to publication as well as saves. Stock is a local test allocation; review it before saving a published product. Preview remains a protected, purchase-disabled view even after local publication.

`npm run test:drafts:http` checks publication validation, auth/CSRF, storefront API visibility and restart persistence in addition to existing draft checks. To include the browser smoke check, set `PLAYWRIGHT_MODULE` to the absolute path of an installed Playwright `index.mjs`; it uses installed Google Chrome to verify imported product visibility, add-to-bag, and 390/1280px detail frames. No production dependencies or lockfile changes are needed for this optional browser check.

Final local-publishing verification: typecheck, all 14 tests, and production build passed. The isolated production HTTP/browser check passed Edit → Publish, publication validation/auth/CSRF, draft exclusion, published storefront visibility, add-to-bag persistence, and server restart persistence. Chrome at 390px and 1280px verified loaded images, horizontal 4:3 frames, centered containment, 12px padding, detail/preview widths at or below 400px, and no horizontal overflow on detail/preview pages. Measurements are saved in `artifacts/publishing/measurements.json`. Screenshot capture timed out in the first run; the successful final run verified DOM/computed layout and interaction without screenshots. No physical-device, live CJ, real-payment or supplier-order verification is claimed.

The draft editor uses a required, editable Local Test Stock (test inventory) number input. Its current `valueAsNumber` is read before the form is disabled and sent as numeric `testStock` in the PATCH payload; blank values are blocked by the form. Publishing validation still requires a positive integer local allocation. The browser smoke check asserts that entering 4 sends `testStock: 4`.
