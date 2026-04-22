# Development Handover Plan
## From Openclaw → New Development Team

**Effective Date:** April 18, 2026  
**Bot:** AlexBET Sharp Bot  
**Repository:** https://github.com/oddsifylabs/alexbet-sharp-bot

---

## What You're Taking Over

A Node.js Telegram bot that scans sports betting markets (6 leagues, 3 market types) for profitable +EV opportunities. Uses real-time odds from Odds API and Claude AI for edge detection.

**Current Status:** Functional MVP in production on Railway  
**Active Users:** Unknown (no metrics tracking)  
**Revenue:** Whop subscription integration stubbed (not collecting revenue yet)

---

## Immediate Actions (Do This First)

### 1. Security: Rotate Exposed API Keys (URGENT)
The following keys are hardcoded in the repo and need immediate rotation:

```javascript
// telegram-bot.js lines 28-29 (EXPOSED)
ODDS_API_KEY = 'dc525dcde4712306f140051f1641d509'
WHOP_API_KEY = 'apik_KKsouW3xnGXgD_C4864557_C_ff0a8acba2f254882b29c8fd091386060d13e87312678feb20efabdf9598e2'
```

**Actions:**
- [ ] Log into Odds API dashboard → rotate API key
- [ ] Log into Whop → rotate API key
- [ ] Log into Anthropic console → rotate API key (if exposed)
- [ ] Push new `.env.example` without keys
- [ ] Force Railway redeploy
- [ ] Check git history: `git log --all --oneline | head -20`
- [ ] If keys in old commits, force-push (warning: rewrites history)

---

### 2. Verify Current Deployment

```bash
# Check Railway status
railway status

# View logs
railway logs

# Current environment
railway env

# Test bot manually
telegram:// @alexbet_sharp_bot /start
```

**Questions to answer:**
- How many active users?
- Any error patterns in logs?
- Is Supabase connected?
- Is Claude integration working?

---

### 3. Document Current State

Before making changes, capture:
- [ ] User count (query Telegram API or Supabase)
- [ ] Daily scan frequency
- [ ] Error rates (check Railway logs)
- [ ] Gems per day (average)
- [ ] Claude API costs/tokens used
- [ ] Current paid users (if any)

This becomes your baseline for the refactor.

---

## Week 1: Stabilization

### Goal
Get the bot secure, stable, and documented.

### Tasks

1. **Clean up secrets** (2h)
   - Remove hardcoded keys from code
   - Verify `.env.example` has all required vars
   - Add comment: "Never commit .env or API keys"

2. **Add error handling** (4h)
   - Distinguish "no games" vs "API error" in /scan response
   - Add timeout to https.get (10s)
   - Log all errors with timestamps
   - Return user-friendly error messages

3. **Set up logging** (2h)
   - Install `winston` or `pino`
   - Add INFO/WARN/ERROR levels
   - Log API calls, Claude analysis, user actions
   - Store logs to file for debugging

4. **Write runbook** (2h)
   - How to deploy changes
   - How to check logs
   - How to rotate keys
   - How to handle bot downtime

5. **Test manual flow** (1h)
   - Set up test user
   - Run /start → /scan → verify gems
   - Check logs
   - Document any issues

---

## Week 2-3: Data Persistence

### Goal
Move user state from memory to Supabase.

### Tasks

1. **Set up Supabase schema** (3h)
   ```sql
   CREATE TABLE users (
     id INT PRIMARY KEY,
     telegram_id BIGINT UNIQUE,
     bankroll INT,
     timezone TEXT,
     tier VARCHAR(20),
     subscription_expires_at TIMESTAMP
   );

   CREATE TABLE bets (
     id UUID PRIMARY KEY,
     user_id INT,
     game_id TEXT,
     pick TEXT,
     odds FLOAT,
     stake INT,
     status VARCHAR(20), -- pending/won/lost
     created_at TIMESTAMP,
     resolved_at TIMESTAMP
   );
   ```

2. **Create User model** (3h)
   ```javascript
   // src/models/User.js
   class User {
     static async getOrCreate(telegramId) { }
     static async setBankroll(userId, amount) { }
     static async setTimezone(userId, tz) { }
     static async getStats(userId) { }
   }
   ```

3. **Migrate user data** (2h)
   - Query in-memory `userBankrolls` & `userTimezones`
   - Insert into Supabase
   - Test round-trip

4. **Update telegram-bot.js to use models** (4h)
   - Replace `userBankrolls[userId] = ...` with `User.setBankroll(userId, ...)`
   - Replace `userTimezones[userId] || ...` with `await User.getTimezone(userId)`
   - Add await/async where needed

5. **Test persistence** (2h)
   - Restart bot
   - Verify user data survives
   - Check Supabase directly

---

## Week 4: Refactoring & Modularization

### Goal
Split monolithic telegram-bot.js into maintainable modules.

### Structure

```
src/
├─ bot.js (170 lines)
│  ├─ Telegram handlers (/start, /scan, /stats, etc.)
│  └─ User interactions only
│
├─ services/
│  ├─ oddsService.js (150 lines)
│  │  └─ fetchRealGems(bankroll, timezone)
│  │  └─ scoring, EV, Kelly logic
│  │
│  ├─ claudeService.js (120 lines)
│  │  └─ analyzeGame(gem)
│  │  └─ caching layer
│  │
│  ├─ whopService.js (80 lines)
│  │  └─ checkSubscription(userId)
│  │  └─ getSubscriptionTier(userId)
│  │
│  └─ analyticsService.js (100 lines)
│     └─ trackBet(userId, gem)
│     └─ getStats(userId)
│
├─ models/
│  ├─ User.js (50 lines)
│  ├─ Bet.js (50 lines)
│  └─ Gem.js (40 lines)
│
├─ utils/
│  ├─ odds.js (30 lines) — americanToDecimal, Kelly math
│  ├─ validation.js (40 lines) — input validation
│  ├─ logger.js (20 lines) — logging setup
│  └─ constants.js (30 lines) — magic numbers
│
└─ config.js (20 lines)
   └─ environment variables
```

### Tasks

1. **Create services/** (12h)
   - Move `fetchRealGems()` → oddsService.js
   - Move Claude logic → claudeService.js
   - Create whopService.js (subscription check)
   - Create analyticsService.js (track bets)

2. **Create utils/** (4h)
   - Extract `americanToImpliedProb()`, `calculateKellyStake()` → odds.js
   - Create validation.js (validate bankroll, timezone, etc.)
   - Create logger.js (logging wrapper)
   - Create constants.js (EV thresholds, Kelly caps, etc.)

3. **Create models/** (3h)
   - User.js (Supabase queries)
   - Bet.js (insert/update bets)
   - Gem.js (cache gems)

4. **Rewrite bot.js** (4h)
   - Import services
   - Simplify handlers to 5-10 lines each
   - Add error handling per handler

5. **Test all flows** (3h)
   - /start → /scan → /stats
   - Verify gems calculated same as before
   - Check Supabase updates

---

## Week 5: Features & Monetization

### Goal
Implement premium features and revenue tracking.

### Tasks

1. **Implement Whop integration** (4h)
   - Fetch user subscription from Whop
   - Check tier: free/sharp/elite
   - Cache for 1 hour
   - Pass to Claude analysis

2. **Implement /subscribe command** (2h)
   - Link to Whop shop
   - Show current tier
   - Show pricing

3. **Implement /pending command** (4h)
   - Query bets table
   - Group by status (pending/won/lost)
   - Show totals & P&L

4. **Implement /stats command** (4h)
   - Win rate by sport/market
   - Avg edge vs actual result
   - ROI over time
   - Best/worst picks

5. **Add rate limiting** (2h)
   - Max 1 scan per 5 seconds
   - Max 5 scans per hour (free tier)
   - Unlimited (premium tier)

---

## Testing & QA

### Unit Tests to Write

```javascript
// tests/odds.test.js
- americanToDecimal(100) === 2.0
- americanToDecimal(-110) ≈ 1.909
- americanToImpliedProb(110) ≈ 0.523
- calculateKellyStake(1000, 0.55, -110) ≈ $25

// tests/gem-scanner.test.js
- EV calculation with 2-way market
- EV calculation with 3-way market
- Vig removal logic
- Best price selection across books

// tests/models/User.test.js
- Create/read/update user
- Bankroll persistence
- Timezone persistence
```

### Integration Tests

```javascript
// tests/integration.test.js
- /start handler creates user
- /scan fetches gems
- /stats returns P&L
- Bankroll limits Kelly stake
```

### Manual QA Checklist

- [ ] /start → bot asks for bankroll
- [ ] Bankroll validation (reject < $50)
- [ ] /scan → returns gems or "no games"
- [ ] /scan timeout after 15 seconds (user sees "still loading...")
- [ ] /stats → returns real P&L data
- [ ] /subscribe → shows Whop link
- [ ] /pending → shows open bets
- [ ] Rate limiting works (5th scan in 5s rejected)
- [ ] Bot recovers if Railway restarts
- [ ] Timezone change persists

---

## Monitoring & Observability

### Set Up Logging
```bash
# Railway: Enable persistent logs
railway logs --follow

# Add to config:
LOG_LEVEL=info
LOG_FILE=/logs/bot.log
```

### Key Metrics to Track

- Daily active users (DAU)
- Gems scanned per day
- Avg gems per user per /scan
- Claude API tokens used
- Claude analysis confidence distribution
- Error rate by endpoint
- API latency (Odds API, Claude, Supabase)
- Bot uptime

### Alerting Rules

- [ ] Bot down > 5 min → alert you
- [ ] Odds API fails > 10% of requests → investigate
- [ ] Claude cost > $50/day → alert (check for abuse)
- [ ] Memory usage > 500MB → restart bot
- [ ] Error rate > 5% → alert

---

## Maintenance Tasks

### Daily
- Check Railway logs for errors
- Monitor Claude API usage
- Check user feedback (Telegram)

### Weekly
- Review analytics (DAU, gems, errors)
- Check for pending bugs
- Monitor Odds API quota usage

### Monthly
- Review P&L accuracy (spot-check gems)
- Optimize Claude prompts (if confidence < 60%)
- Update sports/markets (new leagues?)
- Rotate keys (security best practice)

---

## Documentation

### To Write
- [ ] Deployment guide (README)
- [ ] Architecture diagram (src/ARCHITECTURE.md)
- [ ] API reference (src/services/README.md)
- [ ] Configuration guide (.env.example → .env.docs.md)
- [ ] Debugging guide (LOG_LEVEL=debug)
- [ ] Data schema (Supabase schema.sql)

### Keep Updated
- [ ] CHANGELOG.md (tag releases)
- [ ] this file (development plan)

---

## Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Security & Stabilization | Rotated keys, error handling, logging |
| 2-3 | Data Persistence | Supabase schema, User model, migration |
| 4 | Refactoring | Modular architecture, 80% unit tests |
| 5 | Features | Whop, /pending, /stats, rate limits |
| 6 | QA & Polish | Manual testing, monitoring, docs |

**Total: 6 weeks** (if full-time: 2 devs working ~40h each/week)

---

## Contacts

- **Telegram Bot:** @alexbet_sharp_bot
- **Support Email:** support@alexbet.io
- **Whop Store:** https://whop.com/oddsify-shop
- **GitHub:** https://github.com/oddsifylabs/alexbet-sharp-bot

---

## Questions Before We Start?

1. How many active users should we expect to handle?
2. What's the revenue target (is Whop working)?
3. Do you want to track wet-run results (which gems actually won)?
4. Should we add more sports/markets?
5. Any feature requests from users?

