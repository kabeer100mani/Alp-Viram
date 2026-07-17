# Deploying Alp-Viram (Vercel) + Installing it as an App

Plain-language, step-by-step. **You do the account/click steps yourself** (Vercel signup, connecting things); I've done all the code prep. Backend stays on Supabase exactly as-is — this only puts the **frontend** on the internet and makes it installable as an app.

**Roughly 20–30 minutes, one time.** After this, every future update deploys automatically.

---

## What "deploying" means here

Right now the app only runs on your computer (`localhost`). Vercel is a free host that takes the app's code from GitHub, builds it, and serves it at a real web address like `https://alp-viram.vercel.app` — reachable from any phone or computer. Supabase (your database, login, AI) doesn't move; the hosted app just talks to it over the internet, the same as it does locally.

---

## Step 0 — Get the code onto GitHub (needs my help first)

Vercel builds from GitHub. Your repo (`kabeer100mani/Alp-Viram`) exists, **but the latest ~37 commits — everything from M3 through the PWA work — are only on my machine, not pushed yet.**

⚠️ **Before you start the Vercel steps, tell me:**
1. **Should I push the `Development` branch to GitHub?** (I don't push without your say-so.)
2. **Which branch should Vercel deploy as "production"?** You have `Development`, `Test`, `Production`. Vercel defaults to a branch called `main`, which you don't have — so we'll point it at one of yours. I'd suggest **`Production`** for the live app (and I can merge `Development → Production` when you're ready), or **`Development`** if you want the live site to track your working branch for now.

Once you answer, I'll push (and merge if you want), and the code will be on GitHub ready for Vercel. **Everything below waits on that.**

---

## Step 1 — Create a Vercel account

1. Go to **https://vercel.com**.
2. Click **Sign Up**.
3. Choose **Continue with GitHub** (this is important — it lets Vercel see your repo). Sign in to GitHub if asked and click **Authorize Vercel**.
4. When asked about a plan, pick **Hobby** (free). It's plenty for this.

---

## Step 2 — Import the project

1. On the Vercel dashboard, click **Add New… → Project**.
2. You'll see a list of your GitHub repositories. Find **Alp-Viram** and click **Import**.
   - If it's not listed, click **Adjust GitHub App Permissions** (or "Configure GitHub App") and give Vercel access to the `Alp-Viram` repo, then come back.

---

## Step 3 — Check the build settings (usually auto-filled)

Vercel should recognise this as a **Vite** app and fill these in. **Verify they read:**

| Setting | Value |
| --- | --- |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

If any is blank or different, set it to the value above.

**Don't click Deploy yet** — do Step 4 first (the app needs its two settings, or it'll load to a blank/error screen).

---

## Step 4 — Add the two environment variables

The app needs to know where your Supabase project is. These two values are **safe to expose** (they're the public browser keys — the same ones already shipped in the app), so there's nothing secret here.

**Get the values from Supabase:**
1. Open **https://supabase.com/dashboard** → your project.
2. Left sidebar → **Project Settings** (gear icon) → **API**.
3. Copy two things:
   - **Project URL** (looks like `https://jdngjwspqxhpkmqhcekc.supabase.co`)
   - **`anon` `public` key** (a long string under "Project API keys")

**Add them in Vercel**, on the import screen under **Environment Variables**, add these two (name on the left, pasted value on the right):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | *(the Project URL you copied)* |
| `VITE_SUPABASE_ANON_KEY` | *(the anon public key you copied)* |

Type the names **exactly** as shown (they're case-sensitive and start with `VITE_`).

---

## Step 5 — Deploy

1. Click **Deploy**.
2. Wait 1–2 minutes while it builds. When it's done you'll see a success screen with a preview and a URL like **`https://alp-viram-xxxx.vercel.app`**.
3. Click the URL to open your live app. **Note this address — you'll need it in the next step.**

*(If the app opens but you can't log in, it's almost always Step 6.)*

---

## Step 6 — Tell Supabase about the new web address (important)

Password-reset emails (and any auth links) will only send people to web addresses Supabase has been told to trust. Right now Supabase only knows about `localhost`, so you must add your new Vercel address.

1. In **Supabase Dashboard → Authentication → URL Configuration**.
2. **Site URL**: set it to your Vercel address, e.g. `https://alp-viram-xxxx.vercel.app`.
3. **Redirect URLs**: click add, and enter `https://alp-viram-xxxx.vercel.app/**` (the `/**` on the end matters — it allows the reset-password page).
4. **Save**.

*(Invites already work by shareable link, so nothing extra is needed there.)*

---

## Step 7 — Install it as an app 📱💻

Open your Vercel address (`https://…vercel.app`) **on your phone**:

- **iPhone (Safari):** tap the **Share** button → scroll down → **Add to Home Screen** → **Add**. The Alp-Viram icon appears on your home screen; opening it runs full-screen with no browser bar.
- **Android (Chrome):** you'll see an **Install app** prompt at the bottom, or tap the **⋮** menu → **Install app** / **Add to Home screen**.
- **Desktop (Chrome/Edge):** an **install icon** appears at the right end of the address bar → click it → **Install**. It opens in its own window, like a normal app.

That's it — installed, no browser bar, launches from the home screen or dock.

---

## Later: updating the live app

You don't repeat any of this. Once connected, **every time new code reaches the branch Vercel is watching, it rebuilds and redeploys automatically** (about a minute). I handle getting code there; you'll just see the live app update. If someone already installed the app, it updates itself on next open (the app is set up to always fetch the latest when online).

---

## If something looks wrong

- **Blank screen / "supabase not configured":** re-check Step 4 — the two variable names must be exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. After fixing, Vercel → the project → **Deployments** → **Redeploy**.
- **Can log in but password reset link fails / "redirect not allowed":** Step 6 — the Vercel URL isn't in Supabase's Redirect URLs yet.
- **No "Install" option on the phone:** make sure you opened the real `https://…vercel.app` address (not localhost), and give it a few seconds on first load. On iPhone it's always the manual **Share → Add to Home Screen** (Safari never shows an automatic prompt).
- **A page 404s when you refresh it (e.g. after opening a reset link):** this shouldn't happen — the app ships a `vercel.json` that handles it — but if it does, tell me.
