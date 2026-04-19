# Supabase Table Creation Instructions

**For**: Someone with Supabase admin access  
**Task**: Create two database tables for Telegram Stars payment system  
**Time**: 5 minutes  
**Difficulty**: Easy (just copy-paste SQL)

---

## Quick Start

1. Go to: https://supabase.io/dashboard
2. Select project: **alexbet-sharp-bot**
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy the SQL below
6. Paste into editor
7. Click: **Run**
8. Done! Tables are created

---

## SQL to Run

Copy everything below and paste into Supabase SQL Editor:

```sql
-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  subscription_expiry TIMESTAMP NULL,
  payment_method VARCHAR(50),
  last_payment_date TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_users_tier ON users(subscription_tier);
CREATE INDEX idx_users_expiry ON users(subscription_expiry);

-- =====================
-- PAYMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  amount_stars INTEGER NOT NULL,
  tier VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  telegram_charge_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- =====================
-- FUNCTION: Update updated_at timestamp
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- TRIGGERS: Auto-update updated_at
-- =====================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- ENABLE ROW LEVEL SECURITY
-- =====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- Users: Service role can do everything
DROP POLICY IF EXISTS "Service role access" ON users;
CREATE POLICY "Service role access" ON users
  USING (true)
  WITH CHECK (true);

-- Payments: Service role can do everything
DROP POLICY IF EXISTS "Service role access" ON payments;
CREATE POLICY "Service role access" ON payments
  USING (true)
  WITH CHECK (true);

-- =====================
-- VERIFY TABLES CREATED
-- =====================
-- If you see no errors above, tables are created!
-- Check by going to: Table Editor (left sidebar)
-- You should see: "users" and "payments" tables listed
```

---

## What This SQL Does

### `users` table
Stores user subscription information:
- `user_id` - Telegram user ID (primary key)
- `subscription_tier` - 'free', 'monthly', 'yearly', or 'lifetime'
- `subscription_expiry` - When subscription expires (null for lifetime)
- `payment_method` - How they paid (telegram_stars, crypto, etc.)
- `last_payment_date` - When they last paid
- `created_at` - Account creation date
- `updated_at` - Last update date

### `payments` table
Stores all payment transactions:
- `id` - Unique payment ID
- `user_id` - Which user made the payment
- `amount_stars` - How many Telegram Stars paid
- `tier` - What tier they bought (monthly/yearly/lifetime)
- `status` - Payment status (pending, completed, failed)
- `telegram_charge_id` - Telegram's charge reference
- `created_at` - Payment date
- `updated_at` - Last update

---

## Step-by-Step Instructions

### Step 1: Open Supabase Dashboard
```
https://supabase.io/dashboard
```

### Step 2: Select Project
- Look for: **alexbet-sharp-bot**
- Click it

### Step 3: Open SQL Editor
- Left sidebar → **SQL Editor**
- Or click: **SQL** button

### Step 4: Create New Query
- Click: **New Query** button
- Or click: **+** icon

### Step 5: Copy & Paste SQL
1. Copy the SQL code above (from ```sql to ```)
2. Paste into the white editor box
3. Should show ~100 lines of code

### Step 6: Execute
- Click: **Run** button (bottom right)
- Or press: `Ctrl+Enter` / `Cmd+Enter`

### Step 7: Verify Success
- Should see: **No errors**
- Look at: **Table Editor** (left sidebar)
- Should show: **users** and **payments** tables

---

## Verification

After running SQL, verify tables were created:

### Method 1: Table Editor
1. Left sidebar → **Table Editor**
2. Should see:
   - ✅ `public.users`
   - ✅ `public.payments`

### Method 2: Run Query
1. Create new query
2. Run this SQL:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```
3. Should show: users, payments

### Method 3: Run Verification Script
After tables exist, run:
```bash
cd /home/pil_coder1/projects/alexbet-sharp-bot
node verify-supabase.js
```

Should output: ✅ All tables ready

---

## Troubleshooting

### Error: "Table already exists"
**Solution**: This is OK! Tables were already created. Just move forward.

### Error: "Permission denied"
**Solution**: Make sure you're using a service role key with full permissions.

### Error: "Function not found"
**Solution**: The function create might fail if it already exists. This is OK, the policy will still work.

### Tables not showing in Table Editor
**Solution**: Refresh the page or click refresh icon in Table Editor.

---

## What Comes Next

Once tables are created:

1. **Verify Setup** (1 min)
   ```bash
   node verify-supabase.js
   ```

2. **Test Locally** (10 min)
   ```bash
   node telegram-bot.js
   ```

3. **Deploy to Railway** (5 min)
   - Check: https://railway.app/dashboard
   - Should auto-deploy

4. **Go Live!** (4 min)
   - Test bot commands
   - Check everything works

---

## Who to Contact

If tables can't be created:
- Check Supabase project is correct
- Check you have admin access
- Check SQL syntax (it's provided, should work)
- Ask Supabase support: https://supabase.com/support

---

## That's It!

After creating tables, the bot is ready to go live. Everything else is already done.

**Next command to run**:
```bash
node verify-supabase.js
```

This will confirm tables are ready!

---

**Time to complete**: 5 minutes ⏱️  
**Difficulty**: Easy (copy-paste) ✅  
**Status**: Everything else ready! 🚀
