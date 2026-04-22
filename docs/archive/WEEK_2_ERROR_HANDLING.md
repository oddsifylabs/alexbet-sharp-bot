# Week 2: Enhanced Error Handling & Resilience

**Start Date:** April 18, 2026  
**Duration:** 8 hours  
**Status:** In Progress  

---

## Objectives

✅ Rate limiting detection (handle 429 errors gracefully)  
✅ Exponential backoff for API failures  
✅ Better error messages for users  
✅ Timeout improvements & circuit breaker pattern  
✅ User-friendly fallback responses  

---

## Task 1: Rate Limiting Detection (2 hours)

### Problem
- Odds API has rate limits (10 requests/minute for free tier)
- Currently fails silently or returns confusing errors
- Users don't know to wait or upgrade

### Solution

**1.1 Create Rate Limiter Service**

```javascript
// src/services/rateLimiter.js

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs; // 1 minute
    this.requests = new Map(); // userId -> {count, resetTime}
  }

  isRateLimited(userId) {
    const now = Date.now();
    const userRecord = this.requests.get(userId) || { count: 0, resetTime: now + this.windowMs };

    // Reset window if expired
    if (now > userRecord.resetTime) {
      this.requests.set(userId, { count: 1, resetTime: now + this.windowMs });
      return false;
    }

    // Check limit
    if (userRecord.count >= this.maxRequests) {
      const secondsLeft = Math.ceil((userRecord.resetTime - now) / 1000);
      return { limited: true, secondsLeft, maxRequests: this.maxRequests };
    }

    // Increment counter
    userRecord.count++;
    return false;
  }

  reset(userId) {
    this.requests.delete(userId);
  }
}

module.exports = RateLimiter;
```

**1.2 Integration in telegram-bot.js**

```javascript
const RateLimiter = require('./src/services/rateLimiter');
const limiter = new RateLimiter(10, 60000); // 10 requests per minute

bot.onText(/\/scan/, async (msg) => {
  const userId = msg.from.id;
  
  // Check rate limit
  const limited = limiter.isRateLimited(userId);
  if (limited.limited) {
    logger.warn('User rate limited', { userId, secondsLeft: limited.secondsLeft });
    return bot.sendMessage(
      msg.chat.id,
      `⏸️ Whoa! You're scanning too fast.\n\nTry again in ${limited.secondsLeft} seconds.\n\n💡 Upgrade to Sharp tier for unlimited scans!`
    );
  }

  // Continue with scan logic
  // ...
});
```

---

## Task 2: Exponential Backoff (2.5 hours)

### Problem
- APIs temporarily fail (network issues, server overload)
- Currently fails immediately without retry
- User gets error instead of waiting for recovery

### Solution

**2.1 Create Exponential Backoff Utility**

```javascript
// src/utils/exponentialBackoff.js

async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    timeoutMs = 5000
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Set timeout for this attempt
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );
      
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (except 429)
      if (error.response?.status >= 400 && error.response?.status !== 429) {
        throw error;
      }

      // Calculate backoff delay
      if (attempt < maxAttempts) {
        const delayMs = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        
        logger.debug('Retrying after backoff', {
          attempt,
          delayMs,
          error: error.message
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

module.exports = { retryWithBackoff };
```

**2.2 Update Odds API Service**

```javascript
// In api-endpoints.js or new src/services/oddsService.js

const { retryWithBackoff } = require('../utils/exponentialBackoff');

async function fetchOdds(sport) {
  return retryWithBackoff(
    async () => {
      const response = await makeHTTPSRequest({
        path: `/sports/${sport}/odds`,
        headers: { 'Authorization': `Bearer ${ODDS_API_KEY}` }
      });
      return JSON.parse(response);
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    }
  );
}
```

---

## Task 3: Better Error Messages (2 hours)

### Problem
- Generic error messages confuse users
- No guidance on what to do next
- Don't distinguish recoverable vs permanent errors

### Solution

**3.1 Create Error Message Mapper**

```javascript
// src/utils/errorMessages.js

const errorMessages = {
  // Rate limiting
  '429': {
    title: '⏸️ Scanning Too Fast',
    message: 'You\'re at your limit. Try again in a moment or upgrade to Sharp tier.',
    action: 'WAIT'
  },

  // API errors
  'API_TIMEOUT': {
    title: '⏱️ Odds API Timeout',
    message: 'The odds service is slow. Trying again...',
    action: 'RETRY'
  },

  'API_UNAVAILABLE': {
    title: '🔌 Odds API Offline',
    message: 'The odds service is temporarily down. We\'re working on it!',
    action: 'WAIT'
  },

  'NO_ODDS_FOUND': {
    title: '🔍 No Gems Found',
    message: 'No profitable opportunities right now. Check back in 1 hour.',
    action: 'NONE'
  },

  // Claude errors
  'CLAUDE_TIMEOUT': {
    title: '🤖 AI Analysis Timeout',
    message: 'Claude is taking too long. Using simpler analysis...',
    action: 'DEGRADE'
  },

  'CLAUDE_OVERLOADED': {
    title: '🤖 Claude is Busy',
    message: 'AI service is overloaded. Try again in 30 seconds.',
    action: 'RETRY'
  },

  // User errors
  'INVALID_BANKROLL': {
    title: '💰 Invalid Amount',
    message: 'Bankroll must be between $50 and $1,000,000.',
    action: 'NONE'
  },

  'INVALID_TIMEZONE': {
    title: '🕐 Invalid Timezone',
    message: 'Please select a valid US timezone.',
    action: 'NONE'
  },

  // Default
  'UNKNOWN_ERROR': {
    title: '❌ Oops',
    message: 'Something went wrong. Our team has been notified.',
    action: 'SUPPORT'
  }
};

function getErrorMessage(errorCode, details = {}) {
  const err = errorMessages[errorCode] || errorMessages.UNKNOWN_ERROR;
  
  let fullMessage = `${err.title}\n\n${err.message}`;
  
  // Add helpful context
  if (details.retryIn) {
    fullMessage += `\n\n⏰ Retry in ${details.retryIn} seconds`;
  }
  
  if (err.action === 'SUPPORT') {
    fullMessage += `\n\n📧 Support: support@alexbet.ai`;
  }
  
  return fullMessage;
}

module.exports = { getErrorMessage, errorMessages };
```

**3.2 Integration in telegram-bot.js**

```javascript
const { getErrorMessage } = require('./src/utils/errorMessages');

bot.onText(/\/scan/, async (msg) => {
  try {
    const gems = await fetchRealGems(sport);
    
    if (!gems || gems.length === 0) {
      return bot.sendMessage(
        msg.chat.id,
        getErrorMessage('NO_ODDS_FOUND')
      );
    }
    
    // Process gems...
  } catch (error) {
    logger.error('Scan failed', { userId: msg.from.id, error: error.message });
    
    // Determine error type
    let errorCode = 'UNKNOWN_ERROR';
    if (error.message.includes('timeout')) errorCode = 'API_TIMEOUT';
    if (error.response?.status === 429) errorCode = '429';
    if (error.response?.status >= 500) errorCode = 'API_UNAVAILABLE';
    
    bot.sendMessage(msg.chat.id, getErrorMessage(errorCode));
  }
});
```

---

## Task 4: Circuit Breaker Pattern (1.5 hours)

### Problem
- Cascading failures (one API down, creates cascade)
- No protection against repeated failures
- System degrades gracefully

### Solution

**4.1 Create Circuit Breaker**

```javascript
// src/services/circuitBreaker.js

class CircuitBreaker {
  constructor(name, threshold = 5, timeoutMs = 60000) {
    this.name = name;
    this.threshold = threshold; // Failures before circuit opens
    this.timeoutMs = timeoutMs; // Duration circuit stays open
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = null;
  }

  async execute(fn) {
    // Circuit is open, fail fast
    if (this.state === 'OPEN') {
      const timeSinceOpen = Date.now() - this.lastFailureTime;
      
      if (timeSinceOpen > this.timeoutMs) {
        // Try half-open state
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker: HALF_OPEN', { name: this.name });
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN. Try again in ${Math.ceil((this.timeoutMs - timeSinceOpen) / 1000)}s`);
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failures
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info('Circuit breaker: CLOSED', { name: this.name });
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker: OPEN', { name: this.name, failures: this.failures });
      }
      
      throw error;
    }
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

module.exports = CircuitBreaker;
```

**4.2 Integration**

```javascript
const CircuitBreaker = require('./src/services/circuitBreaker');

const oddsAPIBreaker = new CircuitBreaker('odds-api', 5, 60000);
const claudeBreaker = new CircuitBreaker('claude', 3, 30000);

// Usage
async function fetchOdds(sport) {
  return oddsAPIBreaker.execute(async () => {
    return await retryWithBackoff(() => makeOddsRequest(sport));
  });
}

async function analyzeWithClaude(game) {
  return claudeBreaker.execute(async () => {
    return await retryWithBackoff(() => claudeOptimizer.analyzeGame(game));
  });
}
```

---

## Task 5: Timeout Improvements (0.5 hours)

### Problem
- 10-second timeout too long (user perceives hang)
- No timeout on Claude calls
- No timeout on database calls

### Solution

**5.1 Update All Timeouts**

```javascript
// Configuration
const TIMEOUTS = {
  ODDS_API: 5000,        // 5 seconds (quick API)
  CLAUDE: 8000,          // 8 seconds (slow AI)
  DATABASE: 3000,        // 3 seconds (local DB)
  WEBHOOK: 10000,        // 10 seconds (external hooks)
};

// Usage
async function fetchOdds(sport) {
  return Promise.race([
    makeOddsRequest(sport),
    timeout(TIMEOUTS.ODDS_API, 'Odds API timeout')
  ]);
}

function timeout(ms, message) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}
```

---

## Implementation Checklist

### Phase 1: Rate Limiting
- [ ] Create `src/services/rateLimiter.js`
- [ ] Integrate into `/scan` command
- [ ] Add user-friendly rate limit message
- [ ] Test: Verify 11th request is blocked

### Phase 2: Exponential Backoff
- [ ] Create `src/utils/exponentialBackoff.js`
- [ ] Update odds API calls
- [ ] Update Claude calls
- [ ] Test: Verify retries on timeout

### Phase 3: Better Error Messages
- [ ] Create `src/utils/errorMessages.js`
- [ ] Create error code mapping
- [ ] Update all error handlers
- [ ] Test: Verify user-friendly messages

### Phase 4: Circuit Breaker
- [ ] Create `src/services/circuitBreaker.js`
- [ ] Wrap odds API calls
- [ ] Wrap Claude calls
- [ ] Test: Verify circuit opens after 5 failures

### Phase 5: Timeout Improvements
- [ ] Create timeout constants
- [ ] Update all API calls
- [ ] Test: Verify timeouts fire correctly

---

## Testing Plan

**Unit Tests**
```javascript
// test/errorHandling.test.js

describe('RateLimiter', () => {
  test('blocks after max requests', () => { /* ... */ });
  test('resets after window expires', () => { /* ... */ });
});

describe('ExponentialBackoff', () => {
  test('retries on transient failure', () => { /* ... */ });
  test('fails immediately on 4xx', () => { /* ... */ });
});

describe('CircuitBreaker', () => {
  test('opens after threshold failures', () => { /* ... */ });
  test('half-opens after timeout', () => { /* ... */ });
});
```

**Integration Tests**
```javascript
// Simulate API failures
// Verify user gets proper message
// Verify bot continues functioning
```

---

## Success Criteria

- ✅ Rate limiting works (users see clear message)
- ✅ Exponential backoff retries transient failures
- ✅ Error messages are user-friendly & actionable
- ✅ Circuit breaker prevents cascading failures
- ✅ Timeouts are reasonable (5-8 seconds)
- ✅ All handlers have try-catch
- ✅ Unit tests pass (80%+ coverage)

---

## Files to Create/Update

**Create:**
- `src/services/rateLimiter.js` (50 lines)
- `src/utils/exponentialBackoff.js` (80 lines)
- `src/utils/errorMessages.js` (100 lines)
- `src/services/circuitBreaker.js` (80 lines)
- `test/errorHandling.test.js` (200 lines)

**Update:**
- `telegram-bot.js` (+80 lines integration)
- `api-endpoints.js` (add backoff)

**Total New Code:** ~500 lines
**Estimated Time:** 8 hours

---

## Commit Message

```
🛡️ Week 2: Enhanced Error Handling & Resilience

- Add rate limiting (10 req/min per user)
- Implement exponential backoff (3 retries, 2x multiplier)
- Create user-friendly error messages
- Add circuit breaker pattern (prevent cascades)
- Improve timeouts (5-8s per service)
- Add comprehensive error handling tests

Handles: rate limits, timeouts, API failures, degradation
```

---

**Week 2 Error Handling Plan**  
**Status:** Ready to implement  
**Next:** Begin Phase 1 (Rate Limiting)
