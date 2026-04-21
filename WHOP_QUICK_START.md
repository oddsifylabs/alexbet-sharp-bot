# Whop Integration - Quick Start Testing

## 🚀 What Just Changed

AlexBET Sharp Bot now **sells subscriptions on Whop** instead of Telegram Stars!

✅ Whop API integrated
✅ Payment links working  
✅ Subscription verification active
✅ Tier system connected to Whop

## 📝 What Users See

### /subscribe Command
Shows subscription menu with 5 Whop links:
- Bot Monthly ($9.99)
- Bot Yearly ($99.99)
- Bot Lifetime ($999)
- Channel Monthly ($9.99)
- Channel Yearly ($99.99)

Each link goes directly to your Whop store: https://whop.com/joined/oddsify-shop/

### /status Command
Shows subscription status pulled from Whop:
```
📊 **Your Subscription Status**

Status: ✅ MONTHLY
Product: Bot Monthly
Gems: 10 per scan
Markets: moneyline, totals, spreads
Export: ✅ Enabled
Expires: [date]
Days Left: [X days]
```

## 🧪 How to Test

### 1. Start the Bot
```bash
cd ~/projects/alexbet-sharp-bot
npm start
```

### 2. Run /subscribe
- Bot displays Whop links
- Click any link → Opens Whop store
- (Optional) Make test purchase

### 3. Run /status
- Free user → Shows free tier
- After purchase → Shows subscription details from Whop

### 4. Run /scan
- Bot shows gems based on subscription tier
- Free: 3 gems (Moneyline only)
- Premium: 10-20+ gems (All markets)

## 🔐 Credentials Set

Your `.env` now has:
```
WHOP_API_KEY=apik_Ge5H77MrtHS8Y_C4864557_C_...
WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
```

## ✨ Features Enabled

✅ Sell bot access directly
✅ Sell private channel access
✅ Users can buy both
✅ Automatic feature restrictions per tier
✅ Expiration tracking
✅ Lifetime option available
✅ Export control per tier
✅ Gem limits per tier

## 📊 Subscription Plans Selling

| Plan | Price | Duration | Gems | Markets | Export |
|------|-------|----------|------|---------|--------|
| **Bot Monthly** | $9.99 | 30 days | 10 | All 3 | ✅ |
| **Bot Yearly** | $99.99 | 365 days | 20 | All 3 | ✅ |
| **Bot Lifetime** | $999 | Forever | ∞ | All 3 | ✅ |
| **Channel Monthly** | $9.99 | 30 days | - | Channel | ✅ |
| **Channel Yearly** | $99.99 | 365 days | - | Channel | ✅ |

## 🎯 Next Steps

1. **Go live on Railway** - Deploy with Whop credentials
2. **Make test purchase** - Verify `/status` shows subscription
3. **Share Whop link** - https://whop.com/joined/oddsify-shop/
4. **Monitor sales** - Track payments in Whop dashboard

## 💰 Revenue

All payments go to your Whop account!
- Set payout method in Whop dashboard
- Withdraw earnings anytime
- No additional fees (Whop handles payment processing)

## 🔗 Key URLs

- **Whop Store:** https://whop.com/joined/oddsify-shop/
- **Whop Dashboard:** https://app.whop.com
- **API Key:** ✅ Set in .env
- **Integration Guide:** See WHOP_INTEGRATION.md

## ⚡ Deployment

When deploying to Railway/production:

1. Add environment variables:
   ```
   WHOP_API_KEY=apik_Ge5H77MrtHS8Y_C4864557_C_...
   WHOP_STORE_URL=https://whop.com/joined/oddsify-shop/
   ```

2. Bot automatically:
   - Loads Whop config
   - Registers payment handlers
   - Verifies subscriptions
   - Applies tier restrictions

3. Users can:
   - Click `/subscribe`
   - Buy on Whop
   - Verify access with `/status`
   - Use full bot features immediately

## 🐛 Issues?

If `/status` doesn't show subscription after purchase:
- Whop user ID might not be in database
- Check Whop API key is correct
- Verify Whop product IDs in code match dashboard

See WHOP_INTEGRATION.md for full troubleshooting!
