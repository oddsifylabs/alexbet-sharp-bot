# CRITICAL: Update ODDS_API_KEY in Railway Dashboard

## The Problem
- I updated `.env` locally with the correct API key
- BUT `.env` is in `.gitignore` - it's NOT pushed to GitHub
- Railway pulls from GitHub, so it doesn't see the new API key
- Bot still has the OLD invalid API key

## The Solution
Set the ODDS_API_KEY directly in Railway environment variables:

### Step 1: Go to Railway Dashboard
1. https://railway.app/dashboard
2. Select "AlexBET Sharp Bot" project
3. Click "Variables" tab

### Step 2: Update ODDS_API_KEY
**Current (WRONG):**
```
ODDS_API_KEY=90679e...1812  ❌ Invalid key
```

**Change to (CORRECT):**
```
ODDS_API_KEY=6f46bbb3b2fb69b5e14980a57e9909da  ✅ Valid key
```

### Step 3: Save & Redeploy
1. Click "Save" button
2. Railway will automatically redeploy the bot
3. Wait 2-3 minutes for it to restart

### Step 4: Test
- Send `/help` → Should show `https://alexbet-lite.netlify.app`
- Send `/scan` → Should return actual gems
- Send `/start` → Should show your current bankroll

## Why This Happened
- Node.js apps use `.env` for secrets
- `.env` is in `.gitignore` for security (never commit secrets to GitHub)
- Railway needs secrets set in dashboard "Variables" tab, not in git
- This is standard practice - secrets are set per environment, not in code

## Complete Environment Variables for Railway

Make sure Railway has these set:

```
TELEGRAM_BOT_TOKEN=867184...hWj0
ODDS_API_KEY=6f46bbb3b2fb69b5e14980a57e9909da
ANTHROPIC_API_KEY=[your-key]
VITE_SUPABASE_URL=https://nzhkfmepfcamrfioqwcr.supabase.co
SUPABASE_URL=https://nzhkfmepfcamrfioqwcr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-key]
WHOP_API_KEY=apik_G...fde5
WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
```

## Code Changes ARE Deployed ✅

The actual code changes (tracker URL, minimum bankroll, etc.) ARE in GitHub and deployed:
- ✅ Commit 988ab65 deployed
- ✅ Tracker URL fixed (alexbetlite → alexbet-lite)
- ✅ Minimum bankroll $1
- ✅ Admin logging added

Only the ODDS_API_KEY environment variable needs to be updated in Railway dashboard.

