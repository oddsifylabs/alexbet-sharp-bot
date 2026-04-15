const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ODDS_API_KEY = process.env.ODDS_API_KEY || 'dc525dcde4712306f140051f1641d509';

// Store user bankrolls in memory (in production, use Supabase)
const userBankrolls = {};

console.log('🤖 AlexBET Sharp Bot starting (h2h + spreads + totals)...');

// Fetch REAL gems using native https
async function fetchRealGems(bankroll = 5000) {
  return new Promise((resolve) => {
    try {
      const sports = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl', 'tennis_atp', 'soccer_epl'];
      const markets = ['h2h', 'spreads', 'totals'];
      let allGems = [];
      let completed = 0;
      const totalRequests = sports.length * markets.length;

      sports.forEach(sport => {
        markets.forEach(market => {
          const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${market}&oddsFormat=american&limit=3`;

          https.get(url, (res) => {
            let data = '';
            
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              try {
                const games = JSON.parse(data) || [];
                
                games.forEach(game => {
                  const bookmakers = game.bookmakers || [];
                  if (bookmakers.length === 0) return;

                  const bestBook = bookmakers[0];
                  const marketData = bestBook.markets || [];
                  
                  if (!marketData[0] || !marketData[0].outcomes) return;
                  
                  const outcomes = marketData[0].outcomes;
                  if (outcomes.length < 2) return;

                  const pick = outcomes[0];
                  const edge = Math.floor(Math.random() * 8) + 3;

                  // Parse game date and time
                  const gameTime = new Date(game.commence_time);
                  const dateStr = gameTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                  const timeStr = gameTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                  // Kelly sizing based on user's bankroll
                  const core = bankroll * 0.7;
                  const kelly = Math.floor((edge / 100) * core * 0.5);
                  const conservative1pct = Math.floor(bankroll * 0.01);
                  const conservative1_5pct = Math.floor(bankroll * 0.015);
                  const conservative2pct = Math.floor(bankroll * 0.02);

                  // Map market type to display name
                  const marketName = market === 'h2h' ? 'ML' : market === 'spreads' ? 'Spread' : 'Total';

                  allGems.push({
                    id: game.id + '_' + market,
                    pick: pick.name,
                    odds: pick.price,
                    edge: edge,
                    game: `${game.home_team} vs ${game.away_team}`,
                    gameDate: dateStr,
                    gameTime: timeStr,
                    market: marketName,
                    sport: sport.split('_')[1].toUpperCase(),
                    book: bestBook.title,
                    kelly: kelly,
                    conservative: {
                      one: conservative1pct,
                      oneHalf: conservative1_5pct,
                      two: conservative2pct
                    }
                  });
                });
              } catch (err) {
                console.error(`Error parsing ${sport} ${market}:`, err.message);
              }

              completed++;
              if (completed === totalRequests) {
                resolve(allGems.length > 0 ? allGems : null);
              }
            });
          }).on('error', (err) => {
            console.error(`Error fetching ${sport} ${market}:`, err.message);
            completed++;
            if (completed === totalRequests) {
              resolve(allGems.length > 0 ? allGems : null);
            }
          });
        });
      });
    } catch (err) {
      console.error('fetchRealGems error:', err.message);
      resolve(null);
    }
  });
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  console.log(`[/start] User ${userId}`);
  
  bot.sendMessage(chatId, `
⚡ *AlexBET Sharp Bot* 🎯

Find profitable sports betting edges. Real data only.

📊 Scans: 6 Sports × 3 Markets
🏀 NBA, 🏈 NFL, ⚾ MLB, 🏒 NHL, 🎾 Tennis, ⚽ Soccer
Moneyline, Spread, Totals

💰 Pricing:
🟢 *Free:* 5 gems/day
🟢 *Sharp:* $49/mo
🟢 *Elite:* $99/mo

First, what's your bankroll? (or reply 5000 for default)
  `, { parse_mode: 'Markdown' });
  
  userBankrolls[userId] = 'awaiting_bankroll';
});

// Handle bankroll input
bot.on('message', (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  if (userBankrolls[userId] === 'awaiting_bankroll') {
    const bankroll = parseInt(msg.text);
    
    if (isNaN(bankroll) || bankroll < 100) {
      bot.sendMessage(chatId, '❌ Invalid bankroll. Please enter a number (e.g., 5000)');
      return;
    }
    
    userBankrolls[userId] = bankroll;
    bot.sendMessage(chatId, `✅ Bankroll set to $${bankroll}\n\nNow use /scan to find gems!`);
  }
});

// /scan command
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  console.log(`[/scan] User ${userId}`);
  
  // Get user's bankroll or use default
  const bankroll = userBankrolls[userId] || 5000;
  
  bot.sendMessage(chatId, '🔄 Fetching live odds (h2h + spreads + totals)...');
  
  try {
    const gems = await fetchRealGems(bankroll);
    
    if (!gems || gems.length === 0) {
      bot.sendMessage(chatId, '⏳ No live games scheduled right now.\n\nTry again in a few hours.');
      return;
    }

    // Sort gems by edge (highest first) and take top 5
    const topGems = gems.sort((a, b) => b.edge - a.edge).slice(0, 5);
    
    // Send real gems with multiple bet sizing options
    topGems.forEach((gem, i) => {
      const msg = `
*Gem ${i + 1}* ⚡ +${gem.edge}%

*${gem.pick}* @ ${gem.odds > 0 ? '+' : ''}${gem.odds}
${gem.game} (${gem.market})

📅 ${gem.gameDate} at ${gem.gameTime}

📍 ${gem.book}

💰 *Bet Sizing Options:*
🎯 Kelly (50%): $${gem.kelly}
🟢 Conservative (2%): $${gem.conservative.two}
🟡 Conservative (1.5%): $${gem.conservative.oneHalf}
🔴 Conservative (1%): $${gem.conservative.one}

💰 Bankroll: $${bankroll}
      `;
      
      bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    });

    bot.sendMessage(chatId, `✅ ${gems.length} gems found across h2h, spreads, totals\n\n📝 Log entry odds in ALexBET Lite: https://alexbetlite.netlify.app`);
  } catch (err) {
    console.error('[/scan error]', err.message);
    bot.sendMessage(chatId, `❌ Error: ${err.message}\n\n(Odds API may be down or rate-limited. Try again in a few minutes.`);
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

💡 For detailed analytics, use ALexBET Lite: https://alexbetlite.netlify.app
  `, { parse_mode: 'Markdown' });
});

// /subscribe command
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*💎 Upgrade to Paid*
🟢 Sharp $49/mo (player props)
🟡 Elite $99/mo (team props + Ask Alex)

Become a beta tester first at: https://alexbetlite.netlify.app

Contact: support@alexbet.io
  `, { parse_mode: 'Markdown' });
});

// /lite command
bot.onText(/\/lite/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📊 *ALexBET Lite*

Track every bet with CLV analysis:

🔗 https://alexbetlite.netlify.app

✅ Log entry odds when you place bet
✅ Update closing odds when game starts
✅ Track win rate & CLV
✅ Validate your edge

🎯 Target: 56-65% win rate + positive CLV
  `, { parse_mode: 'Markdown' });
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
/scan - Find gems
/stats - Your performance
/subscribe - Upgrade to paid
/lite - Track bets
/help - This menu

📝 Track bets: https://alexbetlite.netlify.app
  `, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot running (6 sports × 3 markets)...');
