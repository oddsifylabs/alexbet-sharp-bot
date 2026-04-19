# Integration Guide - Telegram Stars Payments
## For AlexBET Sharp Bot v2

This guide shows exactly how to integrate the new Telegram Stars payment system into `telegram-bot.js`.

---

## Step 1: Add Imports (Top of telegram-bot.js)

Add these lines after existing requires:

```javascript
// Add after other service imports:
const supabaseClient = require('./src/services/supabase-client');
const { registerPaymentHandlers } = require('./src/services/telegram-stars-payment');
```

---

## Step 2: Initialize Supabase on Startup

Add this after bot initialization (around line 13):

```javascript
// Initialize Supabase
(async () => {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await supabaseClient.initializeTables();
      console.log('✅ Supabase initialized');
    } catch (err) {
      console.warn('⚠️ Supabase initialization warning:', err.message);
    }
  } else {
    console.warn('⚠️ Supabase not configured - subscriptions will not persist');
  }
})();

// Initialize payment handlers
registerPaymentHandlers(bot);
```

---

## Step 3: Add /status Command

Add this new command (good place: after `/subscribe`):

```javascript
// /status command - Show current subscription status
bot.onText(/\/status/, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    const { data: user } = await supabaseClient.getUser(userId);
    
    if (!user) {
      return bot.sendMessage(chatId, '❌ User not found in database');
    }
    
    let statusMsg = '📊 **Your Subscription Status**\n\n';
    
    if (user.subscription_tier === 'free' || !user.subscription_tier) {
      statusMsg += '**Status:** 🆓 Free Tier\n';
      statusMsg += '**Features:** Limited to 3 gems per export\n\n';
      statusMsg += '_Ready to upgrade?_\n/subscribe';
    } else if (user.subscription_tier === 'lifetime') {
      statusMsg += '**Status:** 👑 Lifetime Premium\n';
      statusMsg += '**Expires:** Never\n';
      statusMsg += '**Features:** Unlimited access\n\n';
      statusMsg += '✅ Thank you for your support!';
    } else {
      const expiryDate = new Date(user.subscription_expiry);
      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      
      statusMsg += `**Status:** ✅ ${user.subscription_tier.toUpperCase()} Premium\n`;
      statusMsg += `**Expires:** ${expiryDate.toLocaleDateString()}\n`;
      statusMsg += `**Days Left:** ${daysLeft > 0 ? daysLeft : 'Expired'}\n`;
      statusMsg += '**Features:** Unlimited access\n\n';
      
      if (daysLeft <= 7) {
        statusMsg += '⏰ _Renewal coming soon!_\n/subscribe to extend';
      } else {
        statusMsg += 'Enjoy your premium access!';
      }
    }
    
    await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Error in /status command:', err);
    bot.sendMessage(msg.chat.id, '❌ Error checking status. Please try again.');
  }
});
```

---

## Step 4: Update /export Command

Find the existing `/export` command and update it to check subscription:

**Before:**
```javascript
bot.onText(/\/export/, async (msg) => {
  // ... existing code
  // exports all gems without limit
});
```

**After:**
```javascript
bot.onText(/\/export/, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Check subscription
    const isActive = await supabaseClient.isSubscriptionActive(userId);
    const tier = await supabaseClient.getSubscriptionTier(userId);
    
    // Ensure user exists
    await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
    
    // ... existing scan code ...
    
    // When you have gems array, apply limit:
    let gemsToExport = gems;
    const maxGems = isActive ? 9999 : 3;  // Free tier: 3 gems max
    
    if (gemsToExport.length > maxGems) {
      gemsToExport = gemsToExport.slice(0, maxGems);
      
      const limitMsg = isActive 
        ? `Exported all ${gemsToExport.length} gems` 
        : `Free tier limited to ${maxGems} gems. /subscribe for unlimited export`;
      
      bot.sendMessage(chatId, limitMsg);
    }
    
    // ... rest of export code using gemsToExport ...
    
  } catch (err) {
    logger.error('Error in /export:', err);
    bot.sendMessage(msg.chat.id, '❌ Export failed');
  }
});
```

---

## Step 5: Update /scan Command (Optional - Check Expiry)

If you want to block expired users from scanning, add this at the start:

```javascript
bot.onText(/\/scan/, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Ensure user exists in database
    await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
    
    // Optional: Could check subscription and show reminder
    // const isActive = await supabaseClient.isSubscriptionActive(userId);
    // if (!isActive) {
    //   bot.sendMessage(chatId, '📢 Your subscription expired. /subscribe to renew.');
    //   return;
    // }
    
    // ... rest of existing scan code ...
  } catch (err) {
    // ...
  }
});
```

---

## Step 6: Remove/Update Old /subscribe Command

**Find the existing:**
```javascript
bot.onText(/\\/subscribe/, (msg) => {
  // old Whop code
});
```

**Remove it entirely** - the new `/subscribe` is now in `telegram-stars-payment.js` and auto-registered.

---

## Step 7: Update /help Command (Optional)

Add subscription pricing info to your help text:

```javascript
bot.onText(/\/help/, (msg) => {
  const helpMsg = `
...existing commands...

**💳 Subscription Plans:**
/subscribe - View pricing and upgrade

📖 Pricing:
• Free: 3 gems per export
• Monthly ($9.99): Unlimited access
• Yearly ($99.99): Unlimited access
• Lifetime ($999): Permanent access
  `;
  
  bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});
```

---

## Step 8: Update /start Command (Optional)

Show subscription status on first start:

```javascript
bot.onText(/\/start/, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Ensure user exists
    await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
    
    // ... existing welcome message ...
    
    // Add subscription promo
    bot.sendMessage(chatId, 
      '💎 **Premium Available**\n\n' +
      'Upgrade for unlimited export and priority support.\n' +
      '/subscribe for details',
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error('Error in /start:', err);
  }
});
```

---

## Step 9: Setup Cron Job for Cleanup (Optional)

Add this at the end of telegram-bot.js (before bot.launch()):

```javascript
// Cleanup expired subscriptions every hour
const cron = require('node-cron');

cron.schedule('0 * * * *', async () => {
  try {
    const { deleted_count } = await supabaseClient.cleanupExpiredSubscriptions();
    if (deleted_count > 0) {
      logger.info(`🧹 Cleanup: Expired ${deleted_count} subscriptions`);
    }
  } catch (err) {
    logger.error('Cleanup job failed:', err);
  }
});
```

---

## Step 10: Verify Environment Variables

Make sure `.env` has:
```
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
ODDS_API_KEY=your_key
```

---

## Testing Checklist

- [ ] Bot starts without errors
- [ ] `/subscribe` shows 3 pricing buttons
- [ ] Clicking a tier opens Telegram Stars checkout
- [ ] After payment, user gets confirmation
- [ ] `/status` shows correct subscription
- [ ] `/export` limits free users to 3 gems
- [ ] `/export` allows unlimited for paid users
- [ ] Failed payment has graceful error handling
- [ ] Supabase logs payment in `payments` table
- [ ] Cron job cleans up expired subscriptions

---

## Rollback Plan

If something breaks:

1. **Comment out payment handlers:**
   ```javascript
   // registerPaymentHandlers(bot);  // Temporarily disable
   ```

2. **Keep /subscribe functional with Whop:**
   ```javascript
   bot.onText(/\/subscribe/, (msg) => {
     // Show Whop link as fallback
   });
   ```

3. **Disable subscription checks:**
   ```javascript
   // const isActive = await supabaseClient.isSubscriptionActive(userId);
   // if (!isActive) return; // Comment out
   ```

---

## Complete Integration Example

Here's a minimal full bot structure with payments:

```javascript
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const supabaseClient = require('./src/services/supabase-client');
const { registerPaymentHandlers } = require('./src/services/telegram-stars-payment');
const logger = require('./src/utils/logger');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize Supabase
(async () => {
  if (process.env.SUPABASE_URL) {
    await supabaseClient.initializeTables();
  }
})();

// Register payment handlers
registerPaymentHandlers(bot);

// Your commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! /subscribe for premium.');
});

bot.onText(/\/status/, async (msg) => {
  const tier = await supabaseClient.getSubscriptionTier(msg.from.id);
  bot.sendMessage(msg.chat.id, `Your tier: ${tier}`);
});

// Start bot
bot.launch();
console.log('🚀 Bot running');
```

---

## Next Steps

1. Copy the new service files to your repo
2. Run SQL schema from `docs/SUPABASE_SCHEMA.sql`
3. Apply integration steps above to `telegram-bot.js`
4. Set `.env` variables
5. Test locally with `/subscribe`
6. Deploy to production

Ready to implement! 🚀
