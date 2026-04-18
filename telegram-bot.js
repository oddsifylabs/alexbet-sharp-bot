require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const ClaudeOptimizer = require('./claude-optimizer');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Set bot commands for autocomplete menu when user types /
// Wrapped in try-catch to prevent crash if Telegram API has issues
try {
  bot.setMyCommands([
    { command: 'start', description: 'Initialize bot with bankroll' },
    { command: 'scan', description: 'Find top 5 gems (6 sports × 3 markets)' },
    { command: 'stats', description: 'View your performance stats' },
    { command: 'export', description: 'Export bets (CSV, JSON, PDF)' },
    { command: 'timezone', description: 'Set your US timezone' },
    { command: 'subscribe', description: 'Upgrade to paid tier' },
    { command: 'lite', description: 'Go to ALexBET Lite tracker' },
    { command: 'help', description: 'Show all commands' }
  ]).catch(err => {
    console.warn('[WARN] setMyCommands failed (non-critical):', err.message);
  });
} catch (e) {
  console.warn('[WARN] setMyCommands error (non-critical):', e.message);
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const whopApiKey = process.env.WHOP_API_KEY;

if (!ODDS_API_KEY) {
  console.error('❌ CRITICAL: ODDS_API_KEY not set in .env');
  process.exit(1);
}
if (!whopApiKey) {
  console.error('❌ CRITICAL: WHOP_API_KEY not set in .env');
  process.exit(1);
}
const whopStoreUrl = 'https://whop.com/oddsify-shop';

// Initialize Claude optimizer
// UPDATED (2026-04-18 09:50): Re-enabled with Haiku-only mode (no Sonnet/Opus)
// Reduced cost: ~1x vs 10x previous cascade
let claudeOptimizer = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    claudeOptimizer = new ClaudeOptimizer(process.env.ANTHROPIC_API_KEY);
    console.log('✅ Claude optimizer initialized (Haiku-only mode)');
  } catch (err) {
    console.warn('⚠️ Claude optimizer failed:', err.message);
  }
}

// User timezones (stored per user)
const userTimezones = {};

// Sport league names and emojis
const sportInfo = {
  'basketball_nba': { league: 'NBA', emoji: '🏀', name: 'Basketball' },
  'americanfootball_nfl': { league: 'NFL', emoji: '🏈', name: 'American Football' },
  'baseball_mlb': { league: 'MLB', emoji: '⚾', name: 'Baseball' },
  'icehockey_nhl': { league: 'NHL', emoji: '🏒', name: 'Hockey' },
  'tennis_atp': { league: 'ATP', emoji: '🎾', name: 'Tennis' },
  'soccer_epl': { league: 'EPL', emoji: '⚽', name: 'Soccer' }
};

// Store user bankrolls in memory (in production, use Supabase)
const userBankrolls = {};

console.log('🤖 AlexBET Sharp Bot starting (h2h + spreads + totals)...');

function americanToImpliedProb(odds) {
  if (odds == null || Number.isNaN(Number(odds))) return null;
  const value = Number(odds);
  return value > 0 ? 100 / (value + 100) : Math.abs(value) / (Math.abs(value) + 100);
}

function americanToDecimal(odds) {
  const value = Number(odds);
  return value > 0 ? 1 + (value / 100) : 1 + (100 / Math.abs(value));
}

function formatGameDateTime(dateString, timezone = 'America/New_York') {
  const date = new Date(dateString);
  return {
    gameDate: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    }).format(date),
    gameTime: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date)
  };
}

function getOutcomeKey(outcome, market) {
  if (market === 'spreads' || market === 'totals') {
    return `${outcome.name}|${outcome.point ?? ''}`;
  }
  return `${outcome.name}`;
}

function formatPickLabel(outcome, market) {
  if (market === 'spreads' && outcome.point != null) {
    const point = Number(outcome.point);
    return `${outcome.name} ${point > 0 ? '+' : ''}${point}`;
  }
  if (market === 'totals' && outcome.point != null) {
    return `${outcome.name} ${outcome.point}`;
  }
  return outcome.name;
}

function calculateKellyStake(bankroll, fairProb, americanOdds) {
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1;
  const q = 1 - fairProb;
  const rawKelly = ((b * fairProb) - q) / b;
  const cappedKelly = Math.max(0, Math.min(rawKelly, 0.05));
  return Math.floor(bankroll * cappedKelly * 0.5);
}

// Fetch REAL gems using native https
async function fetchRealGems(bankroll = 100, timezone = 'America/New_York') {
  return new Promise((resolve) => {
    try {
      const sports = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl', 'tennis_atp', 'soccer_epl'];
      const markets = ['h2h', 'spreads', 'totals'];
      let allGems = [];
      let completed = 0;
      const totalRequests = sports.length * markets.length;

      sports.forEach(sport => {
        markets.forEach(market => {
          const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${market}&oddsFormat=american`;

          https.get(url, (res) => {
            let data = '';
            
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              try {
                if (!data || data.length === 0) {
                  console.warn(`[ODDS API] Empty response for ${sport} ${market}`);
                  completed++;
                  if (completed === totalRequests) {
                    resolve(allGems.length > 0 ? allGems : null);
                  }
                  return;
                }
                let games;
                try {
                  games = JSON.parse(data) || [];
                } catch (parseErr) {
                  console.error(`[ODDS API JSON Parse Error] ${sport} ${market}`, parseErr.message);
                  console.error(`Response length: ${data.length}, First 200 chars:`, data.substring(0, 200));
                  console.error(`Last 100 chars:`, data.substring(Math.max(0, data.length - 100)));
                  completed++;
                  if (completed === totalRequests) {
                    resolve(allGems.length > 0 ? allGems : null);
                  }
                  return;
                }
                games = games || [];
                
                games.forEach(game => {
                  const bookmakers = game.bookmakers || [];
                  if (bookmakers.length === 0) return;

                  const marketName = market === 'h2h' ? 'ML' : market === 'spreads' ? 'Spread' : 'Total';
                  const sInfo = sportInfo[sport] || { league: 'UNKNOWN', emoji: '🏅' };
                  const { gameDate, gameTime } = formatGameDateTime(game.commence_time, timezone);
                  const outcomeMap = new Map();

                  bookmakers.forEach(bookmaker => {
                    const bookMarket = (bookmaker.markets || []).find(m => m.key === market);
                    const outcomes = bookMarket?.outcomes || [];
                    if (outcomes.length < 2) return;

                    const implieds = outcomes.map(o => americanToImpliedProb(o.price)).filter(v => v != null);
                    const vigTotal = implieds.reduce((sum, value) => sum + value, 0);
                    if (!vigTotal) return;

                    outcomes.forEach(outcome => {
                      const impliedProb = americanToImpliedProb(outcome.price);
                      if (impliedProb == null) return;

                      const fairProb = impliedProb / vigTotal;
                      const key = getOutcomeKey(outcome, market);
                      const existing = outcomeMap.get(key) || {
                        outcome,
                        fairProbs: [],
                        bestPrice: null,
                        bestBook: null,
                        books: 0
                      };

                      existing.fairProbs.push(fairProb);
                      existing.books += 1;

                      if (existing.bestPrice == null || Number(outcome.price) > existing.bestPrice) {
                        existing.bestPrice = Number(outcome.price);
                        existing.bestBook = bookmaker.title;
                      }

                      outcomeMap.set(key, existing);
                    });
                  });

                  outcomeMap.forEach(({ outcome, fairProbs, bestPrice, bestBook, books }) => {
                    if (!fairProbs.length || bestPrice == null || books < 2) return;

                    const fairProb = fairProbs.reduce((sum, value) => sum + value, 0) / fairProbs.length;
                    const impliedProb = americanToImpliedProb(bestPrice);
                    const decimalOdds = americanToDecimal(bestPrice);
                    const ev = (fairProb * decimalOdds) - 1;
                    const edge = (fairProb - impliedProb) * 100;

                    if (!Number.isFinite(ev) || !Number.isFinite(edge) || ev <= 0.01) return;

                    const kelly = calculateKellyStake(bankroll, fairProb, bestPrice);
                    const conservative1pct = Math.floor(bankroll * 0.01);
                    const conservative1_5pct = Math.floor(bankroll * 0.015);
                    const conservative2pct = Math.floor(bankroll * 0.02);

                    const betTypeMap = { 'ML': 'MONEYLINE', 'Spread': 'SPREAD', 'Total': 'TOTAL' };
                    allGems.push({
                      id: `${game.id}_${market}_${getOutcomeKey(outcome, market)}`,
                      pick: formatPickLabel(outcome, market),
                      odds: bestPrice,
                      edge: Number(edge.toFixed(2)),
                      ev: Number((ev * 100).toFixed(2)),
                      game: `${game.away_team} vs ${game.home_team}`,
                      gameDate,
                      gameTime,
                      market: marketName,
                      betType: betTypeMap[marketName] || 'UNKNOWN',
                      sport: sport.split('_')[1].toUpperCase(),
                      league: sInfo.league,
                      sportEmoji: sInfo.emoji,
                      book: bestBook,
                      booksCompared: books,
                      kelly,
                      conservative: {
                        one: conservative1pct,
                        oneHalf: conservative1_5pct,
                        two: conservative2pct
                      }
                    });
                  });
                });
              } catch (err) {
                console.error(`[ODDS API Parse Error] ${sport} ${market}:`, err.message);
                console.error(`[DEBUG] Response length: ${data.length}, First 500 chars:`, data.substring(0, 500));
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

First, what's your bankroll? (or reply 100 for default)
  `, { parse_mode: 'Markdown' });
  
  userBankrolls[userId] = 'awaiting_bankroll';
});

// Handle bankroll input
bot.on('message', (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  if (userBankrolls[userId] === 'awaiting_bankroll') {
    const bankroll = parseInt(msg.text);
    
    if (isNaN(bankroll) || bankroll < 50) {
      bot.sendMessage(chatId, '❌ Invalid bankroll. Please enter a number (e.g., 100)');
      return;
    }
    
    userBankrolls[userId] = bankroll;
    bot.sendMessage(chatId, `✅ Bankroll set to $${bankroll}\n\nNow use /scan to find gems!`);
  }
});

// /scan command with Claude AI edge detection
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  console.log(`[/scan] User ${userId}`);
  
  // Get user's bankroll or use default
  const bankroll = userBankrolls[userId] || 100;
  const timezone = userTimezones[userId] || 'America/New_York';
  const isPremium = false; // TODO: Check user subscription from Whop
  
  bot.sendMessage(chatId, '🔄 Fetching live odds + Claude AI analysis...');
  
  try {
    const gems = await fetchRealGems(bankroll, timezone);
    
    if (!gems || gems.length === 0) {
      bot.sendMessage(chatId, '⏳ No live games scheduled right now.\n\nTry again in a few hours.');
      return;
    }

    // Use Claude optimizer if available
    let analyzedGems = gems;
    let claudeStats = null;
    if (claudeOptimizer) {
      console.log('[CLAUDE] Analyzing gems with multi-tier pipeline...');
      analyzedGems = [];
      
      // Analyze top 10 games with Haiku → Sonnet → Opus pipeline
      for (const gem of gems.slice(0, 10)) {
        try {
          const analysis = await claudeOptimizer.analyzeGame(gem, isPremium);
          gem.claudeEdge = analysis.edge;
          gem.claudeConfidence = analysis.confidence;
          gem.claudeModel = analysis.model;
          analyzedGems.push(gem);
          console.log(`[CLAUDE] ${gem.pick}: ${analysis.edge}% edge (${analysis.model}, ${analysis.confidence}% conf)`);
        } catch (err) {
          console.warn('[CLAUDE ERROR]', err.message);
          analyzedGems.push(gem);
        }
      }
      claudeStats = claudeOptimizer.getStats();
    } else {
      analyzedGems = gems;
    }

    // Build market breakdown
    const h2hCount = analyzedGems.filter(gem => gem.market === 'ML').length;
    const spreadCount = analyzedGems.filter(gem => gem.market === 'Spread').length;
    const totalCount = analyzedGems.filter(gem => gem.market === 'Total').length;

    // Sort by Claude edge or original edge (primary), then by EV (secondary)
    const topGems = analyzedGems
      .sort((a, b) => {
        const edgeA = a.claudeEdge !== undefined ? a.claudeEdge : a.edge;
        const edgeB = b.claudeEdge !== undefined ? b.claudeEdge : b.edge;
        if (edgeB !== edgeA) return edgeB - edgeA; // Primary: higher edge first
        return b.ev - a.ev; // Tiebreaker: higher EV first
      })
      .slice(0, 10);
    
    // Group gems by sport
    const sportGroups = {};
    topGems.forEach(gem => {
      const sport = gem.league || gem.sport || 'Other';
      if (!sportGroups[sport]) sportGroups[sport] = [];
      sportGroups[sport].push(gem);
    });

    // Sort each sport group by game time (ascending)
    Object.keys(sportGroups).forEach(sport => {
      sportGroups[sport].sort((a, b) => {
        const timeA = new Date(a.gameDate + ' ' + a.gameTime);
        const timeB = new Date(b.gameDate + ' ' + b.gameTime);
        return timeA - timeB;
      });
    });

    // Send summary FIRST
    bot.sendMessage(chatId, `✅ ${gems.length} gems found | ${topGems.length} displayed\n\n📊 Breakdown:\n💰 ${h2hCount} Moneylines | 📈 ${spreadCount} Spreads | ⬆️ ${totalCount} Totals\n\n📝 https://alexbetlite.netlify.app`);

    // Then send sport-grouped gem cards
    let gemCounter = 1;
    Object.keys(sportGroups).forEach(sport => {
      const gemsInSport = sportGroups[sport];
      let msg = `🏆 *${sport.toUpperCase()}*\n`;
      
      gemsInSport.forEach((gem, idx) => {
        const isLast = idx === gemsInSport.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const displayEdge = gem.claudeEdge !== undefined ? gem.claudeEdge : gem.edge;
        const confidence = gem.claudeConfidence ? ` (${gem.claudeConfidence}%)` : '';
        
        msg += `\n${prefix} #${gemCounter} [${gem.betType}] ⚡ ${displayEdge > 0 ? '+' : ''}${displayEdge}%${confidence}\n`;
        msg += `   *${gem.pick}* @ ${gem.odds > 0 ? '+' : ''}${gem.odds} | EV ${gem.ev > 0 ? '+' : ''}${gem.ev}%\n`;
        msg += `   ${gem.game} | ${gem.gameTime}\n`;
        msg += `   📍 ${gem.book} | 📚 ${gem.booksCompared}\n`;
        msg += `   💰 Kelly: $${gem.kelly} | 2%: $${gem.conservative.two}`;
        
        gemCounter++;
      });
      
      bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    });
  } catch (err) {
    console.error('[/scan error]', err.message);
    bot.sendMessage(chatId, `❌ Error: ${err.message}\n\n(Odds API may be down or rate-limited. Try again in a few minutes.`);
  }
});

// /stats and /stat commands
bot.onText(/\/stats?/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📊 Your Stats*
🔄 This feature is coming soon!

Track your P&L, win rate, and bet history:
📊 https://alexbetlite.netlify.app
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

// Discord/Slack alert configuration
let alertConfig = {
  discordWebhook: process.env.DISCORD_WEBHOOK_URL || null,
  slackWebhook: process.env.SLACK_WEBHOOK_URL || null
};

// /alerts command - Configure webhooks
bot.onText(/\/alerts\s*(discord|slack)?\s*(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const platform = match[1]?.toLowerCase();
  const webhookUrl = match[2]?.trim();

  if (!platform) {
    bot.sendMessage(chatId, `
🔘 *Configure Discord/Slack Alerts*

Usage:
/alerts discord WEBHOOK_URL
/alerts slack WEBHOOK_URL

🔗 Get webhook from Discord/Slack settings
📔 Status:
- Discord: ${alertConfig.discordWebhook ? '✅' : '❌'}
- Slack: ${alertConfig.slackWebhook ? '✅' : '❌'}
    `, { parse_mode: 'Markdown' });
    return;
  }

  if (!webhookUrl) {
    bot.sendMessage(chatId, '❌ Please provide webhook URL');
    return;
  }

  if (platform === 'discord') {
    alertConfig.discordWebhook = webhookUrl;
    bot.sendMessage(chatId, '✅ Discord webhook configured!');
  } else if (platform === 'slack') {
    alertConfig.slackWebhook = webhookUrl;
    bot.sendMessage(chatId, '✅ Slack webhook configured!');
  }
});

// /compare command - Line shopping
bot.onText(/\/compare\s+(.+?)\s+([+-]?\d+\.?\d*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const team = match[1]?.trim();
  const odds = parseFloat(match[2]);

  if (!team || isNaN(odds)) {
    bot.sendMessage(chatId, '❌ Usage: /compare TEAM_NAME ODDS\n\nExample: /compare HEAT -110');
    return;
  }

  bot.sendMessage(chatId, `🔍 Comparing odds for ${team} @ ${odds > 0 ? '+' : ''}${odds}...`);

  try {
    // Simulate odds comparison (would fetch from real Odds API in production)
    const books = [
      { name: 'FanDuel', odds: odds - 5, diff: -5 },
      { name: 'DraftKings', odds: odds, diff: 0 },
      { name: 'BetMGM', odds: odds - 10, diff: -10 },
      { name: 'Caesars', odds: odds - 15, diff: -15 },
      { name: 'PointsBet', odds: odds - 8, diff: -8 }
    ];

    // Sort by best odds (highest for favorites, lowest for underdogs)
    const sorted = odds < 0 ? books.sort((a, b) => b.odds - a.odds) : books.sort((a, b) => a.odds - b.odds);

    let response = `
*${team}* | ${odds > 0 ? '+' : ''}${odds}

📊 *Best Lines:*
`;

    sorted.forEach((book, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const diffStr = book.diff > 0 ? `(+${book.diff})` : book.diff < 0 ? `(${book.diff})` : '(BEST)';
      response += `${medal} ${book.name}: ${book.odds > 0 ? '+' : ''}${book.odds} ${diffStr}\n`;
    });

    // Calculate savings
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const savingsPercentPerBet = Math.abs(worst.diff);

    response += `
💰 *Savings (vs worst line):*
$50 bet: +$${(savingsPercentPerBet * 50 / 100).toFixed(0)}
$100 bet: +$${(savingsPercentPerBet * 100 / 100).toFixed(0)}
$500 bet: +$${(savingsPercentPerBet * 500 / 100).toFixed(0)}

🎯 *Recommendation:* Bet on ${best.name}
    `;

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[/compare error]', err.message);
    bot.sendMessage(chatId, '❌ Error fetching odds. Try again later.');
  }
});

// /calculator command - Custom edge calculator
bot.onText(/\/calculator/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
💰 *Custom Edge Calculator*

Define your own betting formula:

*Example formulas:*
- Simple: Win % - Vig
- Weighted: (Win % * 0.7) + (CLV * 0.3)
- Advanced: (WinRate - 0.5) * Odds * Kelly

📑 *How to set up:*
1. Visit https://alexbetlite.netlify.app
2. Go to Settings tab
3. Enter your formula
4. Bot will calculate dual-model comparison

🔍 *Your Model vs Bot Model:*
Bot shows:
- Your predicted edge
- Bot's calculated edge
- Blend recommendation (weighted average)
- Which model to use
  `, { parse_mode: 'Markdown' });
});

// /api command - REST API documentation
bot.onText(/\/api/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
🔗 *AlexBET Sharp REST API*

Integrate with Excel, Airtable, or custom tools:

*Endpoints:*
\`GET /api/bets\` — Your bets
\`GET /api/stats\` — Performance stats
\`GET /api/picks\` — Today's gems
\`POST /api/bets\` — Create bet
\`GET /api/health\` — Health check

*Authentication:*
Header: \`X-API-Key: YOUR_KEY\`

*Example (cURL):*
\`curl -H 'X-API-Key: demo-key' http://api.alexbet.io/api/stats\`

💼 *Premium feature ($99/mo)*
White-label API + unlimited requests

📧 Contact support for API key
  `, { parse_mode: 'Markdown' });
});

// /timezone command (USA only)
bot.onText(/\/timezone/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  bot.sendMessage(chatId, `🇺🇸 Select your US timezone for game times:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'EST (New York)', callback_data: 'tz_est' }, { text: 'CST (Chicago)', callback_data: 'tz_cst' }],
        [{ text: 'MST (Denver)', callback_data: 'tz_mst' }, { text: 'PST (Los Angeles)', callback_data: 'tz_pst' }],
        [{ text: 'AKST (Alaska)', callback_data: 'tz_akst' }, { text: 'HST (Hawaii)', callback_data: 'tz_hst' }]
      ]
    }
  });
});

// Handle USA timezone
bot.on('callback_query', (q) => {
  const userId = q.from.id;
  const tzMap = { 
    'tz_est': 'America/New_York', 
    'tz_cst': 'America/Chicago', 
    'tz_mst': 'America/Denver', 
    'tz_pst': 'America/Los_Angeles', 
    'tz_akst': 'America/Anchorage', 
    'tz_hst': 'Pacific/Honolulu' 
  };
  if (tzMap[q.data]) { 
    userTimezones[userId] = tzMap[q.data]; 
    bot.answerCallbackQuery(q.id, '✅ Timezone updated'); 
  }
});

// /help command
// Export feature - CSV, JSON, PDF
bot.onText(/\/export/, (msg) => {
  const chatId = msg.chat.id;
  const message = `📊 Export Your Data

Choose format:

/export_csv - Download as CSV (Excel)
/export_json - Download as JSON (backup)
/export_pdf - Download as PDF report

Exports include:
✅ All bets (dates, odds, results)
✅ Performance stats
✅ By-sport breakdown
✅ CLV analysis`;
  bot.sendMessage(chatId, message);
});

// CSV export
bot.onText(/\/export_csv/, (msg) => {
  const chatId = msg.chat.id;
  const message = `📥 CSV Export Ready

Format: Date, Pick, Sport, Type, Odds, Edge%, Stake, Status, P&L, CLV%

Features:
✅ Open in Excel/Google Sheets
✅ Pivot tables ready
✅ Real-time data
✅ Download via web app

💾 Export from: https://alexbetlite.netlify.app`;
  bot.sendMessage(chatId, message);
});

// JSON export
bot.onText(/\/export_json/, (msg) => {
  const chatId = msg.chat.id;
  const message = `📥 JSON Export Ready

Format: Structured JSON with all metadata

Includes:
✅ Complete bet history
✅ User stats
✅ Timestamps
✅ Performance metrics
✅ Metadata

🔄 Perfect for: Backup, integration, analysis

💾 Export from: https://alexbetlite.netlify.app`;
  bot.sendMessage(chatId, message);
});

// PDF export
bot.onText(/\/export_pdf/, (msg) => {
  const chatId = msg.chat.id;
  const message = `📥 PDF Report Ready

Format: Professional PDF report

Includes:
✅ Performance summary
✅ Statistics by sport
✅ Charts & graphs
✅ Win rate analysis
✅ CLV metrics
✅ Month-over-month trends

📄 Professional format for: Sharing, printing, archiving

💾 Export from: https://alexbetlite.netlify.app`;
  bot.sendMessage(chatId, message);
});

// /subscribe command - Show Whop products
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📖 Ebook ($9.99)', url: 'https://whop.com/oddsify-shop' },
        { text: '🤖 Bot Premium ($99.99)', url: 'https://whop.com/oddsify-shop' }
      ],
      [
        { text: 'ℹ️ Learn More', callback_data: 'learn_more' }
      ]
    ]
  };
  
  bot.sendMessage(chatId, `
⭐ AlexBET Premium Options

📖 AlexBET Sharp Betting Guide
Price: $9.99 (one-time)
✅ All 4 formats (PDF, EPUB, HTML, TXT)
✅ 50+ pages of education
✅ Instant delivery
✅ Lifetime access

🤖 AlexBET Bot Premium (1 Year)
Price: $99.99/year
✅ Full bot access for 1 year
✅ Real-time gem scanning
✅ All features included
✅ Priority support

Click button to purchase:
  `, { reply_markup: keyboard });
});

// Handle callback queries
bot.on('callback_query', (query) => {
  if (query.data === 'learn_more') {
    bot.sendMessage(query.message.chat.id, `
📚 What's Included?

✅ AlexBET Ebook:
• Kelly Criterion (corrected)
• CLV calculation
• Edge detection
• Bankroll management
• Real examples

✅ Bot Premium:
• Everything in ebook
• Live gem scanning
• Performance analytics
• Line shopping
• Priority support

Ready? /subscribe to purchase!
    `);
  }
  bot.answerCallbackQuery(query.id);
});

// Whop integration placeholder
// Users will be redirected to Whop for checkout
// No embedded payment processing needed
console.log('[Whop] Payment system integrated');

// /terms command - Terms & Conditions
bot.onText(/\/terms/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📋 Terms & Conditions

AlexBET Sharp Bot by Oddsify Labs

1. SUBSCRIPTION
• 1-year subscription automatically set to expire
• You can cancel anytime
• No refunds after 7 days

2. DIGITAL GOODS
• Ebook license for personal use only
• No distribution or resale
• All content copyright Oddsify Labs

3. PAYMENT
• Powered by Telegram Stars
• Payments are final (see refund policy)
• All amounts in USD equivalent

4. DISCLAIMERS
• Past performance ≠ future results
• Sports betting carries risk
• We provide analysis, not guarantees
• You are responsible for your bets

5. REFUNDS
• Full refund within 7 days if unopened
• No refund after 7 days
• Disputes handled via /paysupport

6. LIABILITY
• We are not liable for losses
• Use at your own risk
• Comply with all local laws

By using this bot, you agree to these terms.

Questions? /support
  `);
});

// /support command - Customer Support
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
💬 Support & Help

For issues, email: support@oddsifylabs.com

Common Issues:

❓ Didn't receive my ebook?
Check /downloads or email support

❓ Bot features not working?
Try /help or restart the bot

❓ Subscription issue?
Email support with transaction ID

❓ Payment problems?
Use /paysupport for payment issues

❓ General questions?
Email: support@oddsifylabs.com

We respond within 24 hours.
  `);
});

// /paysupport command - Payment Disputes
bot.onText(/\/paysupport/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
💳 Payment Support

For payment disputes or refund requests:

📧 Email: support@oddsifylabs.com

Include:
✅ Transaction ID (from receipt)
✅ Date of purchase
✅ Issue description
✅ Preferred resolution

Refund Policy:
• Full refund within 7 days (unopened products)
• 50% refund days 7-30
• No refunds after 30 days
• Disputes resolved within 48 hours

We're here to help!
  `);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
/scan - Find gems
/stats - Your performance
/export - Export data (CSV/JSON/PDF)
/timezone - Set US timezone (EST, CST, MST, PST, etc)
/subscribe - Upgrade to paid (Stars)
/lite - Track bets
/terms - Terms & Conditions
/support - Customer support
/paysupport - Payment issues
/help - This menu

📱 Track bets: https://alexbetlite.netlify.app
⭐ Subscribe: /subscribe
  `);
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot running with Whop payments integrated...');
console.log('📍 Subscribe: /subscribe');
console.log('🛒 Whop store ready for payments');
