# Quick Testing Guide - AlexBET Sharp Bot

## Pre-Test Checklist
- [ ] Bot is running on Railway
- [ ] You have Telegram open
- [ ] You know your user ID: 8502906149
- [ ] Have 5 minutes for testing

## Test Commands (Copy-Paste)

### Test 1: Bot Responds
Send to bot:
```
/start
```
Expected: Welcome message with "ADMIN MODE" badge

### Test 2: Admin Gets Unlimited Gems  
Send to bot:
```
/scan
```
Expected: Message showing gems (should be unlimited for admin)

### Test 3: Can Export Without Paywall
Send to bot:
```
/export_csv
```
Expected: CSV file download (not "premium only" message)

### Test 4: Status Shows Admin
Send to bot:
```
/status
```
Expected: "Admin Access" message

### Test 5: Help Shows All Commands
Send to bot:
```
/help
```
Expected: List of all commands

---

## If Something Fails

### What to Report:
1. Which command failed (e.g., `/scan`)
2. Exact error message shown
3. What you expected instead
4. Example: "/scan returned 'undefined' error"

### Where to Check Logs:
1. Go to Railway.app
2. Find AlexBET Sharp Bot project
3. View Logs tab
4. Look for red errors

---

## Quick Fix Reference

**If /scan fails:**
- Check if Claude optimizer is enabled/disabled
- Verify Odds API is working
- Check Supabase connection

**If /export fails:**
- Check if you ran /scan first (need gems to export)
- Verify file permissions in exports/ folder
- Check admin status with /status

**If /start fails:**
- Verify bot token in Railway environment
- Check Telegram API is accessible
- Restart bot polling

---

## Success Indicators ✅

You'll know it's working when:
1. ✅ /start shows admin badge
2. ✅ /scan returns gems (fast, within 30 seconds)
3. ✅ /export_csv downloads a CSV file
4. ✅ /status shows "Admin Access"  
5. ✅ All commands respond (no timeouts)
6. ✅ Buttons in /start are clickable
7. ✅ No "undefined" or "Error" messages

---

## Troubleshooting Flowchart

```
Bot not responding?
├─ Check Railway is running
└─ Check internet connection

/scan slow (>30 seconds)?
├─ Odds API might be slow
├─ Claude optimizer might be running
└─ Try again in a moment

/export fails?
├─ Run /scan first
├─ Check file system permissions
└─ Check gem data saved properly

Permission denied errors?
├─ Make sure you're admin (8502906149)
├─ Check ADMIN_IDS in code
└─ Verify admin check is working
```

---

## Getting Help

If tests fail:
1. **Take a screenshot** of the error
2. **Copy exact error message**
3. **Tell me which command** failed
4. **I'll check the code** and fix it

Example:
> /scan returned: "ReferenceError: gems is not defined"

---

