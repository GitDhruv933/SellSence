# SellSence — combined project (separate customer & vendor sites)

Built to match the requirements doc (client + vendor marketplace: nearby
shops, per-shop cart, high-alert vendor notifications, vendor-generated
bills, delivery, shop registration with item catalogs, vendor analytics).

There are **three apps** here, sharing one backend/database:

- **`backend/`** — Node/Express + SQLite API (the `Dukaan-Manager-2` vendor
  backend, extended with customer accounts, shop location, orders, and
  notifications). Both frontends call this same server.
- **`frontend-customer/`** — the shopping site. Signup here always creates a
  `customer` account. Browses nearby shops, adds to cart, checks out.
- **`frontend-vendor/`** — the shop-management site. Signup here always
  creates a `vendor` account (with shop name/category/location). Manages
  inventory, sees incoming orders with high-alert badges, generates bills,
  and views sales analytics.

Each frontend is its own Vite project with its own `package.json`, so they
build and deploy independently (e.g. `shop.example.com` and
`vendor.example.com`), while talking to the same API.

### Why two accounts can't cross over

Both roles live in the same `users` table on the backend (so a phone number
is unique across the whole platform), but each site enforces its own role at
the UI level: if a vendor account logs into the customer site (or vice
versa), that site shows a "wrong site" screen and logs them out, instead of
rendering a broken view. Signup on each site is hardcoded to the matching
role, so there's no toggle to pick the wrong one by accident.

## Running it

**Requires Node.js 22.13+ (or any Node 23.4+/24.x).** The backend uses
Node's built-in `node:sqlite` module for the database instead of
`better-sqlite3` — this avoids native compilation entirely, so there's no
Visual Studio / build-tools requirement on Windows. It ships an
`ExperimentalWarning` on startup (SQLite is a release candidate as of
Node 24, not yet marked fully stable) — safe to ignore for this project.

```bash
# 1. Backend (one server, shared by both sites)
cd backend
npm install
cp .env.example .env   # set JWT_SECRET at minimum
npm run dev             # http://localhost:4000

# 2. Customer site
cd frontend-customer
npm install
npm run dev              # http://localhost:5173

# 3. Vendor site (separate terminal)
cd frontend-vendor
npm install
npm run dev              # http://localhost:5174
```

Each frontend's `.env` points `VITE_API_URL` at the backend
(`http://localhost:4000` by default). `frontend-customer/.env` and
`frontend-vendor/.env` also cross-link to each other
(`VITE_VENDOR_APP_URL` / `VITE_CUSTOMER_APP_URL`) so each site can show a
"wrong site? go here" link — update these to your real deployed URLs in
production.

To try the full flow: register a shop on the vendor site (add a few
products under Inventory), then open the customer site in another
browser/incognito window, browse to that shop, add items, and check out.
The vendor site's Orders tab will show the new order with a pulsing
"HIGH ALERT" badge; generate the bill from there.

## What's shared vs. duplicated

The two frontends are separate Vite apps (so they can be deployed and
scaled independently), which means some code is intentionally duplicated
between them rather than shared via a workspace/monorepo setup:

- `api/client.ts`, `api/types.ts`, `context/AuthContext.tsx`,
  `hooks/useGeolocation.ts` — identical in both.
- `api/adapters.ts` — customer app only (maps backend records to the shop
  browsing UI).
- Components are split by role: `CustomerView`, `CartDrawer`, `ProductCard`
  only exist in `frontend-customer`; `VendorDashboard`, `InventoryTable`,
  `AIAssistant`, `SalesChart`, `StatCard` only exist in `frontend-vendor`.

If you'd rather have one shared package for the common code (via npm
workspaces or a monorepo tool), that's a reasonable next step but wasn't set
up here to keep each app a plain, independently-buildable Vite project.

## Backend changes (unchanged from the single-app version)

- `users` table: added `role` (`customer`/`vendor`), `shop_category`,
  `address`, `latitude`, `longitude`.
- New tables: `orders`, `order_items`, `notifications`.
- `routes/shops.js` *(public)* — nearby-shop search (haversine distance) +
  per-shop product listing.
- `routes/orders.js` — checkout → stock reservation → **high-priority
  notification** to the vendor → status progression
  (`pending → confirmed → preparing → out_for_delivery → delivered`) →
  **bill generation** (also records the sale, so it feeds `/analytics`).
- `routes/notifications.js` — vendor alert inbox.
- `routes/analytics.js` — added `/analytics/monthly` for the sales chart.
- `cors()` is unrestricted, so both frontend origins can call it. Lock this
  down to your real site origins before deploying to production.

## Ward market-expansion analysis (vendor site → "Ward Analysis" tab)

A 7-step workflow for scoring/classifying municipal wards (e.g. to pick
where to expand), matching a PCA-based ward-vulnerability methodology
(min-max normalization → KMO/Bartlett → PCA → SD-based 5-band
classification), done in Python instead of SPSS:

1. **Boundary + area, cross-checked with WorldPop/GHSL** — run
   `backend/scripts/gee_ward_boundary.py` on your own machine (it needs
   your own Google Earth Engine account: `pip install earthengine-api` +
   `earthengine authenticate`), then paste its JSON output into the
   "Attach boundary" box for that ward in the Ward Analysis tab, or POST
   it directly to `POST /ward-analysis/boundary/:wardId`.
2. **Census-style indicators** — enter population density, household
   density, and % socially-weaker-section for your target ward plus up to
   24 comparison wards in the editable table (`POST /ward-analysis/wards`
   saves the whole set at once). PCA needs the full 25-ward spread to mean
   anything — a single ward can't be scored in isolation.
3–6. **Normalize → KMO/Bartlett → PCA → classify** — "Run classification"
   calls `POST /ward-analysis/classify`, which shells out to
   `backend/scripts/ward_pca.py`. Returns per-ward category (Very Low /
   Low / Medium / High / Very High), the composite PCA score, KMO/Bartlett
   diagnostics, and variance-explained/loadings.
7. **Map** — the tab renders every ward with an attached boundary as an
   SVG polygon colored by its resulting category (no mapping library
   dependency; a plain equirectangular projection, fine at city scale).

Needs Python 3 with `numpy`, `scipy`, and `scikit-learn` on the backend
host (`pip install numpy scipy scikit-learn`); set `WARD_PYTHON_BIN` if
`python3` isn't on `PATH`.

## Local Business Report (vendor site → "Business Report" tab)

`GET /business-report` (`routes/businessReport.js`) computes what's
actually measurable from the app's own data, then has Claude (or a
rule-based fallback if `ANTHROPIC_API_KEY` isn't set) write a narrative
grounded in those numbers — it's never given room to invent statistics:

- **Nearby customers** — counts registered customers within a near radius
  (default 5km) and a far radius (default 10km) of the vendor's own
  location, via the same Haversine distance used by `/shops`.
- **Competitor mapping** — other vendors within the far radius whose
  `shop_category` free-text matches the same category bucket as this shop.
- **Missing business opportunities** — checks a curated list of common
  hyperlocal categories (grocery, pharmacy, bakery, dairy, salon, etc.)
  against what's actually present nearby and reports the gaps.
- **Suggested pricing** — needs a local-income signal to say anything:
  either pass `?avg_local_income=<monthly rupees>`, or, if this vendor has
  a target ward saved from Ward Analysis, its socially-weaker-section % is
  used as an inverse income proxy. With neither, pricing is skipped rather
  than guessed. When available, it buckets into budget/mid/premium and
  shows a suggested margin range against this vendor's own product cost
  prices.
- **SWOT + local risks** — written by Claude from the computed numbers
  above (`source: "ai"` in the response), or a rule-based template built
  from the same numbers if no API key is set (`source: "rule-based"`).

## Smart Financial Calculator (vendor site → "Financial Calculator" tab)

`POST /financial-calculator/estimate` (`routes/financialCalculator.js`) is
pure arithmetic, no AI call:

- Takes the vendor's available money as their contribution (10% by
  default, overridable) and derives total project cost and max loan
  eligibility (90% of cost, by default).
- Auto-picks **Micro Finance** vs **Term Loan** based on a configurable
  project-cost cutoff (₹10 lakh by default).
- Builds a full month-by-month repayment schedule: interest-only during
  the moratorium period, then a standard amortizing EMI.
- Estimates working capital needs from this vendor's own last-90-days
  purchase history when available, falling back to a rule-of-thumb % of
  project cost for a brand-new business with no history yet.

**Every rate, tenure, and threshold used is an illustrative default**,
not a verified figure from any specific bank or scheme — all overridable
per-request, and the response always carries a `disclaimer` field. This is
a planning calculator, not a loan pre-approval; real eligibility depends
on the actual lender.

## Known gaps / notes

- No real product photos — generated placeholder avatars are used instead.
- "Nearby" uses the browser's geolocation API with a Bengaluru fallback.
- Delivery is a status field only, no live courier tracking.
- `backend/.env.example` — set `SMS_PROVIDER`/keys for real OTP SMS, or
  leave unset for console-only OTP in development.
- Not build-tested end-to-end (no network access for `npm install` in the
  environment this was built in). Backend syntax-checked with
  `node --check`; both frontends type-checked with `tsc --noEmit`
  (real type errors fixed; remaining noise was only missing
  `node_modules`, which `npm install` resolves). Run `npm install` in all
  three folders locally to fully verify.
