# AlexBET Sharp Bot - Subscription Tier System

**Date**: April 19, 2026  
**Status**: ✅ IMPLEMENTED & LIVE  
**Commit**: 7472b1b  

---

## Problem Fixed

**Issue**: Bot was showing ALL gem types (Moneylines, Spreads, Totals) to all users, regardless of subscription tier.

**Root Cause**: 
- Gems were fetched from API (all market types)
- No filtering by subscription tier
- No limit enforcement
- Export was available to all users

**Solution**: Implemented tier-based filtering at gem generation stage

---

## Tier Structure

### Free Tier
- **Max Gems**: 3 per scan
- **Allowed Markets**: 
  - Moneyline (ML) only
  - ✅ Can see confidence scores (35-95%)
  - ✅ Can see edge %, EV %, odds, Kelly stakes
- **Export**: ❌ Disabled (premium feature)
- **Access**: Immediate (no payment)

### Monthly Tier ($9.99 USD)
- **Max Gems**: 10 per scan
- **Allowed Markets**:
  - Moneyline (ML)
  - Totals
  - ❌ Spreads not available
- **Export**: ✅ Enabled (CSV, JSON, TXT)
- **Access**: Telegram Stars payment

### Yearly Tier ($99.99 USD)
- **Max Gems**: 20 per scan
- **Allowed Markets**:
  - Moneyline (ML)
  - Spreads
  - Totals
  - ✅ All market types
- **Export**: ✅ Enabled (all formats)
- **Access**: Telegram Stars payment

### Lifetime Tier ($999 USD)
- **Max Gems**: Unlimited
- **Allowed Markets**:
  - Moneyline (ML)
  - Spreads
  - Totals
  - ✅ All future features
- **Export**: ✅ Enabled (all formats)
- **Features**: All premium features
- **Access**: Telegram Stars payment

---

## Implementation Details

### 1. Subscription Lookup (Lines 478-500)

```javascript
// Check user subscription tier from Supabase
let subscription = { tier: 'free', maxGems: 3, allowedMarkets: ['ML'] };
try {
  const subStatus = await supabaseClient.getUserSubscription(userId);
  if (subStatus && subStatus.tier && subStatus.tier !== 'free') {
    const tierConfig = {
      'monthly': { maxGems: 10, allowedMarkets: ['ML', 'Total'] },
      'yearly': { maxGems: 20, allowedMarkets: ['ML', 'Spread', 'Total'] },
      'lifetime': { maxGems: 9999, allowedMarkets: ['ML', 'Spread', 'Total'] }
    };
    subscription = {
      tier: subStatus.tier,
      maxGems: tierConfig[subStatus.tier]?.maxGems || 10,
      allowedMarkets: tierConfig[subStatus.tier]?.allowedMarkets || ['ML', 'Total']
    };
  }
} catch (err) {
  logger.warn('Failed to fetch subscription status, using free tier', { userId, error: err.message });
  subscription = { tier: 'free', maxGems: 3, allowedMarkets: ['ML'] };
}
```

**Key Points**:
- Defaults to free tier if subscription lookup fails
- Maps subscription tier to max gems and allowed markets
- Graceful degradation (doesn't crash if Supabase down)

### 2. Gem Market Filtering (Lines 538-562)

```javascript
// Filter gems by subscription tier's allowed markets
const filteredGems = gems.filter(gem => subscription.allowedMarkets.includes(gem.market));
const filteredCount = gems.length - filteredGems.length;

if (filteredCount > 0) {
  logger.info('Gems filtered by subscription tier', { 
    userId, 
    tier: subscription.tier, 
    allowedMarkets: subscription.allowedMarkets,
    originalCount: gems.length, 
    filteredCount,
    remainingCount: filteredGems.length 
  });
}

if (filteredGems.length === 0) {
  bot.sendMessage(chatId, `⏳ No ${subscription.allowedMarkets.join('/')} opportunities right now.`);
  return;
}
```

**Key Points**:
- Filters gems AFTER fetching from API
- Logs filter metrics for debugging
- Shows user-friendly message if no gems available after filtering
- Logs why gems were filtered

### 3. Gem Limit Enforcement (Line 615)

```javascript
.slice(0, subscription.maxGems); // Apply tier-based limit
```

**Key Points**:
- Changes from hardcoded `10` to `subscription.maxGems`
- Free: 3 gems
- Monthly: 10 gems
- Yearly: 20 gems
- Lifetime: 9999 (effectively unlimited)

### 4. Export Blocking for Free Tier (Lines 996-1010)

```javascript
bot.onText(/\/export/, async (msg) => {
  // ✅ FIX: Check subscription - Export disabled for free tier
  const subscription = await supabaseClient.getUserSubscription(userId);
  if (!subscription || subscription.tier === 'free') {
    bot.sendMessage(chatId, `❌ Export feature is premium only.\n\n/subscribe to unlock:\n  • Unlimited gems\n  • CSV/JSON/PDF export\n  • Full market access (Spreads, Totals)\n  • Advanced statistics`);
    return;
  }
  // ... continue with export
})
```

**Key Points**:
- Early return if free tier
- Clear, actionable message showing benefits
- Encourages upgrade path
- Also applies to `/export_csv`, `/export_json`, `/export_txt`

---

## Market Type Constants

The bot recognizes three market types from the Odds API:

| API Key | Display Name | Free | Monthly | Yearly | Lifetime |
|---------|--------------|------|---------|--------|----------|
| `h2h` | ML (Moneyline) | ✅ | ✅ | ✅ | ✅ |
| `spreads` | Spread | ❌ | ❌ | ✅ | ✅ |
| `totals` | Total | ❌ | ✅ | ✅ | ✅ |

**Code Location**: Line 239
```javascript
const marketName = market === 'h2h' ? 'ML' : market === 'spreads' ? 'Spread' : 'Total';
```

---

## User Experience Flow

### Free Tier User

1. **Run `/scan`**
   ```
   ✅ Subscription checked → free tier
   ✅ Gems fetched from API (example: 5 ML, 3 Spread, 2 Total = 10 total)
   ✅ Filtered by allowed markets → 5 ML only
   ✅ Limited to 3 gems → shows top 3 ML by edge
   ✅ Gems displayed with confidence scores
   ```

2. **Try `/export`**
   ```
   ❌ Blocked
   Message: "Export feature is premium only. /subscribe to unlock..."
   ```

3. **Run `/subscribe`**
   ```
   Monthly plan ($9.99)
     ↓ User pays with Telegram Stars
     ↓ Subscription recorded in Supabase
     ↓ Next /scan shows 10 gems (ML + Totals)
   ```

### Monthly Tier User

1. **Run `/scan`**
   ```
   ✅ Subscription checked → monthly tier
   ✅ Gems fetched from API
   ✅ Filtered: ML + Total only (no spreads)
   ✅ Limited to 10 gems
   ✅ Gems displayed
   ```

2. **Run `/export`**
   ```
   ✅ Allowed
   Options: /export_csv, /export_json, /export_txt
   ```

### Yearly Tier User

1. **Run `/scan`**
   ```
   ✅ Subscription checked → yearly tier
   ✅ Gems fetched from API
   ✅ ALL markets: ML, Spread, Total
   ✅ Limited to 20 gems
   ✅ Gems displayed
   ```

---

## Logging & Debugging

The system logs tier-based decisions for troubleshooting:

```
logger.debug('Scan parameters loaded', { 
  userId, 
  bankroll, 
  timezone, 
  subscription: 'monthly',
  maxGems: 10,
  allowedMarkets: ['ML', 'Total']
});

logger.info('Gems filtered by subscription tier', { 
  userId, 
  tier: 'monthly', 
  allowedMarkets: ['ML', 'Total'],
  originalCount: 15, 
  filteredCount: 8,        // spreads were removed
  remainingCount: 7
});
```

**To debug**:
1. Check user subscription in Supabase
2. Look for "Gems filtered" log to see what was removed
3. Verify tier config in bot code matches Supabase records

---

## Edge Cases Handled

### Case 1: Supabase Down
- Falls back to free tier
- User still gets scan results (limited to 3 ML gems)
- No crash

### Case 2: User Pays, Subscription Not Yet Updated
- Scan still uses old free tier limits
- Within 5 minutes: Supabase updated with new tier
- Next scan uses new tier

### Case 3: API Returns Mixed Markets
- Example: 5 ML + 3 Spread + 2 Total gems found
- Free user: sees 3 ML only (filters remove Spread & Total)
- Monthly user: sees 7 gems (ML + Total, removes Spread)
- Yearly user: sees all 10 gems

### Case 4: No Gems Match User's Markets
- Example: API returns 5 spreads, 2 totals, 0 ML
- Free user: sees message "No ML opportunities right now"
- Encourages upgrade message

---

## Testing Checklist

- [ ] Free tier user runs `/scan` → sees only Moneylines, max 3
- [ ] Free tier user runs `/export` → blocked with upgrade message
- [ ] Monthly user runs `/scan` → sees ML + Totals, max 10, no Spreads
- [ ] Monthly user runs `/export` → works, exports 10 gems
- [ ] Yearly user runs `/scan` → sees all types, max 20
- [ ] Yearly user runs `/export` → works, exports 20 gems
- [ ] User subscribes → next scan uses new tier limits
- [ ] Supabase down → falls back to free tier, no crash
- [ ] Confidence formula still works for all tiers
- [ ] Summary shows correct breakdown (# ML, # Spreads, # Totals)

---

## Summary

✅ **Tier system is fully implemented**
✅ **Gems filtered by subscription type**
✅ **Max gem limits enforced**
✅ **Export disabled for free tier**
✅ **Graceful degradation if Supabase down**
✅ **Logging for debugging**

The bot now properly restricts features based on subscription tier while maintaining the confidence calculation and gem quality across all tiers.
