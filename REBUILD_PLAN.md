# AlexBET Sharp Bot - Systematic Module Rebuild

## Problem
Bot is intermittently failing. Quick patches aren't working. Need systematic rebuild.

## Solution: Module-by-Module Rebuild

### Phase 1: Core Bot Setup (TEST EACH STEP)
- [ ] 1.1: Create clean bot initialization
- [ ] 1.2: Test /start command
- [ ] 1.3: Test bot responds to messages

### Phase 2: Authentication & Admin System
- [ ] 2.1: Implement isAdmin() check
- [ ] 2.2: Implement getSubscriptionDetails() properly
- [ ] 2.3: Test subscription check returns correct object

### Phase 3: Scan Command
- [ ] 3.1: Rebuild /scan from scratch
- [ ] 3.2: Test gem generation
- [ ] 3.3: Test gem filtering by subscription tier
- [ ] 3.4: Test admin gets unlimited gems

### Phase 4: Export Commands
- [ ] 4.1: Rebuild /export command
- [ ] 4.2: Test /export_csv
- [ ] 4.3: Test /export_txt
- [ ] 4.4: Test /export_json
- [ ] 4.5: Test admin can export all gems

### Phase 5: UI/UX
- [ ] 5.1: Professional welcome message
- [ ] 5.2: Button-based navigation
- [ ] 5.3: Settings/Timezone
- [ ] 5.4: Bankroll management

### Phase 6: Payment Integration
- [ ] 6.1: /subscribe command
- [ ] 6.2: Whop payment links
- [ ] 6.3: Subscription verification

### Phase 7: Deployment & Testing
- [ ] 7.1: Syntax validation
- [ ] 7.2: Git commit
- [ ] 7.3: Railway deployment
- [ ] 7.4: End-to-end testing

---

## Module Testing Checklist

For each module, verify:
1. ✅ Syntax check: `node -c file.js`
2. ✅ Imports work: `require()` doesn't crash
3. ✅ Function signatures match expectations
4. ✅ Return values are correct shape
5. ✅ Error handling doesn't crash bot

---

## Current Code Quality Issues

1. **Fragmented logic** - Subscription checks scattered everywhere
2. **Inconsistent naming** - `.gems` vs `.maxGems` confusion
3. **Missing error handling** - Failures cascade
4. **Untested paths** - Admin logic added but not validated
5. **No logging** - Can't diagnose failures

---

## Rebuild Strategy

Start with PHASE 1 and test completely before moving to PHASE 2.
Each phase must pass all tests before proceeding.

