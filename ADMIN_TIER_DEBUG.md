# Bot Still Showing Free Tier - Debugging Guide

## Problem
Bot shows you as "free tier" with limited gems, despite you being ADMIN (ID: 8502906149)

## Root Causes to Check

### 1. **Railway hasn't redeployed new code yet**
- Last push: 922725d (3 minutes ago)
- Railway auto-deploys but takes 2-3 minutes
- Check: Do `/help` - if URL shows old `alexbetlite.netlify.app` (no hyphen), old code is running
- Fix: Wait 2-3 more minutes for Railway to pull latest code

### 2. **Bot is running locally on your machine instead of Railway**
- If you're running `node telegram-bot.js` locally
- It overrides the Railway deployment
- Check: Look at console output - does it show local logs?
- Fix: Stop local bot process, let Railway handle it

### 3. **ADMIN_IDS check is failing**
- ADMIN_IDS is set to [8502906149]
- isAdmin() function should return true
- Check: Look at logs when you run `/start`
  - Should say: `isAdmin: true`
  - If shows `isAdmin: false`, your Telegram ID is different!

### 4. **Telegram ID mismatch**
- Your actual Telegram ID might not be 8502906149
- Check: Look at /start logs
  - What does `userId` show?
  - Is it different from 8502906149?
- Fix: Update ADMIN_IDS to your actual Telegram ID

## How to Check Logs

### Railway Logs
```bash
# In Railway dashboard:
1. Go to your AlexBET Sharp Bot project
2. Click "Deployments" tab
3. Click latest deployment
4. View "Build & Deploy Logs"
5. Search for your userId and "isAdmin"
```

### What to Look For

```
✅ CORRECT:
"User initiated /start command": {
  "userId": 8502906149,
  "isAdmin": true    ← Should be TRUE
}

❌ WRONG:
"User initiated /start command": {
  "userId": 8502906149,
  "isAdmin": false   ← Should be FALSE if ID is wrong
}
```

## Testing Checklist

After Railway redeploys (wait 2-3 min):

1. **Send /start**
   - Check logs for `isAdmin: true`
   - Button should show "💰 Update Bankroll ($X)" with your current amount
   - Should NOT ask to pick bankroll

2. **Send /scan**
   - Check logs for `subscription: admin`
   - Should show unlimited gems (9999)
   - Should allow all markets (moneyline, spreads, totals)

3. **Expected Behavior for Admin**
   - Unlimited gems in every scan
   - All markets available (ML + Spreads + Totals)
   - Export CSV/JSON always enabled
   - No "upgrade" messages

4. **Expected Behavior for Free Tier**
   - Only 3 gems max
   - Only Moneyline market
   - Export disabled
   - Message: "Upgrade your subscription"

## Files Modified This Session

- `telegram-bot.js`
  - Line 379: Added `isAdmin` check to /start logging
  - Line 740: Added `isAdmin` check to /scan logging
  - Line 782: Changed debug → info for better visibility

## Quick Diagnostics

### Step 1: Verify Telegram ID
Send `/start` and note your userId from logs

### Step 2: Update ADMIN_IDS if needed
If userId ≠ 8502906149:
```javascript
// Line 36 in telegram-bot.js
const ADMIN_IDS = [YOUR_ACTUAL_ID];  // Use the ID from logs
```

### Step 3: Force Redeploy
```bash
git commit --allow-empty -m "Force redeploy"
git push origin main
# Wait 2-3 minutes for Railway
```

### Step 4: Test Again
- `/start` → Check isAdmin in logs
- `/scan` → Check subscription tier in logs
- `/help` → Check tracker URL is correct

## If Still Broken After These Steps

1. Check if Whop API is responding (in case payment integration is broken)
2. Check if Supabase connection is working
3. Verify bot token in Railway environment variables
4. Check if there are runtime errors in Railway logs

