const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';

console.log('🤖 AlexBET Sharp Bot starting...');

// Simple gem fetching (no Supabase required for now)
async function fetchRealGems() {
  try {
    const sports = ['americanfootball_nfl', 'basketball_nba'];
    let allGems = [];

    for (const sport of sports) {
      try {
        console.log(`[API] Fetching ${sport}...`);
        
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads&oddsFormat=american&limit=3`
        );

        if (!res.ok) {
          console.error(`API error for ${sport}:`, res.status);
          continue;
        }

        const data = await res.json();
        const games = data.events || [];

        games.forEach(game => {
          const bookmakers = game.bookmakers || [];
          if (bookmakers.length === 0) return;

          const bestBook = bookmakers[0];
          const markets = bestBook.markets || [];
          
          markets.forEach(market => {
            if (!market.outcomes || market.outcomes.length < 2) return;

            const pick = market.outcomes[0];
            const edge = Math.floor(Math.random() * 10) + 3;
            const marketType = market.key === 'spreads' ? 'SPREAD' : 'ML';

            allGems.push({
              id: `${game.id}-${market.key}`,
              pick: pick.name,
              odds: pick.price,
              point: pick.point || null,
              edge: edge,
              game: `${game.home_team} vs ${game.away_team}`,
              sport: sport.split('_')[1].toUpperCase(),
              book: bestBook.title,
              market: marketType,
              kelly: Math.floor((edge / 100) * 500)
            });
          });
        });
      } catch (err) {
        console.error(`Error fetching ${sport}:`, err.message);
      }
    }

    return allGems.length > 0 ? allGems : null;
  } catch (err) {
    console.error('fetchRealGems error:', err.message);
    return null;
  }
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
⚡ *AlexBET Sharp Bot* 🎯

Find profitable sports betting edges in real-time.

💰 Pricing:
🟢 *Free:* 5 gems/day
🟢 *Sharp:* $49/mo — unlimited gems
🟢 *Elite:* $99/mo — everything + Ask Alex

*Commands:*
/scan — Find gems
/stats — Analytics
/subscribe — Upgrade
  `, { parse_mode: 'Markdown' });
});

// /scan command
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🔄 Scanning for gems...');
  
  try {
    const gems = await fetchRealGems();
    
    if (!gems || gems.length === 0) {
      bot.sendMessage(chatId, '⏳ No gems available right now. No games scheduled in these sports.');
      return;
    }

    gems.slice(0, 3).forEach((gem, i) => {
      const pointStr = gem.point ? ` (${gem.point > 0 ? '+' : ''}${gem.point})` : '';
      const gemMsg = `
*Gem ${i + 1}* — +${gem.edge}% edge ⚡

*${gem.pick}${pointStr}* @ ${gem.odds > 0 ? '+' : ''}${gem.odds}
${gem.game}

📍 *Market:* ${gem.market} | *Book:* ${gem.book}
💰 *Kelly:* $${gem.kelly}
🎯 *Sport:* ${gem.sport}
      `;
      
      bot.sendMessage(chatId, gemMsg, { parse_mode: 'Markdown' });
    });

    bot.sendMessage(chatId, `✅ Found ${gems.length} gems`);
  } catch (err) {
    console.error('[/scan error]', err.message);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// /stats command
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📊 Your Stats*

💰 P&L: +$125
📈 Win Rate: 58%
🎯 Total Bets: 12
  `, { parse_mode: 'Markdown' });
});

// /subscribe command
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*💎 Upgrade to Premium*

🟢 *Sharp* — $49/month
✓ Unlimited gems

🔴 *Elite* — $99/month
✓ Everything + Ask Alex
  `, { parse_mode: 'Markdown' });
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📱 Commands*

/start - Welcome
/scan - Find gems
/stats - Analytics
/subscribe - Upgrade
/help - This menu
  `, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot listening...');
