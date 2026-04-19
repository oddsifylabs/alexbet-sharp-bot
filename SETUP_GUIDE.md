# 🚀 Complete Setup Guide - Telegram Stars Payment System

## Step 1: Supabase Table Setup

Your Supabase database needs two tables: `users` and `payments`.

### Option A: Automatic Setup (Recommended if available)

Run this command:
```bash
node create-tables-manual.js
```

Then follow the displayed instructions.

### Option B: Manual Setup via Supabase Dashboard

1. **Log in to Supabase**: https://supabase.io/dashboard
2. **Select your project**: "alexbet-sharp-bot"
3. **Go to SQL Editor** (left sidebar)
4. **Create new query** (blue button)
5. **Copy and paste the entire SQL** below:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_payment_date TIMESTAMP,
  payment_method TEXT,
  CHECK (subscription_tier IN ('free', 'monthly', 'yearly', 'lifetime'))
);

CREATE INDEX IF NOT EXISTS users_subscription_expiry 
  ON users(subscription_expiry) 
  WHERE subscription_tier != 'lifetime' AND subscription_tier != 'free';

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  amount_stars INT,
  tier TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  telegram_charge_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (tier IN ('monthly', 'yearly', 'lifetime')),
  CHECK (status IN ('pending', 'completed', 'failed')),
  CHECK (payment_method IN ('telegram_stars', 'whop'))
);

CREATE INDEX IF NOT EXISTS payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status ON payments(status);
```

6. **Click the blue Run button**
7. **You should see**: "Success - All statements have been executed"
8. **Verify**: Go to Table Editor → you should see `users` and `payments` tables

---

## Step 2: Verify Supabase Setup

Run this command to verify tables were created:

```bash
node verify-supabase.js
```

Expected output:
```
✅ Users table EXISTS
✅ Payments table EXISTS
✅ ALL TABLES READY - Bot can start!
```

---

## Step 3: Test Bot Locally

Now that everything is set up, test the bot:

```bash
# Start the bot
node telegram-bot.js
```

You should see:
```
✅ Supabase initialized
✅ Bot running with Telegram Stars payments integrated...
🤖 AlexBET Sharp Bot starting (h2h + spreads + totals)...
```

### Test Commands in Telegram

Open Telegram and message your bot:

1. **Start**: `/start`
   - Should ask for bankroll
   - Reply with a number (e.g., `1000`)

2. **Check Subscription**: `/status`
   - Should show "🆓 Free Tier"

3. **View Pricing**: `/subscribe`
   - Should show 3 buttons:
     - 💎 Monthly ($9.99)
     - 🚀 Yearly ($99.99)
     - 👑 Lifetime ($999)

4. **Scan for Gems**: `/scan`
   - Should fetch live odds and show top picks

5. **Export Results**: `/export`
   - Then choose: `/export_csv`, `/export_txt`, or `/export_json`
   - Free tier should limit to 3 gems

---

## Step 4: Deploy to Railway

Once local testing works:

```bash
# Commit changes
git add .
git commit -m "🚀 Supabase setup complete"
git push origin main
```

Railway will auto-deploy (if auto-deploy enabled). Monitor logs:

```bash
railway logs
```

---

## 📋 Testing Checklist

- [ ] Supabase tables created (`users` and `payments`)
- [ ] `verify-supabase.js` shows all tables ready
- [ ] Bot starts without errors (`node telegram-bot.js`)
- [ ] `/start` command works
- [ ] `/status` shows free tier
- [ ] `/subscribe` shows 3 pricing buttons
- [ ] `/scan` returns gems (or "no games scheduled")
- [ ] `/export_csv` respects 3-gem limit for free users
- [ ] Bot stops cleanly (Ctrl+C)

---

## 🐛 Troubleshooting

### "Users table NOT FOUND"

**Solution**: Run the SQL manually in Supabase SQL Editor:
1. Supabase Dashboard → SQL Editor
2. Create new query
3. Paste the CREATE TABLE statements from Step 1
4. Click Run

### "Cannot connect to Supabase"

**Check**:
- `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- URLs are exactly right (copy from Supabase Dashboard)
- Service role key is current (keys can expire)

### Bot starts but crashes on /subscribe

**Check**:
- Supabase tables exist (run `verify-supabase.js`)
- Environment variables are set correctly
- Check bot logs for exact error

### Payment not processing

**Check**:
- Your Telegram account is set up for Stars payments
- Bot token has payments permission enabled
- Supabase `payments` table exists and is accessible

---

## 📞 Quick Help

| Issue | Command |
|-------|---------|
| Verify setup | `node verify-supabase.js` |
| Create tables | Copy SQL from Step 1 to Supabase |
| Start bot | `node telegram-bot.js` |
| Check logs | `railway logs` (prod) or console (local) |
| Commit changes | `git push origin main` |

---

## 🎯 Next Steps

1. ✅ Complete Step 1 (Create Supabase tables)
2. ✅ Complete Step 2 (Verify tables exist)
3. ✅ Complete Step 3 (Test bot locally)
4. 🚀 Complete Step 4 (Deploy to Railway)

Once deployed, the bot is **live and ready for payments**!

---

## Files in This Release

| File | Purpose |
|------|---------|
| `telegram-bot.js` | Main bot with Telegram Stars integration |
| `src/services/supabase-client.js` | Database operations |
| `src/services/telegram-stars-payment.js` | Payment handler |
| `docs/SUPABASE_SCHEMA.sql` | Table definitions (manual setup) |
| `verify-supabase.js` | Verification script |
| `create-tables-manual.js` | Setup guide |
| `INTEGRATION_COMPLETE.md` | Integration documentation |

---

**Status**: 🟢 Ready for deployment
