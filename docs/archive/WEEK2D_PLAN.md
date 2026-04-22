# Phase 6 Week 2D - RateLimiter Integration Plan

**Date:** April 19, 2026  
**Objective:** Integrate RateLimiter + Exponential Backoff into Telegram Bot  
**Estimated Duration:** 2-3 hours  
**Status:** IN PROGRESS  

---

## Overview

Integrate the existing `RateLimiter` service into the `/scan` command to:
1. Prevent abuse (limit to 10 requests/minute per user)
2. Implement exponential backoff for failed API calls
3. Provide user-friendly rate limit messages
4. Monitor and log rate limiting events

---

## Current State

### What We Have
✅ **RateLimiter Service** (`src/services/rateLimiter.js`)
- 148 lines, fully functional
- Methods: `isRateLimited()`, `reset()`, `getStats()`, `getMemoryStats()`
- Configurable: maxRequests, windowMs

✅ **Telegram Bot Structure** (`telegram-bot.js`)
- `/scan` command (lines 387-565)
- Error handling with context-aware messages
- Claude AI analysis integrated
- Export functionality working

### What's Missing
❌ RateLimiter not imported
❌ No rate limit check in `/scan` command
❌ No exponential backoff for API retries
❌ No user feedback about rate limits

---

## Implementation Steps

### Step 1: Import RateLimiter (5 minutes)

**Location:** Line 9 of `telegram-bot.js`

```javascript
// Add to imports
const RateLimiter = require('./src/services/rateLimiter');
```

### Step 2: Initialize RateLimiter (5 minutes)

**Location:** After Claude optimizer initialization (around line 60)

```javascript
// Initialize rate limiter (10 requests per 60 seconds)
const scanLimiter = new RateLimiter(10, 60000); // 10 req/min
const apiRetryLimiter = new RateLimiter(3, 5000); // 3 req/5sec for API retries
```

### Step 3: Add Rate Limit Check to /scan (15 minutes)

**Location:** Start of `/scan` command (after line 387)

```javascript
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // CHECK RATE LIMIT FIRST
  const rateLimitStatus = scanLimiter.isRateLimited(userId);
  if (rateLimitStatus.limited) {
    const waitTime = rateLimitStatus.secondsLeft;
    bot.sendMessage(
      chatId,
      `⏱️ Rate limited! Please wait ${waitTime}s before next scan.\n\nLimit: ${rateLimitStatus.maxRequests} scans per minute.`
    );
    logger.warn('User rate limited', { userId, waitTime });
    return; // Don't process scan
  }
  
  // Continue with normal scan...
```

### Step 4: Implement Exponential Backoff (30 minutes)

**Location:** Create new function before `/scan` command

```javascript
/**
 * Retry with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Max retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 1000)
 * @returns {Promise} Result of successful function call
 */
async function retryWithBackoff(fn, maxAttempts = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug('Attempt', { attempt, maxAttempts });
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        // Calculate exponential backoff: 1s, 2s, 4s
        const delayMs = initialDelay * Math.pow(2, attempt - 1);
        logger.warn('Request failed, retrying', {
          attempt,
          nextRetryIn: delayMs,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All attempts failed
  throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
}
```

### Step 5: Integrate Backoff into fetchRealGems (20 minutes)

**Current code (line 406):**
```javascript
const gems = await fetchRealGems(bankroll, timezone);
```

**Updated code:**
```javascript
let gems;
try {
  gems = await retryWithBackoff(
    () => fetchRealGems(bankroll, timezone),
    3,  // max attempts
    1000 // initial delay
  );
} catch (err) {
  logger.error('Gems fetch failed after retries', { userId, error: err.message });
  bot.sendMessage(chatId, `❌ Unable to fetch gems after ${3} attempts. API may be overloaded. Try again in a moment.`);
  return;
}
```

### Step 6: Add Failure Metrics & Logging (15 minutes)

**Location:** Add to error handler (around line 558)

```javascript
} catch (err) {
  const isTimeout = err.message.includes('timeout');
  const isRateLimit = err.message.includes('429') || err.message.includes('rate');
  const isNetworkError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
  
  logger.error('Scan execution failed', {
    userId,
    error: err.message,
    isTimeout,
    isRateLimit,
    isNetworkError,
    stack: err.stack
  });
  
  // User-friendly error messages
  let userMessage = '❌ Scan failed';
  if (isTimeout) {
    userMessage = '⏱️ Request timeout. API is slow. Try again in 30 seconds.';
  } else if (isRateLimit) {
    userMessage = '⚡ API rate limited. Trying again with backoff...';
  } else if (isNetworkError) {
    userMessage = '🔌 Network error. Check your connection.';
  }
  
  bot.sendMessage(chatId, userMessage);
}
```

### Step 7: Add /stats Command (Optional, 15 minutes)

```javascript
bot.onText(/\/stats/, (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  const limiterStats = scanLimiter.getStats(userId);
  const memoryStats = scanLimiter.getMemoryStats();
  
  const statsMsg = `📊 YOUR SCAN STATS
Requests used: ${limiterStats.count}/${limiterStats.maxRequests}
Remaining: ${limiterStats.remaining}
Resets in: ${limiterStats.secondsUntilReset}s

🗄️ SYSTEM STATS
Active users: ${memoryStats.activeUsers}
Total tracked: ${memoryStats.totalRecords}`;
  
  bot.sendMessage(chatId, statsMsg);
});
```

---

## Testing Checklist

### Unit Tests
- [ ] RateLimiter counts requests correctly
- [ ] RateLimiter resets after window expires
- [ ] Exponential backoff calculates delays correctly
- [ ] Retries stop after maxAttempts

### Integration Tests
- [ ] /scan works normally for first 10 requests
- [ ] 11th request returns rate limit message
- [ ] User can scan again after window resets
- [ ] Failed API calls retry with backoff
- [ ] Error messages are user-friendly

### Production Tests
- [ ] Railway deployment successful
- [ ] No errors in logs
- [ ] Rate limiting is effective
- [ ] Users see helpful messages

---

## Error Message Examples

### Rate Limited
```
⏱️ Rate limited! Please wait 45s before next scan.
Limit: 10 scans per minute.
```

### Timeout
```
⏱️ Request timeout. API is slow. Try again in 30 seconds.
```

### API Rate Limited
```
⚡ API rate limited. Trying again with backoff...
Attempt 1/3: wait 1s...
```

### Network Error
```
🔌 Network error. Check your connection.
```

### Success
```
✅ SCAN COMPLETE - 6 gems found
[gem cards...]
```

---

## Code Locations Reference

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| RateLimiter class | src/services/rateLimiter.js | 1-148 | ✅ Ready |
| Bot main | telegram-bot.js | 1-1198 | ✅ Ready |
| Imports section | telegram-bot.js | 1-10 | 📝 To modify |
| Claude init | telegram-bot.js | 45-65 | 📝 To modify |
| /scan command | telegram-bot.js | 387-565 | 📝 To modify |
| Error handler | telegram-bot.js | 558-580 | 📝 To modify |

---

## Configuration

### Rate Limiting
```javascript
const scanLimiter = new RateLimiter(10, 60000); // 10 req/min
```

### Exponential Backoff
```javascript
// Delay formula: initialDelay * 2^(attemptNumber-1)
// Attempt 1: 1000ms (1s)
// Attempt 2: 2000ms (2s)
// Attempt 3: 4000ms (4s)
// Total max wait: 7 seconds
```

### API Retry
```javascript
maxAttempts: 3
initialDelay: 1000ms
maxDelay: 4000ms
```

---

## Rollback Plan

If issues occur:
```bash
# View changes
git diff

# Rollback specific file
git checkout HEAD~1 -- telegram-bot.js

# Or revert entire commit
git revert <commit-hash>

# Push to Railway
git push origin main
```

---

## Success Criteria

✅ Rate limiter prevents abuse (10 req/min limit)
✅ Exponential backoff reduces failed requests
✅ Error messages are clear and user-friendly
✅ Logging shows all rate limit events
✅ Memory usage stays reasonable
✅ No breaking changes to existing features
✅ Deployed to Railway successfully

---

## Timeline

| Task | Time | Status |
|------|------|--------|
| Import & initialize | 10 min | 📋 TODO |
| Rate limit check | 15 min | 📋 TODO |
| Exponential backoff | 30 min | 📋 TODO |
| Error handling | 20 min | 📋 TODO |
| Testing | 30 min | 📋 TODO |
| Documentation | 15 min | 📋 TODO |
| Deployment | 10 min | 📋 TODO |
| **Total** | **2.5 hours** | **IN PROGRESS** |

---

## Next Steps

1. ✅ This plan created
2. 📋 Import RateLimiter
3. 📋 Initialize limiter instances
4. 📋 Add rate limit check to /scan
5. 📋 Create retryWithBackoff function
6. 📋 Integrate into fetchRealGems
7. 📋 Add error context detection
8. 📋 Test all scenarios
9. 📋 Deploy to Railway
10. 📋 Monitor logs for issues

---

**Ready to begin implementation!** 🚀
