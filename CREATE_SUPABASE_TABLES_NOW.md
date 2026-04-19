# ✅ CREATE SUPABASE TABLES - 2 MINUTE SETUP

## Step 1: Open Supabase Dashboard
Go to: **https://app.supabase.com/project/nzhkfmepfcamrfioqwcr/sql/new**

## Step 2: Copy & Paste This SQL

```sql
-- =====================
-- USERS TABLE
-- =====================
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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS users_subscription_expiry 
  ON users(subscription_expiry) 
  WHERE subscription_tier != 'lifetime' AND subscription_tier != 'free';

-- =====================
-- PAYMENTS TABLE
-- =====================
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status ON payments(status);
```

## Step 3: Click **RUN** Button

You should see:
```
✅ Query executed successfully
```

## Step 4: Verify Tables Were Created

Run this command in your terminal:
```bash
cd /home/pil_coder1/projects/alexbet-sharp-bot
node verify-supabase.js
```

You should see:
```
✅ users table found
✅ payments table found
```

## Done! 🎉

Tables are now live in your Supabase. Next step: **Test locally** → **Deploy to Railway**

---

### Quick Links
- Supabase Dashboard: https://app.supabase.com/
- SQL Editor: https://app.supabase.com/project/nzhkfmepfcamrfioqwcr/sql
- Your Project: nzhkfmepfcamrfioqwcr
