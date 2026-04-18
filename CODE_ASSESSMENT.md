# AlexBET Sharp Bot - Code Assessment & Review

**Date:** April 18, 2026  
**Reviewer:** Development Team  
**Status:** Under New Development Management

---

## Executive Summary

The AlexBET Sharp Bot is a **Node.js Telegram bot** for detecting profitable sports betting opportunities across 6 leagues (NBA, NFL, MLB, NHL, ATP, EPL) and 3 market types (Moneyline, Spreads, Totals).

**Overall Assessment:** **FUNCTIONAL BUT NEEDS REFACTORING**

- ✅ **Core logic works:** Real-time odds fetching, EV calculation, Kelly sizing
- ✅ **API integration:** Telegram, Odds API, Supabase, Whop, Anthropic Claude
- ⚠️ **Architecture:** Monolithic, lacks error handling, memory leaks possible
- ❌ **Production readiness:** Not ready for scaling (no queuing, limited concurrency)
- ❌ **Testing:** No test suite, no CI/CD pipeline

---

## 1. CODE STRUCTURE & ARCHITECTURE

### Current Architecture
```
telegram-bot.js (936 lines) — Main bot handler
├─ Odds API fetching (https native)
├─ Game analysis (EV, edge, Kelly sizing)
├─ User bankroll management (in-memory)
├─ Telegram message handlers
└─ Claude optimizer integration

claude-optimizer.js (286 lines) — AI analysis layer
├─ Caching strategy (team stats, odds, CLV)
├─ Model selection pipeline (Haiku-only, disabled Sonnet/Opus)
├─ Prompt optimization & JSON parsing
└─ Cost tracking
```

### Issues

1. **Monolithic Design**
   - 936 lines in single file (should be <300)
   - Mixed concerns: API calls, business logic, Telegram handlers
   - No separation of layers (controller, service, data)

2. **Memory Management**
   - `userBankrolls = {}` and `userTimezones = {}` are unbounded
   - No cleanup for inactive users → Memory leak over weeks
   - In-memory state lost on restart

3. **Error Handling**
   - Try-catch blocks catch errors but don't retry
   - API failures silently degrade (resolve with null)
   - No exponential backoff for rate limits
   - Telegram API errors logged but not user-facing

4. **Concurrency Issues**
   - `fetchRealGems()` makes 18 parallel HTTPS requests (6 sports × 3 markets)
   - No rate limiting or connection pooling
   - Could hit API rate limits or timeout on slow networks

---

## 2. BUSINESS LOGIC REVIEW

### EV Calculation ✅ (CORRECT)
```javascript
const decimalOdds = americanToDecimal(bestPrice);
const ev = (fairProb * decimalOdds) - 1;
```
- Fair probability calculated by averaging across bookmakers and removing vig
- Decimal odds conversion is mathematically sound
- EV filtering (`ev <= 0.01`) reasonable minimum threshold

### Kelly Criterion Implementation ✅ (CORRECT but AGGRESSIVE)
```javascript
const rawKelly = ((b * fairProb) - q) / b;
const cappedKelly = Math.max(0, Math.min(rawKelly, 0.05));
return Math.floor(bankroll * cappedKelly * 0.5);
```
- Formula is correct: K% = (fairProb × decimalOdds - 1) / (decimalOdds - 1)
- **BUT**: 5% cap + 0.5× multiplier = **ultra-conservative** (1-2.5% max stake)
- Reasonable for retail bettors, but might discourage premium users
- Could make this tier-based (free users: 1%, premium: 3-5%)

### Implied Probability Extraction ✅ (CORRECT)
```javascript
// Positive odds: 100 / (odds + 100)
// Negative odds: abs(odds) / (abs(odds) + 100)
```
- Standard American to decimal conversion
- Correctly handles both positive/negative odds

### Vig Removal & Fair Prob Averaging ✅ (SOUND)
```javascript
const vigTotal = implieds.reduce((sum, value) => sum + value, 0);
const fairProb = impliedProb / vigTotal;
```
- Removes vig by normalizing across all outcomes
- Averaging fair probs across bookmakers is valid (consensus approach)

**Business Logic Grade: A-** (Solid but could be more aggressive)

---

## 3. CODE QUALITY ISSUES

### Critical Issues

1. **Hardcoded API Keys** ⚠️ SECURITY RISK
   ```javascript
   // Line 28-29
   const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';
   const whopApiKey = process.env.WHOP_API_KEY || 'apik_KKsouW3xnGXgD_C4864557_C_ff...';
   ```
   - **DANGER:** These are real API keys exposed in GitHub
   - Action: Rotate these keys immediately
   - Never commit keys to Git (use .env only)

2. **Incomplete Error Responses**
   ```javascript
   // User sees nothing when /scan fails
   if (!gems || gems.length === 0) {
     bot.sendMessage(chatId, '⏳ No live games scheduled...');
     return; // Silent failure if network error
   }
   ```
   - Should distinguish between "no games" vs "API error"
   - Return 500-style error message

3. **No Timeout on API Calls**
   ```javascript
   https.get(url, (res) => { ... });
   // No timeout set → could hang indefinitely
   ```
   - Should set timeout at 10s per request
   - Railway free tier has 30s limit per request

4. **JSON Parsing Without Validation**
   ```javascript
   games = JSON.parse(data) || [];
   games.forEach(game => {
     const bookmakers = game.bookmakers || [];
     // ...
   });
   ```
   - Assumes `games` is array; could be `{error: "..."}` from API
   - No schema validation (use `zod` or `joi`)

### Major Issues

5. **Claude Optimizer Pipeline Issues**
   - Haiku-only mode disabled Sonnet/Opus (cost saving, but reduces quality)
   - No feedback loop: what edges actually converted to wins?
   - Caching TTL hardcoded (4-24 hours) — should be config
   - Cache never garbage collected → unbounded memory growth

6. **Subscription Logic Missing**
   ```javascript
   const isPremium = false; // TODO: Check user subscription from Whop
   ```
   - Hardcoded to false for all users
   - Whop integration not implemented
   - Free tier limited to 5 gems/day, but no enforcement

7. **Timezone Handling**
   ```javascript
   const timezone = userTimezones[userId] || 'America/New_York';
   // User can set with /timezone command, but...
   // Stored in-memory, lost on restart
   ```
   - Should be persisted to Supabase
   - No validation that timezone is real (could be garbage)

8. **Game DateTime Formatting**
   ```javascript
   new Intl.DateTimeFormat('en-US', { timeZone: timezone, ... })
   ```
   - This works, but edge case: what if Intl API unavailable?
   - Consider using `date-fns` or `luxon` for reliability

### Minor Issues

9. **Magic Numbers**
   - `0.01` EV threshold (line 215)
   - `0.05` Kelly cap (line 115)
   - `0.5` Kelly discount (line 116)
   - `2` minimum books (line 207)
   - Should be config constants

10. **Logging Quality**
    ```javascript
    console.log(`[/start] User ${userId}`); // No timestamp
    ```
    - Logs lack timestamps, severity levels (INFO/WARN/ERROR)
    - Should use proper logger (winston, pino)

11. **Type Safety**
    - Node.js, no TypeScript
    - No JSDoc type hints (makes code harder to review)
    - Missing input validation throughout

---

## 4. TESTING & DEPLOYMENT

### Testing: **ZERO**
- No unit tests
- No integration tests
- No test fixtures
- No test optimizer (mentioned in package.json but doesn't exist)

### Deployment Issues
- Deployed to Railway (mentioned in README)
- Procfile exists but only `node telegram-bot.js`
- No health check endpoint
- No graceful shutdown (will lose pending requests if redeployed)
- Environment variables hardcoded as fallback

### Missing Observability
- No structured logging
- No metrics (games scanned, gems found, API latency)
- No error tracking (Sentry would help)
- No alerting if bot goes down

---

## 5. DATABASE & DATA PERSISTENCE

### Current State
- Supabase credentials in ENV but never used in code
- User data stored in-memory only
- No schema for users, bets, performance tracking
- Bankroll stored per-session, lost on restart

### Required Tables (Supabase)
```sql
-- users
CREATE TABLE users (
  id INT PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  bankroll INT,
  timezone TEXT,
  tier VARCHAR(20), -- 'free', 'sharp', 'elite'
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- bets (track user picks)
CREATE TABLE bets (
  id UUID PRIMARY KEY,
  user_id INT REFERENCES users(id),
  game_id TEXT,
  pick TEXT,
  odds FLOAT,
  edge FLOAT,
  stake INT,
  status VARCHAR(20), -- 'pending', 'won', 'lost'
  result_odds FLOAT,
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- gems (cache for quick replay)
CREATE TABLE gems (
  id TEXT PRIMARY KEY,
  game_id TEXT,
  sport TEXT,
  pick TEXT,
  odds FLOAT,
  edge FLOAT,
  ev FLOAT,
  kelly_stake INT,
  fetched_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

---

## 6. SECURITY ASSESSMENT

### Vulnerabilities

1. **Exposed API Keys** (CRITICAL)
   - GitHub commit history contains real keys
   - Action: Rotate immediately via Odds API, Whop, Anthropic consoles
   - Add to `.gitignore`: `.env`, `*.key`, `credentials.json`

2. **No Input Validation**
   - Bankroll input: accepts any string, parseInt silently fails
   - Timezone input: no validation against IANA list
   - Game data from API: no schema validation

3. **No Rate Limiting**
   - Users can spam `/scan` every second
   - No per-user rate limits on Telegram side
   - Should limit to 1 scan/5 seconds per user

4. **No Authentication**
   - Anyone with bot token can talk to it
   - Telegram handles auth, but Whop subscription check is stubbed
   - Premium features disabled: `/subscribe` command exists but does nothing

5. **Data Privacy**
   - Bankroll & timezone stored in-memory (visible in process)
   - No encryption at rest
   - Supabase keys in ENV (should be service-level, not in bot)

---

## 7. PERFORMANCE ANALYSIS

### API Calls
```
Per /scan:
- 18 parallel HTTPS requests (6 sports × 3 markets)
- ~3-5 seconds total (await all)
- No caching → 18 calls every time
- Odds API limit: ?/month (check plan)
```

### Memory Usage
```
Unbounded growth:
- userBankrolls: 1 user = 4 bytes (number), 1M users = 4MB (acceptable)
- userTimezones: 1 user = ~15 bytes (string), 1M users = 15MB (acceptable)
- Claude optimizer cache: depends on gem volume
  If 1000 gems cached: ~100KB each = 100MB possible leak
- Telegram message handlers: add listener for every onText = memory leak if not removed
```

### Latency
- Odds API roundtrip: 2-4s
- Claude analysis (10 top gems × Haiku-only): 2-5s
- Total per /scan: 4-9s, acceptable for user experience

---

## 8. MISSING FEATURES / ROADMAP

### Currently Stubbed
1. `/subscribe` — Whop integration missing
2. `/export` — CSV/JSON/PDF export not implemented
3. `/pending` — Live bets tracking not implemented
4. `/stats` — Analytics dashboard missing
5. Premium tier Claude analysis (Sonnet/Opus) — disabled for costs

### Critical Gaps
1. **No wet-run tracking** — Which gems actually won?
2. **No P&L dashboard** — Users can't see performance
3. **No alerts** — Only manual `/scan` pulls
4. **No CLV tracking** — Closing-line value analysis missing
5. **No arbitrage detection** — Cross-book opportunities not detected

---

## 9. RECOMMENDATIONS (PRIORITY ORDER)

### Immediate (Week 1)
- [ ] Rotate API keys (Odds API, Whop, Anthropic)
- [ ] Remove hardcoded fallback keys from code
- [ ] Add `.env.example` with all required vars
- [ ] Implement error handling: distinguish API error vs no games
- [ ] Add timeout to https.get() calls (10s timeout)
- [ ] Set up basic logging (use console.log with timestamp, or migrate to winston)

### High Priority (Weeks 2-3)
- [ ] Migrate user data to Supabase (users, bets tables)
- [ ] Implement persistence for bankroll & timezone
- [ ] Add input validation (joi or zod)
- [ ] Split telegram-bot.js into modules:
  ```
  src/
  ├─ bot.js (main entry, Telegram handlers)
  ├─ services/
  │  ├─ oddsService.js (Odds API)
  │  ├─ gemScanner.js (EV, Kelly, edge logic)
  │  ├─ claudeService.js (AI analysis)
  │  └─ whopService.js (subscription checks)
  ├─ models/
  │  ├─ User.js
  │  ├─ Bet.js
  │  └─ Gem.js
  ├─ utils/
  │  ├─ odds.js (conversions)
  │  ├─ validation.js
  │  └─ logger.js
  └─ config.js
  ```
- [ ] Add rate limiting per user
- [ ] Implement Whop subscription checks
- [ ] Add unit tests for:
  - americanToImpliedProb()
  - calculateKellyStake()
  - EV calculation

### Medium Priority (Weeks 4-5)
- [ ] Build gem caching layer (Redis or Supabase)
- [ ] Implement `/pending` — track active bets
- [ ] Implement `/stats` — user P&L dashboard
- [ ] Add Claude feedback loop: did gems actually hit?
- [ ] Build webhook to update bet results from sportsbooks
- [ ] Add `/export` command (JSON, CSV)
- [ ] Implement premium features:
  - [ ] Sonnet analysis for high-value games
  - [ ] Custom Kelly sizing per tier
  - [ ] Scheduled alerts (instead of manual /scan)

### Long-Term (Weeks 6+)
- [ ] TypeScript migration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated tests (Jest)
- [ ] Monitoring & alerting (Sentry, DataDog)
- [ ] Scaling: move from polling to Telegram webhooks
- [ ] Multi-language support
- [ ] Web dashboard (React) linked to Telegram

---

## 10. ESTIMATED EFFORT

| Task | Effort | Priority |
|------|--------|----------|
| Security: Key rotation + hardening | 2h | CRITICAL |
| Error handling & logging | 4h | HIGH |
| Refactoring to modules | 12h | HIGH |
| Supabase data migration | 8h | HIGH |
| Rate limiting & validation | 4h | HIGH |
| Unit tests | 8h | MEDIUM |
| Whop subscription | 4h | MEDIUM |
| `/pending` & `/stats` | 12h | MEDIUM |
| Redis caching | 6h | MEDIUM |
| TypeScript migration | 20h | LOW |
| **TOTAL** | **~80h** | — |

---

## 11. CODE QUALITY METRICS

| Metric | Value | Grade |
|--------|-------|-------|
| Code coverage | 0% | F |
| Type safety | None (JS) | D |
| Error handling | 40% | D+ |
| Modularity | Monolithic | D |
| Documentation | README only | D |
| Security | Keys exposed | F |
| Performance | Acceptable | B |
| Business logic | Sound | A- |
| **Overall** | **Functional MVP** | **D+** |

---

## Conclusion

The AlexBET Sharp Bot is **functionally sound** for a betting odds scanner. The core EV/Kelly math is correct, and it successfully fetches real data and runs Claude analysis.

**However, it's NOT production-ready:**
- Security vulnerabilities (exposed keys)
- No data persistence (resets on deploy)
- Monolithic architecture (hard to extend)
- Zero testing & monitoring
- Missing premium features (Whop, analytics)

**Recommendation:** This is a solid foundation for iteration. Prioritize security (keys), data persistence (Supabase), and testing before scaling to thousands of users.

---

**Next steps:** Schedule a code review call to discuss priorities and assign tasks.

