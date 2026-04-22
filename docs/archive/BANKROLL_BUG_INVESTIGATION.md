# Bankroll Bug Investigation

## User Report
> "If I hit scan command it sometimes brings up bankroll defaults at 5000"

## What This Means
Need to clarify:
1. **Where** does the 5000 appear? (In which message/field?)
2. **When** does it appear? (Always? Sometimes? First scan? After restart?)
3. **What** should it show instead? (100? User-selected amount?)

## Current Code Behavior

### Bankroll Defaults (Line 754)
```javascript
const bankroll = userBankrolls[userId] || 100;
```
- Default if not set: **$100**
- No code sets it to 5000 (only found at line 345 as timeout, not a value)

### When Bankroll Gets Set
1. **On /start** - User chooses from buttons ($50, $100, $250, $500, $1000, custom)
2. **On /bankroll command** - User enters custom amount
3. **From database** - Loaded on /start if saved previously

### Possible Sources of 5000
1. User selected $1000 and it's being doubled (unlikely)
2. Some calculation is multiplying something by 5
3. The 5000 is from a different variable being confused with bankroll
4. Edge case in subscription or gem data

## What to Check

### If 5000 appears in scan results:
- Is it appearing in the gem edge calculations?
- Is it in the Kelly stake calculations?
- Is it displayed in message text?

### If 5000 is the bankroll being used:
- Did user set it to that?
- Is database overwriting it?
- Is there a calculation that produces 5000?

## Next Steps

**Need from user (Jesse):**
1. Screenshot showing exactly where "5000" appears
2. What command you ran before it appeared
3. Whether you set bankroll to 5000 at any point
4. Whether it happens every time or intermittently

**Once we know specifics, can investigate:**
- Check bankroll loading logic
- Verify database queries
- Trace the 5000 value origin
- Fix the root cause

