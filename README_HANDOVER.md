# AlexBET Sharp Bot - Development Handover (April 18, 2026)

Welcome! You are now the primary developer for the AlexBET Sharp Bot. This file summarizes the complete handover.

## 📋 What You Have

### The Project
- **Repository:** https://github.com/oddsifylabs/alexbet-sharp-bot
- **Status:** Functional MVP in production on Railway
- **Language:** Node.js (JavaScript)
- **Core Purpose:** Real-time sports betting edge detection via Telegram bot

### Documentation (Newly Created)

1. **CODE_ASSESSMENT.md** (14 KB, 11 sections)
   - Full code quality review
   - Business logic validation (A- grade)
   - Architecture assessment (D+ grade)
   - Security vulnerabilities identified
   - Performance analysis
   - 11 recommendations with effort estimates
   
2. **DEVELOPMENT_PLAN.md** (10 KB, 6-week roadmap)
   - Week 1: Security & stabilization (error handling, logging, key rotation)
   - Week 2-3: Data persistence (Supabase migration)
   - Week 4: Modular refactoring (split 936-line monolith into services)
   - Week 5: Premium features (Whop integration, /stats, /pending)
   - Week 6: QA & monitoring
   - Estimated effort: 80 hours total
   
3. **QUICK_START.md** (7 KB, Developer Reference)
   - Local development setup
   - Key functions with line numbers
   - Testing procedures
   - Common issues & fixes
   - Git workflow
   - Deployment instructions

4. **Original Docs**
   - README.md (brief overview)
   - BOT_HELP_GUIDE.md (user help)
   - .env.example (config template)

### Codebase

**Main Files:**
- `telegram-bot.js` (936 lines) — Bot core + all handlers
- `claude-optimizer.js` (286 lines) — AI analysis layer
- `api-endpoints.js` (unused example)

**Config:**
- `package.json` — Dependencies
- `Procfile` — Railway deployment
- `.env.example` — Required env vars

## 🚨 Critical Issues (Fix These First)

### 1. Exposed API Keys
**Location:** `telegram-bot.js` lines 28-29
```javascript
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';
const whopApiKey = process.env.WHOP_API_KEY || 'apik_KKsouW3xnGXgD_C4864557_C_...';
```
**Action:** ROTATE KEYS IMMEDIATELY
- Odds API dashboard → new key
- Whop console → new key
- Anthropic console → check if exposed
- Redeploy to Railway
- Remove hardcoded fallbacks from code

### 2. No Error Handling
- User sees nothing when API fails (silent failures)
- No timeout on HTTPS calls (could hang indefinitely)
- JSON parsing without validation
- API errors logged but not user-visible

### 3. Memory Leaks
- User data stored in-memory, unbounded growth
- Claude cache never garbage collected
- In-memory state lost on every restart

### 4. No Testing
- 0% code coverage
- No unit tests
- No integration tests
- Manual testing only

### 5. Incomplete Integration
- Supabase credentials in .env but unused in code
- Whop subscription check is stubbed (returns false for all users)
- /pending, /stats, /export commands not implemented
- Claude Sonnet/Opus disabled (cost-saving, reduces quality)

## ✅ What's Working Well

### Business Logic (Grade: A-)
- EV calculation: ✓ Correct formula
- Kelly criterion: ✓ Sound math (conservative 0.5× × 5% cap)
- Implied probability: ✓ Correct conversions
- Fair probability: ✓ Vig removal is valid
- Gem filtering: ✓ Minimum EV threshold working

### API Integration
- Real odds from the-odds-api.com: ✓ Working
- Claude AI analysis: ✓ Haiku model working
- Telegram bot API: ✓ Polling mode stable
- Supabase connection: ⚠️ Configured but unused

## 📊 Key Metrics (Establish Baseline)

Before refactoring, measure current state:
- Active users: ?
- Daily scans: ?
- Average gems per scan: ?
- Error rate: ?
- Claude API cost/day: ?
- Odds API calls/day: ?

## 🎯 Quick Start

### 1. Read the Docs
```bash
cd ~/projects/alexbet-sharp-bot
cat CODE_ASSESSMENT.md      # Understand the code
cat DEVELOPMENT_PLAN.md     # See the roadmap
cat QUICK_START.md          # Developer reference
```

### 2. Set Up Locally
```bash
npm install
export TELEGRAM_BOT_TOKEN="your_test_token"
npm start
```

### 3. Test the Bot
- Open Telegram, find your test bot
- Send `/start`
- Enter bankroll (e.g., 100)
- Send `/scan`
- Should see gems in 5-10 seconds

### 4. Next Actions
1. ✅ Rotate API keys (URGENT)
2. ✅ Add error handling & logging (Week 1)
3. ✅ Migrate to Supabase (Week 2-3)
4. ✅ Refactor to modules (Week 4)
5. ✅ Implement premium features (Week 5)

## 📁 File Structure (After Refactoring)

Target structure (currently monolithic):
```
src/
├─ bot.js                   # Main Telegram handlers
├─ services/
│  ├─ oddsService.js        # Odds API, EV, Kelly
│  ├─ claudeService.js      # AI analysis
│  ├─ whopService.js        # Subscription checks
│  └─ analyticsService.js   # User stats & P&L
├─ models/
│  ├─ User.js               # Supabase queries
│  ├─ Bet.js
│  └─ Gem.js
├─ utils/
│  ├─ odds.js               # Math utilities
│  ├─ validation.js
│  ├─ logger.js
│  └─ constants.js
└─ config.js
```

## 💰 Cost Estimate (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Odds API | $30-100 | Depends on volume |
| Claude Haiku | $1-5 | Very cheap |
| Supabase | Free | Up to 500k queries |
| Telegram | Free | — |
| Railway | Free/5-20 | Depends on traffic |
| Whop | % revenue | Not yet active |
| **Total** | **$35-130** | — |

## 🔒 Security Checklist

- [ ] Rotate API keys (Odds, Whop, Anthropic)
- [ ] Remove hardcoded fallback keys from code
- [ ] Update .env.example (no real keys)
- [ ] Add .gitignore entries (.env, *.key, credentials.json)
- [ ] Review git history (check for exposed secrets)
- [ ] Set up Supabase row-level security
- [ ] Add rate limiting per user
- [ ] Implement input validation

## 📞 Support & Questions

### Where to Find Things
- **Business logic questions:** See QUICK_START.md (line numbers & explanations)
- **Architecture questions:** See CODE_ASSESSMENT.md (section 1-9)
- **Refactoring roadmap:** See DEVELOPMENT_PLAN.md
- **Common issues:** See QUICK_START.md (troubleshooting section)

### Contacts
- Telegram bot: @alexbet_sharp_bot
- Support email: support@alexbet.io
- GitHub: https://github.com/oddsifylabs/alexbet-sharp-bot

## 📅 Timeline

**Week 1 (Apr 18-25):** Security & stabilization
**Week 2-3 (Apr 25-May 9):** Data persistence
**Week 4 (May 9-16):** Modular refactoring
**Week 5 (May 16-23):** Premium features
**Week 6 (May 23-30):** QA & monitoring

**Total Effort:** ~80 hours (or 4 weeks with 1 dev, 2 weeks with 2 devs)

## 🎓 Learning Path

1. **Day 1:** Read CODE_ASSESSMENT.md (understand the code)
2. **Day 2:** Read DEVELOPMENT_PLAN.md (understand priorities)
3. **Day 3:** Run locally, test the bot manually
4. **Day 4:** Rotate API keys (security first)
5. **Day 5:** Add error handling & logging (Week 1 task)

---

**Handover Date:** April 18, 2026  
**Status:** ✅ COMPLETE  
**Next Step:** Rotate API keys and start Week 1  

Good luck! Questions? Start with the docs above. 🚀
