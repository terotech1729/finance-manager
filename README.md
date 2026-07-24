# Credit Card Manager

A personal credit-card optimizer with multi-card recommendation engine, milestone tracking, and Cashkaro routing — built as a Next.js web app deployable for free on Vercel.

> Built for a 10-card portfolio (3 Amex + 5 Indian banks + 2 pending). The recommendation engine routes every spend to the best card AND best entry path (Direct / ShopWise / Cashkaro / Kiwi / District), accounting for milestone proximity, monthly milestones, caps, and card-specific bank coupons (BLCK Cleartrip stack, etc.).

## Features

- **Recommendation engine** — enter merchant + amount + channel; get optimal card + payment route + effective return %
- **Annual milestone tracker** — Amex Plat Travel ₹4L/₹7L, MRCC fee waivers, IDFC Indigo BluChip vouchers, BOB Eterna, SBI SimplyCLICK
- **Monthly milestone tracker** — Amex Gold 6×₹1K, Amex MRCC 4×₹1.5K + ₹20K total, Scapia ₹20K lounge trigger, BOB ₹40K/quarter
- **Reward-balance dashboard** — pooled MR + IndiGo BluChips + Scapia coins + SBI RP + BOB RP + Kiwi cashback
- **Transaction log** — local-first (browser localStorage), no backend dependency
- **Cashkaro routing layer** — always-try policy with merchant-specific zones (reliable / try-anyway / shopwise-edge / N/A)
- **Settings + backup** — export/import all data as JSON; reset with a click

## Tech stack (all free)

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS (custom dark theme)
- **State:** localStorage (zero backend)
- **Hosting:** Vercel free tier (100GB bandwidth, custom domain support)
- **Cron / Scraper:** GitHub Actions (weekly Cashkaro rate refresh) + optional Vercel Cron
- **Optional database:** none for v1; add Supabase later for cross-device sync if desired

---

## Deploy in 10 minutes (free)

### Prerequisites
1. **GitHub account** — sign up at https://github.com (free)
2. **Vercel account** — sign up at https://vercel.com using GitHub login (free)
3. **Node.js 20+** installed locally — https://nodejs.org

### Step-by-step

#### 1. Push this code to GitHub

From inside this `web/` folder:

```bash
cd web
git init
git add .
git commit -m "initial commit"
gh repo create credit-card-manager --private --source=. --push
# OR if you don't have GitHub CLI:
# create empty repo on github.com first, then:
git remote add origin git@github.com:YOUR_USERNAME/credit-card-manager.git
git branch -M main
git push -u origin main
```

#### 2. Test locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should see the dashboard.

#### 3. Deploy to Vercel

Option A — via Vercel dashboard:
1. Go to https://vercel.com/new
2. Click "Import" on your `credit-card-manager` repo
3. Leave all defaults (Next.js auto-detected)
4. Click "Deploy"
5. ~2 minutes later: live at `https://credit-card-manager-XXX.vercel.app`

Option B — via Vercel CLI:
```bash
npm i -g vercel
vercel
# follow prompts
```

#### 4. Custom domain (optional, you pay ~₹600–1,000/year)

1. Buy a domain at GoDaddy / Namecheap / Cloudflare Registrar
2. In Vercel dashboard → your project → Settings → Domains → Add
3. Add `yourdomain.com`
4. Vercel shows DNS records — add them at your registrar
5. SSL auto-provisions (free, via Let's Encrypt)

#### 5. Enable weekly Cashkaro scraper

The GitHub Action at `.github/workflows/scrape-cashkaro.yml` runs every Monday and commits updated rates to your repo. To enable:

1. Push your code to GitHub (you already did above)
2. Go to your repo → Settings → Actions → General → Workflow permissions → set to "Read and write permissions"
3. The workflow will run automatically every Monday at 03:00 UTC

If you prefer Vercel Cron instead (no commits, but ephemeral):
- The `vercel.json` already has the cron config
- Vercel Pro is required for cron (free tier excludes it as of 2026)
- Stick with GitHub Actions for free

---

## How to use the app

### First-time setup

1. Open the app → click **Settings**
2. Verify the pre-filled state matches your reality:
   - Reward balances (pooled Amex MR, IndiGo BluChips, Scapia coins, etc.)
   - Annual milestone progress (Amex Plat Travel cycle spend, MRCC, SBI, IDFC, BOB)
   - Card-issuance status (toggle Swiggy BLCK / Amazon Pay ICICI when they arrive)
   - Prime member toggle
3. Click "Export all data (JSON)" → save the JSON somewhere (Google Drive, etc.) as backup

### Daily workflow

1. Before any spend, go to **Transactions** page
2. Enter merchant name, category, amount, channel
3. The recommendation engine shows:
   - **Best card** to charge
   - **Path** (Direct / ShopWise / Cashkaro click-through / Kiwi / District / BLCK coupon)
   - **Effective return %** (worst case → best case)
   - **₹ reward** estimate
   - **Caveats** (caps, milestones, etc.)
4. Click **Log this transaction** → updates the milestone trackers automatically
5. Make the actual purchase per the recommendation
6. (Optional) Take a screenshot of the order confirmation if Cashkaro is involved

### Tracking milestones

- **Dashboard** shows top priorities + progress bars
- **Milestones** page shows all annual + monthly milestones across all cards
- Update spend amounts manually on **Settings** if you make a purchase outside the app (e.g., autopay'd utility bill)

### Backup / restore

- **Settings → Export** copies the JSON of all your data
- Save it somewhere safe (Google Drive, iCloud, GitHub gist)
- **Settings → Import** restores from JSON
- Useful when switching devices or clearing browser data

---

## Updating Cashkaro rates

The app ships with a snapshot of rates as of 2026-05-30. To refresh:

### Automatic (GitHub Actions, weekly)
Already configured. Pushes updated `src/data/cashkaro-rates.generated.json` every Monday.

### Manual (any time)
```bash
npm run scrape-cashkaro
```
Updates `src/data/cashkaro-rates.generated.json`. To use the updated rates in the runtime, regenerate `src/lib/cashkaro.ts` from the JSON (currently manual — see below).

### Live API endpoint
Visit `https://yourdomain.com/api/scrape-cashkaro` to get a quick scrape-on-demand of top merchants (returns JSON; doesn't update files).

---

## Adapting to your portfolio changes

### When a new card arrives (e.g., Swiggy BLCK)
1. Open **Settings**
2. Toggle "Swiggy BLCK issued (received)" → ON
3. Update statement date (Settings → Card status section can be extended)
4. The recommendation engine will now route Swiggy / Cleartrip / Nykaa to BLCK automatically

### When you close a card
Edit `src/lib/cards.ts` → set the card's `status` to `"future"` or remove it from the `CARDS` array. Push the change, Vercel auto-deploys.

### When milestones reset (annual cycle)
Edit `src/lib/storage.ts` → `DEFAULT_STATE` to update `ptccEligibleSpend`, `mrccCycleSpend`, etc. OR just update them in **Settings**.

### Adding a new card
Edit `src/lib/cards.ts` → add to the `CARDS` array. Add milestones to `ANNUAL_MILESTONES` / `MONTHLY_MILESTONES`. Update the recommendation engine in `src/lib/recommend.ts` if it has a unique earn category.

---

## File structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root layout + nav
│   │   ├── globals.css                 ← Tailwind base + custom styles
│   │   ├── page.tsx                    ← dashboard
│   │   ├── transactions/page.tsx       ← entry + recommendation
│   │   ├── cards/page.tsx              ← portfolio + Cashkaro routes
│   │   ├── milestones/page.tsx         ← annual + monthly milestones
│   │   ├── settings/page.tsx           ← state editor + backup
│   │   └── api/
│   │       └── scrape-cashkaro/        ← live scrape endpoint
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── Stat.tsx
│   │   ├── Callout.tsx
│   │   └── ProgressBar.tsx
│   ├── lib/
│   │   ├── types.ts                    ← TypeScript types
│   │   ├── cards.ts                    ← card data + milestones
│   │   ├── cashkaro.ts                 ← merchant rates
│   │   ├── recommend.ts                ← recommendation engine
│   │   ├── storage.ts                  ← localStorage abstractions
│   │   └── utils.ts                    ← formatters
│   └── data/
│       └── cashkaro-rates.generated.json   ← scraper output
├── scripts/
│   └── scrape-cashkaro.ts              ← weekly scraper
├── .github/workflows/
│   └── scrape-cashkaro.yml             ← cron job
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── vercel.json                         ← Vercel cron config (optional)
├── .gitignore
└── README.md (this file)
```

---

## Roadmap (when you're ready)

### Phase 2 — cross-device sync
Add **Supabase** (free Postgres, 500MB):
1. Create project at https://supabase.com
2. Add `@supabase/supabase-js` dependency
3. Create `transactions` and `state` tables
4. Replace `lib/storage.ts` with Supabase client
5. Add basic auth (email magic link) for personal use

### Phase 3 — auto card-issuance handlers
- When BLCK arrives: auto-update routing logic
- When Amazon Pay ICICI arrives: re-route Amazon
- Email/Telegram notification on milestone proximity

### Phase 4 — analytics
- YTD spend trends chart by card
- Reward earnings cumulative chart
- Predicted milestone arrival dates based on current pace

### Phase 5 — improved Cashkaro scraper
- Use Puppeteer for JS-rendered pages (more reliable)
- Track historical rates over time
- Alert when a merchant's Cashkaro rate jumps

---

## Troubleshooting

### "Module not found" on `npm run dev`
Run `npm install` in the `web/` folder first.

### Tailwind classes not working
Make sure `globals.css` is imported in `app/layout.tsx`. Restart dev server.

### Vercel deployment fails
- Check the build log on Vercel dashboard
- Common: TypeScript error → fix locally first with `npm run build`

### GitHub Actions scraper fails
- Cashkaro may have anti-bot rate-limiting → the scraper is polite (1.5s delay)
- If rates can't be parsed, the JSON falls back to empty → app continues working with the static `cashkaro.ts` snapshot
- Check Actions tab on GitHub for logs

### "Cannot read properties of undefined" in browser
- Likely a localStorage state shape mismatch (e.g., upgraded code, old saved state)
- Solution: Settings → "Clear all data" → reset to defaults

---

## License

Personal use only. Do not redistribute.
