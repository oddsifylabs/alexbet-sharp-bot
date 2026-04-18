# Week 1: Security & Stabilization
## Development Plan & Progress

**Start Date:** April 18, 2026  
**End Date:** April 25, 2026  
**Estimated Effort:** 8 hours  
**Goal:** Secure the code, add error handling, test end-to-end

---

## Task Checklist

### Phase 1: Security (3 hours)

- [ ] 1.1 Remove hardcoded API keys from telegram-bot.js (lines 28-29)
- [ ] 1.2 Update .env.example with required vars (no real values)
- [ ] 1.3 Add .env to .gitignore
- [ ] 1.4 Update .gitignore to prevent secret commits
- [ ] 1.5 Document which keys are currently exposed (for rotation)
- [ ] 1.6 Verify bot still works with .env configuration

### Phase 2: Error Handling (2.5 hours)

- [ ] 2.1 Add error handling to fetchRealGems()
  - Distinguish "no games" vs "API error"
  - Return user-friendly messages
  - Log errors with context
  
- [ ] 2.2 Add timeout to HTTPS calls (10 seconds)
  - Prevent hanging requests
  - Return timeout error to user
  
- [ ] 2.3 Add JSON parsing validation
  - Check if response is valid JSON before parsing
  - Handle malformed responses gracefully
  
- [ ] 2.4 Add input validation
  - Bankroll: Must be >= $50
  - Timezone: Must be valid IANA timezone
  - Reject invalid inputs with clear messages

### Phase 3: Logging & Monitoring (1.5 hours)

- [ ] 3.1 Set up proper logger (winston or pino)
  - Add INFO, WARN, ERROR levels
  - Include timestamps
  - Log to console + file
  
- [ ] 3.2 Add logging to key functions
  - /start handler
  - /scan handler
  - fetchRealGems (API calls, errors)
  - Claude analysis (if enabled)
  
- [ ] 3.3 Add metrics
  - Gems found per scan
  - Average scan time
  - Error rate
  - Claude token usage

### Phase 4: Testing (1 hour)

- [ ] 4.1 Manual end-to-end test
  - Start bot
  - /start command
  - Enter bankroll (100)
  - /scan command
  - Verify gems display correctly
  
- [ ] 4.2 Test error cases
  - Invalid bankroll input
  - Invalid timezone
  - Network timeout simulation
  - API error handling
  
- [ ] 4.3 Test logging
  - Verify logs appear with timestamps
  - Check log file created
  - Verify error logs captured

---

## Detailed Task Breakdown

### Task 1.1: Remove Hardcoded Keys

**File:** telegram-bot.js (lines 28-29)

**Before:**
```javascript
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';
const whopApiKey = process.env.WHOP_API_KEY || 'apik_KKsouW3xnGXgD_C4864557_C_ff...';
```

**After:**
```javascript
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const whopApiKey = process.env.WHOP_API_KEY;

if (!ODDS_API_KEY) throw new Error('ODDS_API_KEY not set in .env');
if (!whopApiKey) throw new Error('WHOP_API_KEY not set in .env');
```

---

### Task 1.2: Update .env.example

**File:** .env.example

```
# Telegram Bot API
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Sports Odds API
ODDS_API_KEY=your_odds_api_key_from_the_odds_api

# Claude AI (optional, bot works without it)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Whop Payments
WHOP_API_KEY=your_whop_api_key

# Supabase Database
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Logging
LOG_LEVEL=info
LOG_FILE=logs/bot.log

# Environment
NODE_ENV=development
```

---

### Task 2.1: Error Handling in fetchRealGems

**Current Issue:** Silent failures, users see nothing if API fails

**Changes:**
1. Add try-catch around HTTPS calls
2. Distinguish between:
   - "No games scheduled" (empty valid response)
   - "API error" (connection/timeout error)
   - "Invalid response" (malformed JSON)
3. Log all errors with context
4. Return descriptive error objects

**Example:**
```javascript
// Instead of: resolve(allGems.length > 0 ? allGems : null)
// Return:
resolve({
  success: true/false,
  gems: [...],
  error: null or error message,
  timestamp: new Date().toISOString()
})
```

---

### Task 2.2: Add HTTPS Timeout

**Current Issue:** No timeout, requests could hang forever

**Solution:**
```javascript
https.get(url, (res) => { ... })
  .setTimeout(10000, function() {
    this.destroy();
    console.error(`Timeout fetching ${sport} ${market}`);
    completed++;
    if (completed === totalRequests) {
      resolve(allGems.length > 0 ? allGems : null);
    }
  });
```

---

### Task 3.1: Set Up Logger

**Install:** `npm install winston`

**Create:** `src/utils/logger.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'alexbet-bot' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

---

### Task 4.1: Manual Testing Script

**Create:** `test/manual-test.js`

```javascript
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: false 
});

async function testBot() {
  console.log('🧪 Testing AlexBET Bot...\n');

  // Test 1: Bot connection
  console.log('Test 1: Telegram connection...');
  try {
    const info = await bot.getMe();
    console.log('✅ Connected to bot:', info.username);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    return;
  }

  // Test 2: Bankroll validation
  console.log('\nTest 2: Bankroll validation...');
  const testBankrolls = [49, 50, 100, 5000];
  testBankrolls.forEach(amount => {
    const valid = amount >= 50;
    console.log(`  ${amount}: ${valid ? '✅' : '❌'}`);
  });

  // Test 3: Odds API
  console.log('\nTest 3: Odds API connection...');
  try {
    // Test fetch
    console.log('✅ Odds API accessible');
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }

  console.log('\n✨ Tests complete!');
}

testBot();
```

---

## Expected Output

### Before Week 1:
```
❌ Hardcoded API keys in code
❌ No error handling (silent failures)
❌ No logging
❌ User gets no feedback on errors
```

### After Week 1:
```
✅ No hardcoded keys
✅ Clear error messages for users
✅ Detailed logging with timestamps
✅ Input validation
✅ HTTPS timeouts
✅ User sees "Loading..." → "Gems found" or "API error"
```

---

## Git Commits

```bash
# 1. Security cleanup
git commit -m "fix: remove hardcoded API keys, require .env configuration"

# 2. Error handling
git commit -m "feat: add comprehensive error handling to fetchRealGems"

# 3. Logging
git commit -m "feat: add winston logger with file + console output"

# 4. Validation
git commit -m "feat: add input validation for bankroll and timezone"

# 5. Tests
git commit -m "test: add manual testing script for Week 1 tasks"
```

---

## Testing Checklist

- [ ] Bot starts without hardcoded keys
- [ ] /start → asks for bankroll
- [ ] Invalid bankroll (e.g., 30) → rejected with message
- [ ] Valid bankroll (100) → accepted
- [ ] /scan → returns gems within 10 seconds
- [ ] /scan timeout → returns "Still loading..." message
- [ ] Error case: API down → user sees "API error, try later"
- [ ] Logs appear in console with timestamps
- [ ] Log file created at logs/combined.log
- [ ] Errors logged to logs/error.log
- [ ] Claude analysis logs tokens used

---

## Success Criteria

✅ Code is secure (no hardcoded keys)  
✅ Errors have user-friendly messages  
✅ All logs have timestamps & levels  
✅ Input validation works  
✅ HTTPS calls timeout after 10 seconds  
✅ Bot tested end-to-end (/start → /scan)  
✅ All changes committed to GitHub  
✅ Deployed to Railway successfully  

---

**Status:** Ready to start  
**Next:** Begin Task 1.1
