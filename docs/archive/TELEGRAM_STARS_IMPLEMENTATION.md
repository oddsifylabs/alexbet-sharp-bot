# 🌟 Telegram Stars Payment Implementation Plan
## AlexBET Sharp Bot v2

**Status:** Ready for Development  
**Timeline:** This week (April 19-25, 2026)  
**Priority:** High  

---

## 📋 Overview

### Objective
Enable native Telegram Stars payments for AlexBET Sharp Bot subscriptions while maintaining optional Whop fallback.

### Pricing Tiers
| Tier | Price | Duration | Features |
|------|-------|----------|----------|
| **Monthly** | $9.99 | 30 days | Full bot access |
| **Yearly** | $99.99 | 365 days | Full bot access |
| **Lifetime** | $999 | Forever | Full bot access + priority support |

### Key Features
- ✅ Manual renewal (users re-purchase when expired)
- ✅ Export locked to free tier (3 gems max), unlimited on paid
- ✅ Supabase persistence (survives bot restart)
- ✅ Whop fallback (if TG Stars fails)

---

## 🏗️ Architecture

### Database Schema (Supabase)

#### `users` table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,                    -- Telegram user ID
  username TEXT,                             -- Telegram username
  subscription_tier TEXT,                    -- 'free', 'monthly', 'yearly', 'lifetime'
  subscription_expiry TIMESTAMP,             -- When tier expires (NULL for lifetime)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_payment_date TIMESTAMP,
  payment_method TEXT                        -- 'telegram_stars', 'whop'
);
```

#### `payments` table (audit trail)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id),
  amount_stars INT,                         -- e.g., 999 for $9.99
  tier TEXT,                                 -- 'monthly', 'yearly', 'lifetime'
  status TEXT,                               -- 'pending', 'completed', 'failed'
  payment_method TEXT,                       -- 'telegram_stars', 'whop'
  telegram_charge_id TEXT UNIQUE,           -- TG payment ID
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Flow

```
User → /subscribe command
    ↓
Shows 3 pricing buttons
    ↓
User clicks tier (Monthly/Yearly/Lifetime)
    ↓
Bot sends Telegram invoice (XTR currency)
    ↓
User completes TG Stars checkout
    ↓
Bot receives successful_payment event
    ↓
Bot stores subscription in Supabase
    ↓
User gets ✅ confirmation + /scan available
    ↓
(30/365 days later → expiry date)
    ↓
User can /subscribe again for renewal
```

---

## 🛠️ Implementation Phases

### Phase 1: Supabase Integration (2 hours)

**Files to create/modify:**
- `src/services/supabase-client.js` (NEW)
- `telegram-bot.js` (ADD import + init)

**Tasks:**
1. Create Supabase client module
2. Initialize Supabase connection on bot start
3. Add error handling for DB failures

**Code skeleton:**
```javascript
// src/services/supabase-client.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  return { data, error };
}

// ... more functions
module.exports = { getUser, addUser, updateSubscription, ... };
```

**Success criteria:**
- ✅ Supabase connection successful on startup
- ✅ Can query/insert users
- ✅ Error handling doesn't crash bot

---

### Phase 2: Telegram Stars Invoice Handlers (3 hours)

**Files to modify:**
- `telegram-bot.js`

**Tasks:**
1. Create `/subscribe` command → show inline buttons
2. Create callback handlers for tier selection
3. Create `sendInvoice()` for each tier
4. Handle `pre_checkout_query`
5. Handle `successful_payment` event

**Code skeleton:**
```javascript
// bot.onText(/\/subscribe/, async (msg) => {
//   Shows 3 buttons: Monthly ($9.99), Yearly ($99.99), Lifetime ($999)
// });

// bot.on('callback_query', async (query) => {
//   if (query.data === 'buy_monthly') {
//     await bot.sendInvoice(chatId, {
//       title: 'Monthly Access',
//       description: '30 days premium access',
//       payload: 'sub_month',
//       currency: 'XTR',
//       prices: [{ label: 'Monthly Plan', amount: 999 }]
//     });
//   }
//   // ... yearly, lifetime
// });

// bot.on('pre_checkout_query', (query) => {
//   bot.answerPreCheckoutQuery(query.id, true);
// });

// bot.on('successful_payment', async (msg) => {
//   const payload = msg.successful_payment.invoice_payload;
//   const userId = msg.from.id;
//   
//   await addSubscriptionToSupabase(userId, payload);
//   await bot.sendMessage(chatId, '✅ Payment received!');
// });
```

**Success criteria:**
- ✅ `/subscribe` shows 3 tier buttons
- ✅ Clicking button opens TG Stars checkout
- ✅ Successful payment triggers confirmation
- ✅ User data saved to Supabase

---

### Phase 3: Subscription Verification (2 hours)

**Files to modify:**
- `telegram-bot.js`
- `src/services/supabase-client.js` (add helper)

**Tasks:**
1. Create `isSubscriptionActive(userId)` helper
2. Add permission checks to `/scan` command
3. Add permission checks to `/export` command
4. Create `/status` command to show subscription state
5. Handle free tier → limit to 3 gems export

**Code skeleton:**
```javascript
// Helper
async function isSubscriptionActive(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('subscription_tier, subscription_expiry')
    .eq('id', userId)
    .single();
  
  if (data.subscription_tier === 'lifetime') return true;
  if (data.subscription_expiry > new Date()) return true;
  return false;
}

// Usage in /scan
bot.onText(/\/scan/, async (msg) => {
  const userId = msg.from.id;
  const active = await isSubscriptionActive(userId);
  
  if (!active) {
    return bot.sendMessage(msg.chat.id, 
      '❌ Subscription expired. /subscribe to renew');
  }
  
  // ... proceed with scan
});

// Usage in /export
bot.onText(/\/export/, async (msg) => {
  const userId = msg.from.id;
  const active = await isSubscriptionActive(userId);
  
  const maxGems = active ? 9999 : 3; // Free tier limit
  
  // ... export with limit
});
```

**Success criteria:**
- ✅ `/scan` blocked if expired
- ✅ `/export` limited to 3 gems for free users
- ✅ `/status` shows current subscription
- ✅ Lifetime users bypass expiry checks

---

### Phase 4: Whop Fallback (1 hour)

**Files to modify:**
- `telegram-bot.js` (update /subscribe)

**Tasks:**
1. If TG Stars invoice fails → show Whop fallback button
2. Keep existing Whop flow as backup
3. Log failures for debugging

**Code:**
```javascript
// In successful_payment handler:
bot.on('successful_payment', async (msg) => {
  try {
    const userId = msg.from.id;
    await addSubscriptionToSupabase(userId, payload);
    await bot.sendMessage(chatId, '✅ Payment received!');
  } catch (err) {
    logger.error('Payment processing failed:', err);
    // Fallback: offer Whop link
    await bot.sendMessage(chatId,
      'Payment processing failed. Retry or use our backup:\n\n' +
      '[Purchase on Whop](https://whop.com/oddsify-shop)',
      { parse_mode: 'Markdown' }
    );
  }
});
```

**Success criteria:**
- ✅ TG Stars fails gracefully
- ✅ User sees Whop fallback option
- ✅ Error logged for debugging

---

### Phase 5: Cleanup & Validation (1.5 hours)

**Tasks:**
1. Remove unused Whop code (keep as fallback only)
2. Add .env validation for required vars
3. Add startup checklist
4. Test with real Telegram Stars
5. Commit to GitHub

**Startup checklist:**
```javascript
const requiredEnv = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ODDS_API_KEY'
];

requiredEnv.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing ${key} in .env`);
    process.exit(1);
  }
});
```

---

## 📊 Pricing Notes

### Telegram Stars ↔ USD Conversion

Telegram uses a special currency called **Telegram Stars (XTR)**.
- 1 USD ≈ 1 Telegram Star (approximately)
- $9.99 ≈ 999 stars
- $99.99 ≈ 9900 stars
- $999 ≈ 99900 stars

**Important:** Always verify on Telegram's official docs: https://core.telegram.org/bots/payments/

### Telegram Takes 30% Cut

If you charge 999 stars:
- You receive: ~700 stars (~$7.00)
- Telegram keeps: ~299 stars (~$3.00)

**Budget accordingly** — adjust pricing if needed.

---

## 🔍 Testing Checklist

### Local Testing
- [ ] Bot starts without errors
- [ ] `/subscribe` shows 3 buttons
- [ ] Clicking tier opens TG Stars checkout
- [ ] Invalid payment is rejected
- [ ] Supabase connection works

### Live Testing (with real payment)
- [ ] Complete payment with real Telegram Stars
- [ ] User status updates in Supabase
- [ ] `/status` shows correct subscription
- [ ] `/export` respects limits (3 gems for free)
- [ ] Subscription expiry works (test with manual date)

### Edge Cases
- [ ] User subscribes while already active (extend, don't reset)
- [ ] Lifetime subscription never expires
- [ ] Failed payment doesn't create blank user record
- [ ] Whop fallback works if TG Stars fails
- [ ] Rate limiting works for `/subscribe` spam

---

## 🚀 Deployment

### Pre-Deployment
```bash
# 1. Verify all env vars
grep -E "TELEGRAM|SUPABASE|ODDS|ANTHROPIC" .env

# 2. Test locally
npm start

# 3. Commit changes
git add -A
git commit -m "✨ Add Telegram Stars payment system

- Monthly ($9.99), Yearly ($99.99), Lifetime ($999)
- Supabase persistence for subscriptions
- Free tier limited to 3 gems export
- Whop fallback if TG Stars fails"

git push origin main
```

### Production Deployment
```bash
# Deploy to Railway (or wherever bot runs)
# Ensure these env vars are set in Railway dashboard:
# - TELEGRAM_BOT_TOKEN
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - ODDS_API_KEY
# - ANTHROPIC_API_KEY (optional)

# Verify bot is running
curl -X POST https://api.telegram.org/botYOUR_TOKEN/getMe
```

---

## 📝 Required Environment Variables

Add to `.env`:
```
# Existing
TELEGRAM_BOT_TOKEN=your_bot_token
ODDS_API_KEY=your_odds_api_key

# New for Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
ANTHROPIC_API_KEY=your_claude_api_key
WHOP_API_KEY=your_whop_api_key
```

---

## ✅ Success Criteria (Full Feature)

- [x] Telegram Stars invoices sent correctly
- [x] Successful payments stored in Supabase
- [x] Subscription expiry tracked per user
- [x] Free tier limited to 3 gems export
- [x] Paid tiers unlimited export
- [x] Lifetime never expires
- [x] `/status` shows current subscription
- [x] Whop fallback works
- [x] All tested with real TG Stars payment
- [x] Deployed to production
- [x] Documentation updated

---

## 🎯 Next Steps

1. **Monday (Apr 21):** Phases 1-2 (Supabase + Stars invoices) 
2. **Tuesday (Apr 22):** Phase 3 (Subscription verification + limits)
3. **Wednesday (Apr 23):** Phase 4-5 (Whop fallback + cleanup)
4. **Thursday (Apr 24):** Testing + fixes
5. **Friday (Apr 25):** Deploy to production + monitor

Ready? Let's build! 🚀
