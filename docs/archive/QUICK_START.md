# AlexBET Bot - Quick Reference Guide

## Project Setup

```bash
# Navigate to project
cd ~/projects/alexbet-sharp-bot

# Install dependencies (if not already done)
npm install

# Required env vars
TELEGRAM_BOT_TOKEN=xxx
ODDS_API_KEY=xxx
WHOP_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
VITE_SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Local Development

```bash
# Start bot locally (with polling, slower)
TELEGRAM_BOT_TOKEN=your_token npm start

# Dev mode with nodemon (auto-restart)
npm run dev

# Test Claude optimizer
npm run test-optimizer
```

## File Structure

```
.
├── telegram-bot.js          [MAIN] 936-line bot handler
├── claude-optimizer.js      [AI] Token optimization & caching
├── api-endpoints.js         [Unused in main file]
├── package.json
├── Procfile                 [Railway deployment config]
├── .env.example
└── CODE_ASSESSMENT.md       [📋 Full code review]
└── DEVELOPMENT_PLAN.md      [📅 Refactoring roadmap]
```

## Key Functions in telegram-bot.js

```javascript
// LINE NUMBERS & DESCRIPTIONS

63-72      americanToImpliedProb()     // Odds conversion
69-72      americanToDecimal()         // American → decimal odds
74-90      formatGameDateTime()        // Format game time per timezone
92-97      getOutcomeKey()             // Unique outcome identifier
99-108     formatPickLabel()           // Human-readable pick label

110-117    calculateKellyStake()       // Kelly criterion sizing
120-272    fetchRealGems()             // Main odds fetching (18 parallel calls)

275-298    /start handler              // Bankroll setup
301-316    bankroll input handler      // User input validation
319-366    /scan handler               // Fetch & analyze gems with Claude

275-800+   Other command handlers      // /stats, /timezone, /help, etc.
```

## How the Gem Scanning Works

1. **Fetch Odds** (fetchRealGems)
   - 6 sports × 3 markets = 18 parallel HTTPS calls
   - Fetches from Odds API (the-odds-api.com)
   - Returns games + bookmakers + outcomes + prices

2. **Calculate Fair Probability**
   - For each outcome across all bookmakers:
     - Convert odds to implied probability
     - Remove vig by normalizing (divide by total vig)
     - Average across bookmakers
   
3. **Calculate Edge**
   - fairProb = normalized consensus probability
   - impliedProb = implied from best price
   - edge = (fairProb - impliedProb) × 100%

4. **Filter Gems** (EV > 1% threshold)
   - EV = (fairProb × decimalOdds) - 1
   - Only show if ev > 0.01 (1% return)
   - Minimum 2 bookmakers required

5. **Size Bet with Kelly**
   - Conservative: kellyCap = 5%, discount = 0.5×
   - Stake = bankroll × kellyCap × discount × fairProb
   - Max bet = 2% of bankroll (very safe)

6. **Claude AI Analysis** (optional, if ANTHROPIC_API_KEY set)
   - Haiku model only (disabled Sonnet/Opus for cost)
   - Analyzes top 10 gems
   - Returns confidence & edge estimate

## Testing the Bot

### Local Test Flow
```bash
# 1. Set env vars
export TELEGRAM_BOT_TOKEN="your_test_bot_token"
export ODDS_API_KEY="your_odds_api_key"

# 2. Start bot
npm start

# 3. Open Telegram, find your test bot
# Message: /start

# 4. Respond with bankroll (e.g., 100)

# 5. Message: /scan
# Should see gems in 5-10 seconds

# 6. Check console for logs
```

### What Each Command Should Do

| Command | Expected Response |
|---------|-------------------|
| `/start` | Bot asks for bankroll |
| `/scan` | Shows top gems (5-20) grouped by sport |
| `/stats` | Shows P&L, win rate, ROI (currently placeholder) |
| `/pending` | Shows active bets (currently not implemented) |
| `/subscribe` | Shows Whop shop link |
| `/timezone` | Allows user to set timezone |
| `/help` | Lists all commands |

## Common Issues & Fixes

### Issue: "No games scheduled right now"
- **Cause:** API returned empty games list (off-season, night time)
- **Fix:** Try again in a few hours when games are happening
- **Check:** Query https://api.the-odds-api.com/v4/sports directly

### Issue: Gems look wrong (negative EV, bad odds)
- **Cause:** Possible issue with vig removal or bookmaker parsing
- **Check:** Log first 5 games in console, inspect bookmakers & outcomes
- **Debug:** Add console.log(JSON.stringify(game, null, 2)) around line 162

### Issue: Claude not analyzing
- **Cause:** ANTHROPIC_API_KEY not set or Claude API key invalid
- **Fix:** Check .env, verify API key in Anthropic console
- **Fallback:** Bot still works without Claude (uses math only)

### Issue: Bot crashes on message
- **Cause:** Unhandled error in message handler (probably JSON parsing)
- **Check:** Look at console logs, watch for "TypeError" or "Cannot read property"
- **Fix:** Add try-catch, return user-friendly error message

## Performance Notes

**API Calls per /scan:**
- 18 HTTPS requests (6 sports × 3 markets)
- ~3-5 seconds total (parallel)
- No caching currently (fresh data each time)
- Rate limit: Check Odds API plan (usually 500-5000/month)

**Memory Usage:**
- Current: ~50-100 MB (in-memory user state + Claude cache)
- Issue: Unbounded growth with 1000+ users
- Fix: Migrate to Supabase (in progress)

**Costs:**
- Odds API: ~$30-100/month (depends on volume)
- Claude Haiku: ~$0.80/month at current volume (~500 calls/day)
- Telegram: Free
- Supabase: Free tier up to 500k queries/month

## Git Workflow

```bash
# Check status
git status

# Create feature branch
git checkout -b feature/description
# Example: git checkout -b feature/add-supabase-persistence

# Make changes, commit
git add .
git commit -m "type: description"
# Types: feat, fix, docs, refactor, test, chore

# Push to GitHub
git push origin feature/description

# Create PR on GitHub
# (link to this repo)

# After review, merge to main
git switch main
git pull
git merge feature/description
git push
```

## Deployment

### Deploy to Railway

```bash
# Option 1: GitHub integration (automatic)
# - Push to main branch
# - Railway auto-deploys

# Option 2: Railway CLI
railway login
railway deploy

# Check logs
railway logs --follow

# View env vars
railway env
```

### First-time Railway Setup
1. Create Railway project
2. Connect GitHub repo
3. Set environment variables:
   - TELEGRAM_BOT_TOKEN
   - ODDS_API_KEY
   - WHOP_API_KEY
   - ANTHROPIC_API_KEY
   - VITE_SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
4. Set Node.js version: 18.x
5. Click Deploy

## Important Dates/Deadlines

- **Week 1 (by Apr 25):** Security keys rotated, error handling added
- **Week 2-3 (by May 9):** Supabase migration complete
- **Week 4 (by May 16):** Modular refactoring done
- **Week 5 (by May 23):** Premium features (Whop, /stats, /pending)
- **Week 6 (by May 30):** QA complete, monitoring set up

## Contact & Support

**Questions about the code?**
- See CODE_ASSESSMENT.md for detailed review
- See DEVELOPMENT_PLAN.md for refactoring roadmap

**Need to understand the math?**
- Line 110: Kelly criterion formula
- Line 184: Fair probability calculation (vig removal)
- Line 212: EV calculation (fairProb × decimal_odds - 1)

**Issues to check**
- GitHub Issues: Create issue for bugs/features
- Railway Logs: Check for runtime errors
- Telegram Bot: Test manually with @botfather /debug

---

Generated: April 18, 2026  
Version: 1.0  
Last Updated: See git log
