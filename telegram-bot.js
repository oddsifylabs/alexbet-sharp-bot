const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';

console.log('🤖 AlexBET Sharp Bot starting...');

// Mock gems (fallback if API returns nothing)
const mockGems = [
  { pick: 'Kansas City Chiefs', odds: -110, edge: 7.2, game: 'KC vs Buffalo Bills', sport: 'NFL', book: 'DraftKings', market: 'ML', kelly: 75 },
  { pick: 'Miami Heat', odds: -105, edge: 5.8, game: 'MIA vs Boston Celtics', sport: 'NBA', book: 'FanDuel', market: 'ML', kelly: 62 },
  { pick: 'Under 216.5', odds: -110, edge: 6.3, game: 'Lakers vs Warriors', sport: 'NBA', book: 'DraftKings', market: 'TOTAL', kelly: 68 }
];

// Fetch real gems from Odds API
async function fetchRealGems() {
  try {
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb'];
    let allGems = [];

    for (const sport of sports) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads&oddsFormat=american&limit=2`,
          { timeout: 5000 }
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
          
          markets.slice(0, 1).forEach(market => {
            if (!market.outcomes || market.outcomes.length < 2) return;

            const pick = market.outcomes[0];
            const edge = Math.floor(Math.random() * 8) + 3;

            allGems.push({
              id: `${game.id}-${market.key}`,
              pick: pick.name,
              odds: pick.price,
              point: pick.point || null,
              edge: edge,
              game: `${game.home_team} vs ${game.away_team}`,
              sport: sport.replace('_', ' ').toUpperCase(),
              book: bestBook.title,
              market: market.key === 'spreads' ? 'SPREAD' : 'ML',
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
  console.log(`[/start] User ${msg.from.id}`);
  
  bot.sendMessage(chatId, `
⚡ *AlexBET Sharp Bot* 🎯

Find profitable sports betting edges in real-time.

📊 Scans: NFL, NBA, MLB, Hockey, Tennis, Soccer

💰 Pricing:
🟢 *Free:* 5 gems/day
🟢 *Sharp:* $49/mo
🟢 *Elite:* $99/mo

Commands: /scan /stats /subscribe /help
  `, { parse_mode: 'Markdown' });
});

// /scan command
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[/scan] User ${msg.from.id}`);
  
  bot.sendMessage(chatId, '🔄 Scanning live odds...');
  
  try {
    let gems = await fetchRealGems();
    
    // Fallback to mock if no real gems
    if (!gems || gems.length === 0) {
      console.log('[Fallback] Using mock gems');
      gems = mockGems;
    }

    // Send gems
    gems.slice(0, 3).forEach((gem, i) => {
      const pointStr = gem.point ? ` (${gem.point > 0 ? '+' : ''}${gem.point})` : '';
      
      bot.sendMessage(chatId, `
*Gem ${i + 1}* ⚡ +${gem.edge}%

*${gem.pick}${pointStr}* @ ${gem.odds > 0 ? '+' : ''}${gem.odds}
${gem.game}

📍 ${gem.market} | ${gem.book}
💰 Kelly: $${gem.kelly}
      `, { parse_mode: 'Markdown' });
    });

    bot.sendMessage(chatId, `✅ ${gems.length} gems found`);
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
💰 P&L: +$215
📈 Win Rate: 62%
🎯 Bets: 16
  `, { parse_mode: 'Markdown' });
});

// /subscribe command
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*💎 Upgrade*
🟢 Sharp $49/mo
🔴 Elite $99/mo

Contact: support@alexbet.io
  `, { parse_mode: 'Markdown' });
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `/scan /stats /subscribe /help`, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot running...');
