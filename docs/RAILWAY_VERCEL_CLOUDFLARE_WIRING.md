# SMART_TECH — Railway + Vercel + Supabase + Cloudflare Wiring Guide

Exact variables, URLs, DNS records, and **exactly where** to set each one to link the
Digital Signature Service (Part B) into the main platform (Part A), under your single
Railway Hobby-plan project.

> ## ⛔ Cost + security rule (remember)
> - **Postgres lives ONLY in Supabase.** Never create a database in Railway.
> - The **Part B `/internal/*` API must NEVER be public.** It is called only from the
>   main backend over the Railway **private network** (`x-service-key` auth).
> - Cloudflare (smarttechsaas.com) is the DNS + proxy host for **every public hostname**.

---

## 0. Domain plan (all `*.smarttechsaas.com` via Cloudflare)

| Hostname | Hosting | Purpose |
|---|---|---|
| `smarttechsaas.com` + `www` | Vercel (landing) | Landing site |
| `app.smarttechsaas.com` | Vercel (app-portal) | Staff portal app |
| `verify.smarttechsaas.com` | Vercel (verify-site) | Public document verify |
| `api.smarttechsaas.com` | **Railway** service `smart-tech-saas` | Main API (Part A) |
| `signature.smarttechsaas.com` | **Vercel** (Part B UI) | Operator UI for signatures (only if you deploy it) |
| *(none)* | **Railway** service Part B | Signature API — **private, no DNS record** |

> Railway public domains: for `api` use the **custom domain** `api.smarttechsaas.com`
> attached to the Railway service, DNS point at Railway (below). Never give Part B a
> public Railway domain.

---

## 1. Railway — `smarttech-prod` project

Two route services, same project, `production` environment. Postgres = Supabase only.

### 1A. Main backend service `smart-tech-saas` (root `backend`)

Set these in **Railway → smarttech-prod → smart-tech-saas → Variables**:

| Variable | Value (example) | Notes |
|---|---|---|
| `PORT` | *(already set — leave it)* | Railway injects `PORT`; if a manual `PORT` (e.g. `4000`) already exists on this service, **do not add another one** — only one `PORT` var allowed per service. The app reads `process.env.PORT`. |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | *(already set — reuse)* | **Supabase POOLED** (port **6543**). Already configured on this service — do not duplicate. |
| `DIRECT_URL` | *(already set — reuse)* | **Supabase DIRECT** (port **5432**). Already configured on this service — do not duplicate. |
| `JWT_SECRET` | *(keep your existing)* | |
| `REDIS_URL` | `redis://default:<pwd>@...` | reference the existing `smarttech-redis` (import its `REDIS_PASSWORD` via a reference variable, or paste the URL) |
| `CLOUDINARY_CLOUD_NAME` | … | keep existing |
| `CLOUDINARY_API_KEY` | … | keep existing |
| `CLOUDINARY_API_SECRET` | … | keep existing |
| `STAMP_DEFAULT_TIMEZONE` | `Africa/Lusaka` | |
| `VERIFICATION_URL` | `https://app.smarttechsaas.com` | base for `/v/:code` QR links |
| `SIGNATURE_SERVICE_URL` | `http://<part-b>.up.railway.internal` | **copy the actual private hostname from 1B step 4** |
| `SIGNATURE_SERVICE_KEY` | `stamp-engine:<shared-secret>` | **MUST equal** Part B `INTERNAL_SERVICE_KEYS` |
| `SIGNATURE_SERVICE_TIMEOUT_MS` | `15000` | optional |

After saving → **Deploy/Redeploy** the `smart-tech-saas` service so it boots with the
bridge enabled.

### 1B. NEW signature backend service (root `digital-signature/backend`)

**Create service:** Railway → smarttech-prod → **New → Service** → “Deploy from GitHub
repo” → `ziwamore1/smart-tech-saas` → root directory **`digital-signature/backend`**.
The `railway.toml` in that folder already sets the Dockerfile builder, `/health` check,
and the migrate+boot start command.

**Variables** on the new service:

| Variable | Value (example) | Notes |
|---|---|---|
| `DATABASE_URL` | `<same Supabase POOLED URL>?schema=signatures` | **new service → add fresh.** Same Supabase DB as Part A, own `signatures` schema. Do not set on both services — this is a different service so a new var is fine. |
| `DIRECT_URL` | `<same Supabase DIRECT URL>?schema=signatures` | new service → add fresh. Port 5432 direct URL + same `?schema=`. |
| `JWT_SECRET` | `openssl rand -base64 48` (unique, **not** the same as Part A) | |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — **64 hex** | AES-256-GCM master key for signing keys at rest. **Back it up NOW** (losing it breaks every signing key). |
| `INTERNAL_SERVICE_KEYS` | `stamp-engine:<shared-secret>` | must equal Part A `SIGNATURE_SERVICE_KEY` |
| `NODE_ENV` | `production` | |
| `CORS_ORIGIN` | `https://signature.smarttechsaas.com` | only if deploying the operator UI; else omit |
| `PORT` | *(skip — do NOT set)* | Railway injects `PORT` automatically; the app binds to it. No need to create a `PORT` var here. |

**Private networking (required):** Railway → new service → **Settings → Networking →
Private Networking → enable private domain**. Copy the generated private hostname, e.g.
`http://signature-production.up.railway.internal` (format varies) — paste it as
`SIGNATURE_SERVICE_URL` in 1A.

**Verify:** `GET http://<private-hostname>/health` → `{"status":"ok",...}` (visible only
from inside Railway).

> ⚠️ **Do NOT** add a public domain to this service, and **do NOT** change `schema.prisma`
> provider. Migrations run automatically on deploy (the railway.toml `startCommand`
> calls `prisma migrate deploy` against Supabase).

---

## 2. Vercel applications

Each app = one **Vercel Project** connected to GitHub, root directory as listed.
Set each var in Vercel → Project → **Settings → Environment Variables → Production**
(and enable for Preview if needed).

### 2A. Main web app (root `frontend/apps/app-portal`) → `app.smarttechsaas.com`
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.smarttechsaas.com/api/v1` |

*(Use the `/api/v1` suffix — matches the local `.env.local` convention used by most
pages that do not append it themselves.)*

### 2B. Landing (root `frontend/apps/landing`) → `smarttechsaas.com` / `www`
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.smarttechsaas.com` |
| `NEXT_PUBLIC_API_URL` | `https://api.smarttechsaas.com/api/v1` |

### 2C. Verify site (root `verify-site`) → `verify.smarttechsaas.com`
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.smarttechsaas.com/api/v1` |

### 2D. Part B operator UI (root `digital-signature/frontend`) → `signature.smarttechsaas.com` — OPTIONAL
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DSIG_API_URL` | the Part B API public base (see security note below) |

> ### ⚠️ Part B UI — read before deploying
> The operator UI runs in the browser, so its API base must be publicly reachable. But
> exposing the Part B backend publicly would also expose `/internal/*`, which **must stay
> private**. Two safe ways:
> 1. **Recommended (no standalone UI):** skip 2D entirely. Signing already flows through
>    the main platform (Part A) over the private network. Cheapest + safest.
> 2. If you truly want the operator UI: expose Part B behind a **Cloudflare Worker/rule
>    that blocks `/internal/*`** at the edge, and set
>    `NEXT_PUBLIC_DSIG_API_URL=https://signature-api.smarttechsaas.com` (+ a matching
>    `CORS_ORIGIN`). This costs extra complexity, so only do it if you need the standalone
>    login/sign/verify screens.

---

## 3. Cloudflare DNS records (`smarttechsaas.com` zone)

Create these in **Cloudflare → DNS → Records**. Keep each target consistent with its host.

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | 🔶 Proxied |
| A | `@` (root) | `76.76.21.21` *(Vercel anycast)* | 🔶 Proxied |
| CNAME | `app` | `cname.vercel-dns.com` | 🔶 Proxied |
| CNAME | `verify` | `cname.vercel-dns.com` | 🔶 Proxied |
| CNAME | `signature` | `cname.vercel-dns.com` | 🔶 Proxied (only if deploying 2D) |
| CNAME | `api` | `<your-service>.up.railway.app` (the main backend's Railway public domain) | ⚪ **DNS only (grey cloud)** |

Notes:
- **Vercel roots:** Cloudflare does not support native CNAME at the apex without
  `cname-flattening` (Cloudflare flattens apex CNAME automatically), so `@ → A
  76.76.21.21` is the standard apex target; the same applies to Railway if you ever apex.
- **`api` must be DNS-only (grey cloud):** Railway issues its own TLS certificate for
  `api.smarttechsaas.com`. Proxying through Cloudflare's orange cloud would force you to
  set SSL to **Full (strict)** and can break Railway's cert handshake. Keep it grey and
  let Railway's edge terminate TLS. In Vercel, **Settings → Domains → add each hostname**;
  Vercel shows the exact CNAME target to use (it may differ from the generic
  `cname.vercel-dns.com`). Use Vercel's reported target for maximum accuracy.
- **Part B API needs NO public record** — it lives only on the Railway private network.

---

## 4. Verify the whole chain

1. `curl https://api.smarttechsaas.com/api/v1/public/verification/<code>` → JSON (Part A public).
2. From Part A, run the signature smoke suite (`npx tsx scripts/stamp-engine-smoke.ts`).
   Confirm a block is produced with `signatureStatus !== "SKIPPED"` (i.e. the bridge reached
   Part B and got a real Ed25519 signature).
3. `verify.smarttechsaas.com/v/<code>` renders the verify page and reports
   **Stamp ✓ + Signature ✓**.
4. Open `app.smarttechsaas.com` → login → issue a document with a stamp → finalize → QR
   link opens the verify page showing the cryptographic signature.

---

## 5. Secrets you must back up (offline)

`ENCRYPTION_KEY` (Part B) — losing it permanently breaks all signing keys.
`JWT_SECRET` (both services), `INTERNAL_SERVICE_KEYS`/`SIGNATURE_SERVICE_KEY` — rotation
breaks billing/auth → document in the vault.
