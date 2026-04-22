# Whop Payment Integration - AlexBET Sharp Bot

## ✅ Setup Complete

Your AlexBET Sharp Bot is now integrated with Whop for selling:
- **Bot Subscriptions** - Direct access to the bot with all features
- **Channel Subscriptions** - Private Telegram channel with alerts & analysis

## 📋 Configuration

```
WHOP_API_KEY=apik_Ge5H77MrtHS8Y_C4864557_C_...
WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
```

Both are added to your `.env` file.

## 🛍️ What's Selling on Whop

### Bot Subscriptions
- **Bot Monthly** - $9.99 (30 days) - 10 gems per scan
- **Bot Yearly** - $99.99 (365 days) - 20 gems per scan  
- **Bot Lifetime** - $999 (Forever) - Unlimited gems

### Channel Subscriptions
- **Channel Monthly** - $9.99 (30 days)
- **Channel Yearly** - $99.99 (365 days)

Users can buy BOTH!

## 🤖 Bot Commands

Users will see these payment-related commands:

```
/subscribe   - Show subscription plans (links to Whop)
/status      - Check subscription status
/scan        - Get gem recommendations (requires active subscription)
/export      - Export data (free: disabled, paid: enabled)
```

## 🔗 How It Works

1. **User runs `/subscribe`** → Bot shows payment menu with Whop links
2. **User clicks a plan** → Opens Whop store (`https://whop.com/joined/oddsify-shop/`)
3. **User completes payment** → Whop creates membership record
4. **User runs `/status`** → Bot verifies subscription with Whop API
5. **Access granted** → Bot shows full features based on tier

## ⚙️ Subscription Verification

The `whop-payment.js` service:
- ✅ Fetches user subscription from Whop API
- ✅ Determines tier (free/monthly/yearly/lifetime)
- ✅ Calculates gem limits per tier
- ✅ Checks market type restrictions
- ✅ Tracks expiration dates

## 🧪 Testing the Integration

### Step 1: Add to Your .env
```bash
WHOP_API_KEY=apik_Ge5H77MrtHS8Y_C4864557_C_...
WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
```

### Step 2: Start the bot
```bash
npm start
# or
node telegram-bot.js
```

### Step 3: Test commands
```
/subscribe    → Should show Whop links
/status       → Should show free tier for unsubscribed user
/scan         → Should work (limited to 3 gems for free users)
```

### Step 4: Make a test purchase on Whop
1. Go to https://whop.com/joined/oddsify-shop/
2. Complete a purchase
3. Get Whop User ID (check your Whop dashboard)
4. Add to bot database or verify via `/status`

## 📊 Whop API Details

### Endpoints Used

**Verify Membership:**
```
GET /v1/memberships?user_id={whop_user_id}
```

Response includes:
- `product_id` - Which plan (bot_monthly, channel_yearly, etc.)
- `status` - active/inactive/cancelled
- `created_at` - When subscription started
- `expires_at` - When subscription expires (null for lifetime)

### Required Whop Setup

1. **Create Products in Whop Dashboard:**
   - Bot Monthly ($9.99)
   - Bot Yearly ($99.99)
   - Bot Lifetime ($999)
   - Channel Monthly ($9.99)
   - Channel Yearly ($99.99)

2. **Get Product IDs** and update `WHOP_PRODUCTS` in `whop-payment.js`

3. **Get Whop User IDs** from customers and store in database

## 🔄 Integration Points

### Tier System (Already Built In)

The bot automatically assigns features based on subscription:

**Free Tier:**
- 3 gems per scan
- Moneyline only
- No export

**Monthly:**
- 10 gems per scan
- Moneyline + Totals + Spreads
- Export enabled

**Yearly:**
- 20 gems per scan
- All markets
- Export enabled

**Lifetime:**
- Unlimited gems
- All markets
- All features

## 📱 User Flow

```
User starts bot
    ↓
/start - User sets bankroll & timezone
    ↓
/scan - Bot checks subscription with Whop
    ↓
Free user? → Show 3 gems (Moneyline only)
Premium user? → Show full gems + markets
    ↓
/subscribe - User clicks Whop link
    ↓
Completes payment on Whop
    ↓
Next /scan - Bot verifies updated subscription
    ↓
Full access granted!
```

## 🚀 Deployment

Add these to Railway/Docker environment variables:

```
WHOP_API_KEY=apik_Ge5H77MrtHS8Y_C4864557_C_...
WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
```

The bot will automatically:
- Load Whop credentials
- Register payment handlers
- Verify subscriptions on `/status` and `/scan`
- Restrict features per tier

## 💡 Next Steps

1. **Configure Whop Products** - Set up the 5 plans with correct product IDs
2. **Update WHOP_PRODUCTS** in `whop-payment.js` with real Whop product IDs
3. **Link to Supabase** - Store Whop user IDs when users subscribe
4. **Test with Real Purchase** - Verify `/status` shows correct tier
5. **Set Up Webhooks** (Optional) - Auto-sync when subscriptions change

## 🐛 Troubleshooting

### `/subscribe` shows no button
- Check `WHOP_STORE_URL` is correct in `.env`
- Verify Whop store URL is accessible

### `/status` shows Free even after purchase
- Whop user ID not stored in database
- Add webhook to capture new subscriptions
- Or manually add `whop_user_id` to supabase

### API errors
- Check `WHOP_API_KEY` is valid
- Verify product IDs match Whop dashboard
- Check Whop API status

## 📚 References

- **Whop API Docs:** https://docs.whop.com
- **Bot File:** `telegram-bot.js`
- **Payment Service:** `src/services/whop-payment.js`
- **Store:** https://whop.com/joined/oddsify-shop/
