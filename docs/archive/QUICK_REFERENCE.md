# ⚡ Quick Reference — Telegram Stars Implementation

## 📍 What Was Built (April 19, 2026)

### Core Files
```
src/services/supabase-client.js     (9.3 KB)  — Database operations
src/services/telegram-stars-payment.js  (11 KB)   — Payment handling
docs/SUPABASE_SCHEMA.sql            (3.4 KB)  — Database schema
```

### Documentation
```
INTEGRATION_GUIDE.md                (9.4 KB)  — 10-step code integration
TELEGRAM_STARS_IMPLEMENTATION.md    (11 KB)   — Full technical plan
READY_FOR_INTEGRATION.md            (9.1 KB)  — Checklist & overview
COMPLETE_SUMMARY.md                 (11 KB)   — Comprehensive reference
```

---

## 💳 Pricing

| Tier | Price | Days | TG Stars | You Get |
|------|-------|------|----------|---------|
| Monthly | $9.99 | 30 | 999 | ~$7 |
| Yearly | $99.99 | 365 | 9900 | ~$70 |
| Lifetime | $999 | ∞ | 99900 | ~$700 |

**Free Tier:** 3 gems max per export

---

## 🚀 Integration Roadmap

```
Monday (30 min)     → Copy files + Supabase SQL
Tuesday (2-3 hours) → Follow INTEGRATION_GUIDE.md
Wed-Thu (1-2 hours) → Test with real TG Stars
Friday (30 min)     → Deploy to production
─────────────────────────────────────────
Total: 4-5 hours
```

---

## 📖 How to Start

**Step 1: Read Overview (5 min)**
- Open: `READY_FOR_INTEGRATION.md`

**Step 2: Follow Integration (2-3 hours)**
- Open: `INTEGRATION_GUIDE.md`
- Follow: 10 steps exactly as written
- Update: `telegram-bot.js`

**Step 3: Setup Database (15 min)**
- Copy: SQL from `docs/SUPABASE_SCHEMA.sql`
- Paste: Into Supabase Dashboard → SQL Editor
- Run: Execute

**Step 4: Configure Environment**
```
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ODDS_API_KEY=...
```

**Step 5: Test (1-2 hours)**
- Run: `npm start`
- Test: `/subscribe` command
- Complete: Real TG Stars payment
- Verify: Supabase shows subscription

**Step 6: Deploy (30 min)**
- Commit: `git add -A && git commit -m "..."`
- Push: `git push origin main`
- Monitor: Bot logs

---

## 📂 File Structure

```
alexbet-sharp-bot/
├── src/services/
│   ├── supabase-client.js              ← New
│   └── telegram-stars-payment.js       ← New
├── docs/
│   └── SUPABASE_SCHEMA.sql             ← New
├── telegram-bot.js                     ← Update (10 steps)
├── INTEGRATION_GUIDE.md                ← New
├── TELEGRAM_STARS_IMPLEMENTATION.md    ← New
├── READY_FOR_INTEGRATION.md            ← New
├── COMPLETE_SUMMARY.md                 ← New
└── .env.example                        ← Update
```

---

## 🎯 Integration Steps Summary

1. Import services
2. Initialize Supabase
3. Register payment handlers
4. Add `/status` command
5. Update `/export` with limits
6. Remove old `/subscribe`
7. Add to `/help`
8. Update `/start`
9. Setup cron cleanup
10. Verify env vars

(See INTEGRATION_GUIDE.md for full details)

---

## ✅ Testing Checklist

- [ ] Bot starts without errors
- [ ] `/subscribe` shows 3 buttons
- [ ] Clicking button opens TG Stars checkout
- [ ] Real payment completes
- [ ] `/status` shows subscription
- [ ] `/export` respects 3-gem limit (free)
- [ ] `/export` unlimited for paid users
- [ ] Supabase has payment record
- [ ] Cron job runs hourly

---

## 🔧 Key Functions

### Supabase Client
- `getUser(userId)` — Fetch subscription
- `addSubscription(userId, tier)` — Add sub
- `isSubscriptionActive(userId)` — Check valid
- `logPayment(paymentData)` — Audit trail
- `cleanupExpiredSubscriptions()` — Cron job

### Payment Handler
- `sendSubscriptionMenu(bot, chatId)` — Show buttons
- `sendInvoice(bot, chatId, tier)` — Create invoice
- `handleSuccessfulPayment(msg, bot)` — Process payment
- `registerPaymentHandlers(bot)` — Setup listeners

---

## 🐛 Troubleshooting

**Bot won't start:**
- Check: SUPABASE_URL set in .env
- Check: SUPABASE_SERVICE_ROLE_KEY set
- Test: `node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"`

**/subscribe shows no buttons:**
- Check: `registerPaymentHandlers(bot)` called
- Check: telegram-stars-payment.js imported
- Test: Bot logs show "payment handlers registered"

**Payment fails:**
- Check: Bot token correct
- Check: TG Stars enabled for bot (check @BotFather)
- Check: Invoice sent (bot logs)
- Fallback: Show Whop link

**Subscription not saving:**
- Check: Supabase tables exist (run SQL schema)
- Check: SUPABASE_SERVICE_ROLE_KEY has write access
- Check: `payments` table has record
- Test: `SELECT * FROM users WHERE id = YOUR_USER_ID`

---

## 💬 Questions?

**Before Integration:**
- Is Supabase setup? (URL + key)
- Is bot token correct?
- Do you have .env configured?

**During Integration:**
- Stuck on a step? Check INTEGRATION_GUIDE.md examples
- Error message? Check bot logs: `npm start`

**After Testing:**
- Subscription not persisting? Check Supabase connection
- Export limits not working? Check isSubscriptionActive() helper

---

## 📊 Database Quick Reference

```sql
-- Check user subscription
SELECT * FROM users WHERE id = 123456;

-- Check payment history
SELECT * FROM payments WHERE user_id = 123456;

-- See all active subscriptions
SELECT id, subscription_tier, subscription_expiry 
FROM users 
WHERE subscription_tier != 'free';

-- Count by tier
SELECT subscription_tier, COUNT(*) 
FROM users 
GROUP BY subscription_tier;
```

---

## 🎯 Success Criteria

✅ `/subscribe` works  
✅ Real TG Stars payment completes  
✅ Supabase stores subscription  
✅ `/export` respects limits  
✅ Deployed to production  
✅ Bot monitoring enabled  

---

## 📞 Support

**GitHub:** `git log --oneline` shows commits  
**Code:** `src/services/` has all logic  
**Docs:** Read INTEGRATION_GUIDE.md for steps  
**Errors:** Check bot console: `npm start`  

---

## ⏱️ Timeline

| Task | Effort | When |
|------|--------|------|
| Setup files | 30 min | Mon |
| Code integration | 2-3 hrs | Tue |
| Testing | 1-2 hrs | Wed-Thu |
| Production | 30 min | Fri |
| **Total** | **4-5 hrs** | **This week** |

---

**Ready?** Open `INTEGRATION_GUIDE.md` and follow the 10 steps. 🚀

*Last Updated: April 19, 2026*
