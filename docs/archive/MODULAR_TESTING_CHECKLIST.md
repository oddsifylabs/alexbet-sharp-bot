# AlexBET Sharp Bot - Module-by-Module Testing Checklist

## Overview
This document provides systematic testing of each bot module in isolation.

---

## Module 1: Core Bot Initialization
**File:** telegram-bot.js (lines 1-100)

### Tests
- [ ] Bot token is read from .env
- [ ] Bot connects to Telegram polling
- [ ] Bot doesn't crash on startup
- [ ] Logger initialized successfully
- [ ] Rate limiter initialized

**How to test:**
```bash
node telegram-bot.js
# Should see: "✅ AlexBET Sharp Bot running..."
```

---

## Module 2: Admin System
**File:** telegram-bot.js (lines 35-41)

### Tests
- [ ] Admin ID 8502906149 is in ADMIN_IDS array
- [ ] isAdmin() function works for admin
- [ ] isAdmin() function returns false for non-admin
- [ ] Admin status is checked in all export commands

**How to test:**
```bash
node -e "
const isAdmin = require('./telegram-bot.js').isAdmin;
console.log(isAdmin(8502906149)); // Should be true
console.log(isAdmin(12345));       // Should be false
"
```

---

## Module 3: /start Command
**File:** telegram-bot.js (lines 65-100)

### Tests
- [ ] Command responds within 2 seconds
- [ ] Welcome message contains bot description
- [ ] Admin users see admin badge
- [ ] Non-admin users don't see admin badge
- [ ] Buttons are clickable
- [ ] No errors in logs

**How to test in Telegram:**
```
Send: /start
Expected: Welcome message with feature list and admin badge (if admin)
```

---

## Module 4: /scan Command
**File:** telegram-bot.js (lines 736-950)

### Tests
- [ ] Command requires no parameters
- [ ] Shows "Fetching..." message
- [ ] Returns gems within 30 seconds
- [ ] Admin gets 9999 gems
- [ ] Free users get 3 gems
- [ ] Gems show sport, odds, edge, EV
- [ ] Claude analysis works (if enabled)
- [ ] No crashes on API failures
- [ ] Rate limiting works (max 10 per minute)

**How to test in Telegram:**
```
Send: /scan
Expected: Gem list with sport, odds, edge within 30 seconds
For admin: Should show many gems
For free: Should show only 3 gems, moneyline only
```

---

## Module 5: Export Commands
**File:** telegram-bot.js (lines 1350-1630)

### Test 5a: /export Menu
- [ ] Shows 3 export options
- [ ] Admin can see options
- [ ] Non-admin sees upgrade message
- [ ] Buttons are clickable

**How to test:**
```
Send: /export
Expected: Export options (or upgrade message if free user)
```

### Test 5b: /export_csv
- [ ] Requires recent /scan first
- [ ] Returns CSV file for admin
- [ ] Shows "premium only" for free users
- [ ] File is valid and readable
- [ ] File size shows correctly

**How to test:**
```
Send: /scan
Wait: 30 seconds
Send: /export_csv
Expected: CSV file downloads (for admin)
```

### Test 5c: /export_txt
- [ ] Returns readable text file
- [ ] File contains all gem data
- [ ] Formatted nicely for reading

**How to test:**
```
Send: /scan
Send: /export_txt
Expected: Text file with readable format
```

### Test 5d: /export_json  
- [ ] Returns valid JSON
- [ ] Contains all metadata
- [ ] Can be parsed by JSON readers

**How to test:**
```
Send: /scan
Send: /export_json
Expected: JSON file
Verify: Can be parsed by JSON validators
```

---

## Module 6: Subscription System
**File:** src/services/whop-payment.js

### Tests
- [ ] getSubscriptionDetails() returns correct object
- [ ] Admin always gets unlimited
- [ ] Free users get 3 gems
- [ ] Paid users get correct tiers
- [ ] Fails gracefully if API down

**How to test:**
```bash
node -e "
const {getSubscriptionDetails} = require('./src/services/whop-payment.js');
getSubscriptionDetails(8502906149).then(sub => {
  console.log('Admin sub:', sub);
  // Should show: {tier: 'admin', gems: 9999, export: true}
});
"
```

---

## Module 7: Timezone Persistence
**File:** telegram-bot.js (lines 755, 1260+)

### Tests
- [ ] /timezone command shows options
- [ ] Selected timezone is saved to Supabase
- [ ] /start loads timezone on restart
- [ ] Game times show in user's timezone
- [ ] Default is America/New_York

**How to test:**
```
Send: /timezone
Select: CST (Central)
Wait: 1 hour
Restart bot
Send: /start
Expected: See timezone in data
```

---

## Module 8: Bankroll Persistence
**File:** telegram-bot.js (lines 754, 1290+)

### Tests
- [ ] /bankroll command allows setting amount
- [ ] Bankroll saved to Supabase
- [ ] /start loads bankroll on restart
- [ ] Quick select buttons work ($50, $100, $250, etc.)
- [ ] Custom amount option works
- [ ] Default is $100

**How to test:**
```
Send: /bankroll
Choose: $500
Wait: 1 hour  
Restart bot
Check: Bankroll should be $500
```

---

## Module 9: Rate Limiting
**File:** src/services/rateLimiter.js

### Tests
- [ ] Limit is 10 scans per 60 seconds
- [ ] After 10 scans, shows "rate limited" message
- [ ] Wait time counts down correctly
- [ ] Rate limit resets after 60 seconds
- [ ] Only applies to /scan, not other commands

**How to test:**
```
Send: /scan (10 times in 10 seconds)
Send: /scan (11th time)
Expected: "Rate limited! Please wait..."
```

---

## Module 10: Error Handling
**File:** telegram-bot.js (22 try-catch blocks)

### Tests
- [ ] Bot doesn't crash on invalid input
- [ ] User gets friendly error messages
- [ ] Errors are logged for debugging
- [ ] API failures don't crash bot
- [ ] Database errors handled gracefully

**How to test:**
```
Try edge cases:
- /scan when offline
- /export without running /scan first
- Unknown command
- Very long input
Expected: Graceful error message, bot stays running
```

---

## Full Integration Test

### Prerequisites
- [ ] Bot token in .env
- [ ] Whop API key configured
- [ ] Supabase URL and key configured
- [ ] Odds API key working
- [ ] Claude API key (optional)

### Test Sequence
1. [ ] Send /start → Welcome message
2. [ ] Send /help → Command list
3. [ ] Send /scan → Gems returned
4. [ ] Send /export_csv → CSV file
5. [ ] Send /status → Subscription status
6. [ ] Send /timezone → Timezone options
7. [ ] Send /bankroll → Bankroll options
8. [ ] Wait 1 minute, send /scan again → Works (rate limit reset)

**Expected:** All commands respond, no errors, files download

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| /start response | <2s | ___ |
| /scan response | <30s | ___ |
| /export response | <3s | ___ |
| /status response | <1s | ___ |
| Rate limiting | 10/min | ___ |
| Memory usage | <100MB | ___ |
| CPU usage | <5% | ___ |

---

## Sign-Off

When all tests pass:
- [ ] Bot is production ready
- [ ] User can rely on it
- [ ] No further issues expected

Date tested: ___________
Tester: ___________
Result: ✅ PASS / ❌ FAIL

---

