# 🚀 CREATE SUPABASE TABLES NOW

You have Supabase keys! Here's how to create the tables in 2 minutes:

## Step 1: Go to Supabase Dashboard
→ https://supabase.io/dashboard

## Step 2: Select Your Project
→ Click: **alexbet-sharp-bot**

## Step 3: Open SQL Editor
Left sidebar → **SQL Editor** (or click **SQL** button)

## Step 4: Create New Query
→ Click: **New Query** button

## Step 5: Copy the SQL Below

Copy everything from the section below and paste into Supabase:

---

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

CREATE INDEX IF NOT EXISTS payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status ON payments(status);
```

---

## Step 6: Run the Query
→ Click: **Run** button (or Ctrl+Enter)

## Step 7: Verify
You should see:
- ✅ No errors
- ✅ Two tables appear in Table Editor (left sidebar)

---

## After Tables Are Created (2 minutes)

Run this to verify:
```bash
node verify-supabase.js
```

Should show: ✅ All tables ready

---

## Then You're Ready to Deploy! 🚀

Follow: DEPLOYMENT_READY.md

---

**That's it! Tables will be created in Supabase and bot will be ready to go live!**
