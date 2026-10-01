# Yuwazac Style

## Outcome and primary user
Deliver a locally testable phone/fashion accessories commerce app for Yuwazac, preserving the selected Sunday storefront design. Build toward one verified supplier and eventual web/Android launch.

## Latest user decisions
- Brand: Yuwazac Style; Design 1; phone accessories and fashion.
- Local testing before publication. Do not publish this project or activate live commerce.
- Prefer Malaysian suppliers if they offer approved custom API access; otherwise use an international supplier with a documented API.
- Future goal: Google Search visibility and Google Play availability. Neither is complete.

## Locked local MVP (five capabilities)
1. Responsive catalogue and product options.
2. Device-local bag and server-priced test checkout.
3. SQLite persistence, transactional stock checks, idempotency and order lifecycle.
4. Protected single-owner admin and test tracking updates.
5. Supplier configuration plus documented CJ catalogue search/detail and local variant import and explicitly validated publication to the local test shop.

## Later / explicit non-goals for this checkpoint
Real payments/refunds, supplier purchases/live stock sync/webhooks, customer accounts, production multi-user authentication, transactional emails, multi-currency/tax engine, real cross-border shipping quotes, public deployment, Play submission. Do not pretend a test order is a supplier order.

## Stack and setup
Next.js 16.3.6 App Router, React 19.3.0, TypeScript, Zod 4; Node.js 24 LTS builtin node:sqlite. No native database install or cloud DB account needed locally.
Scaffold: manually authored App Router around existing selected static design; `npm install` produced package-lock.json. Preserve the lockfile; use `npm ci`.
Docs: https://nextjs.org/docs/app ; https://developers.cjdropshipping.com/en/api/api2/api/auth.html ; https://developers.cjdropshipping.com/en/api/api2/api/product.html

## Route/data map
- `/`: storefront, product modal, bag, test checkout, receipt.
- `/admin`: owner login, local orders, supplier status/search.
- GET `/api/products`: local seeded inventory.
- POST `/api/orders`: validated Malaysia-address test order, no real payment or supplier action.
- POST `/api/admin/login`, POST `/api/admin/logout`: local single-owner session.
- GET/PATCH `/api/admin/orders`: protected list and transition.
- GET/POST `/api/admin/supplier`: configuration status and CJ product search.
- POST `/api/admin/supplier/detail`: protected live CJ detail. GET/POST `/api/admin/supplier/import`: protected local draft list/import.
- `/admin/drafts/[id]`: protected draft editor; `/admin/drafts/[id]/preview`: protected saved storefront-style preview. GET/PATCH `/api/admin/drafts/[id]`: protected read/edit with same-origin writes and revision conflicts.
- SQLite: products (JSON metadata + stock), orders (immutable customer/item snapshots + integer-cent totals), audit, settings. Only seeded on first DB creation; never clears existing orders automatically.

## Environment (no secrets here)
APP_ORIGIN, ADMIN_KEY, SESSION_SECRET, DATABASE_PATH; optional CJ_API_KEY. Generated private .env.local is excluded from packages and Git.

## Commands
- `npm ci` then `npm run setup`; open .env.local privately for ADMIN_KEY.
- `npm run dev`: localhost development, bound to loopback.
- `npm run typecheck`; `npm test`; `npm run build`; `npm start`.
- `npm run test:drafts:http`: after build, isolated loopback HTTP checks for draft save/reload/preview; mocked CJ and temporary database.
- No lint configuration yet. Type check + build + targeted commerce tests are the local gate; do not claim lint ran.
- Deployment intentionally disabled by user instruction. SQLite design requires a durable Node server or migration to a hosted DB, not ephemeral/serverless storage.

## Architecture/gotchas
- Keep prices server-authoritative and integer cents. Aggregate duplicate product options before decrementing stock; use an immediate transaction.
- Checkout is hardcoded to test payments; no live provider or order-submission function exists.
- All test shipping prices are estimates. Checkout currently accepts Malaysia addresses only; this is a test fixture, not a restriction on future supplier choice.
- ADMIN_KEY uses timing-safe comparison; session is HMAC-signed, HttpOnly and SameSite Strict. CSRF protection checks APP_ORIGIN. Development rate limit is process-local; production needs persistent rate limiting and full auth review.
- Use exactly http://localhost:3000 in browser unless APP_ORIGIN is changed. Do not use 127.0.0.1 in browser with localhost origin configuration.
- Product images use shared 4:3 neutral frames with 12px padding and object-fit contain. Detail/preview frames cap at 400px and shrink on mobile; catalogue frames fill their cards.
- Native dialog handles focus and Escape. PWA uses network-only navigation with an offline message. No admin/order data is service-worker cached.
- CJ credentials/tokens never reach the client. Fixed CJ host; request timeout; sequential 1.1-second gap; in-memory token cache. No automatic repeated polling or paid order calls.
- CJ parser checked with documented response fixtures only. Actual API/permissions/quota not tested without a user key. Do not claim supplier connected until a live request succeeds.
- CJ detail/import saves allowed image URLs and normalized supplier snapshots, never HTML or image files. Variant prices are documented USD; no MYR conversion. New drafts have null retail price/category and zero sellable stock, and are excluded from public catalogue and checkout. Owner can edit title, plain-text description, image URLs, category, MYR price and processing/delivery estimates while retaining draft status on draft saves. Explicit publication requires complete listing fields and positive owner-entered local test stock; published imports remain editable. Publishing is local only, with no live payment or CJ order. CJ IDs/options/snapshot are preserved; edit and preview never call CJ. Unique CJ product/variant identity prevents duplicate imports. Existing sample products retain visibility through an additive schema migration.
- `node:sqlite` requires the supplied Node 24 runtime; local filesystem DB is not compatible with a Cloudflare Worker runtime.

## Phase/checkpoint/blocker
Phase: local core/data slice verified; not release-ready.
Verified: production build including TypeScript; fourteen commerce/CJ parsing, draft-import and draft-edit tests. See README for exact limitations. HTTP smoke checks passed for auth/logout, CSRF, missing supplier key, persisted order, totals, idempotency and tracking validation.
Draft import verified with fixtures and isolated HTTP tests (auth/CSRF, duplicate retry, restart persistence, catalogue/checkout exclusion). Draft edit/save/reload/preview also verified with isolated production HTTP checks, including restart persistence and protected preview HTML. No live CJ access or browser visual QA claimed.
Active blocker: live supplier access, verified catalogue and freight terms unavailable.
Next action: owner runs local app, then adds a CJ API key privately and verifies catalogue search, or supplies official approved Malaysian supplier API docs.

## Definition of done
Local checkpoint: installs, runs, persists a test checkout across reads, rejects invalid input, protects admin, handles order transitions, builds, includes setup docs.
Real launch: verified product/variant/stock mapping, live quote → paid order → supplier fulfilment → tracking → refund path, production auth, shipping/returns/privacy terms, mobile QA, production smoke test, followed by Android signing/domain association and Play review. These are not complete.
