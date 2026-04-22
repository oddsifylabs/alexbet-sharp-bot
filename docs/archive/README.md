# AlexBET Sharp Bot

Professional sports betting Telegram bot. Find profitable edges in real-time.

## Features

- 📊 Gem Scanner — Find edges across 5 sportsbooks
- 💰 Kelly Sizing — Personalized bet amounts
- 📈 Analytics — Win rate, P&L tracking
- 🔔 Live Alerts — Bet notifications
- 🎯 PRISM Workflow — Blind price entry

## Deploy to Railway

1. Go to railway.app
2. Create new project
3. Connect this GitHub repo
4. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` — From @BotFather
   - `VITE_SUPABASE_URL` — Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase key
5. Deploy

## Commands

- `/start` — Welcome menu
- `/scan` — Find gems
- `/stats` — View analytics
- `/pending` — Live bets
- `/subscribe` — Upgrade plan
- `/help` — Command list

## Pricing

- **Free:** 5 gems/day
- **Sharp:** $49/month (unlimited gems)
- **Elite:** $99/month (+ Ask Alex)

## Development

```bash
npm install
TELEGRAM_BOT_TOKEN=xxx npm start
```

## Support

support@alexbet.io
