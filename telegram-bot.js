require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const fs = require('fs');
const path = require('path');
const ClaudeOptimizer = require('./claude-optimizer');
const RateLimiter = require('./src/services/rateLimiter');
const logger = require('./src/utils/logger');
const { validateBankroll, validateTimezone, parseAPIResponse } = require('./src/utils/validation');
const { exportToCSV, exportToTXT, exportToJSON, getAvailableExports } = require('./src/utils/export-handler');
const supabaseClient = require('./src/services/supabase-client');
const { registerPaymentHandlers, getUserTier } = require('./src/services/whop-payment');
const { getSubscriptionDetails, isAdmin: checkIsAdmin } = require('./src/services/auth');
const cron = require('node-cron');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Initialize Supabase and payment handlers
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

// Initialize payment handlers (registers /subscribe command and payment webhooks)
registerPaymentHandlers(bot);

// ✅ Admin list - these users bypass all restrictions
const ADMIN_IDS = [8502906149]; // Jesse Collins

// Helper function to check if user is admin
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

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
    { command: 'status', description: 'Check your subscription status' },
    { command: 'lite', description: 'Go to ALexBET Lite tracker' },
    { command: 'help', description: 'Show all commands' }
  ]).catch(err => {
    console.warn('[WARN] setMyCommands failed (non-critical):', err.message);
  });
  
  // Set bot short description (appears in Telegram search + profile)
  bot.api.setMyShortDescription({
    short_description: '🎯 Find profitable sports betting edges with AI-powered +EV scanning across 6 sports'
  }).catch(err => {
    console.warn('[WARN] setMyShortDescription failed (non-critical):', err.message);
  });
  
  // Set bot detailed description (appears in bot profile)
  // Note: Telegram limits to 512 characters including line breaks
  bot.api.setMyDescription({
    description: `🎯 AlexBET Sharp - Professional Sports Betting

Find +EV edges with AI-powered analysis across 6 sports (NFL, NBA, MLB, NHL, ATP, EPL)

📊 Markets: Moneyline, Spreads, Totals
🔍 Real-time odds scanning & edge detection
📈 CLV tracking & performance analytics
🎁 Free & premium tiers

/scan - Find gems | /stats - Your stats | /export - Download data | /lite - Web app`
  }).catch(err => {
    console.warn('[WARN] setMyDescription failed (non-critical):', err.message);
  });
} catch (e) {
  console.warn('[WARN] setMyCommands/setMyDescription error (non-critical):', e.message);
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const whopApiKey = process.env.WHOP_API_KEY;

if (!ODDS_API_KEY) {
  console.error('❌ CRITICAL: ODDS_API_KEY not set in .env');
  process.exit(1);
}
if (!whopApiKey) {
  console.warn('⚠️ WARNING: WHOP_API_KEY not set in .env (subscription features will be disabled)');
}
const whopStoreUrl = 'https://whop.com/oddsify-shop';

// Initialize ClaudeOptimizer
// ✅ DEPLOYMENT: 2026-04-21 09:55 - Force fresh restart
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

// Initialize rate limiters
// scanLimiter: 10 requests per minute per user
// apiRetryLimiter: Track API failures for adaptive backoff
const scanLimiter = new RateLimiter(10, 60000); // 10 req/min
const apiErrorTracker = new Map(); // userId -> {count, resetTime}

logger.info('Rate limiters initialized', {
  scanLimit: '10 requests per 60 seconds',
  purpose: 'Prevent abuse and track API failures'
});

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

// Helper to get sport emoji from gem sport data
function getSportEmoji(sport) {
  if (!sport) return '🏆';
  const sportLower = sport.toLowerCase();
  if (sportLower.includes('nba') || sportLower.includes('basketball')) return '🏀';
  if (sportLower.includes('nfl') || sportLower.includes('football')) return '🏈';
  if (sportLower.includes('mlb') || sportLower.includes('baseball')) return '⚾';
  if (sportLower.includes('nhl') || sportLower.includes('hockey')) return '🏒';
  if (sportLower.includes('tennis') || sportLower.includes('atp')) return '🎾';
  if (sportLower.includes('soccer') || sportLower.includes('epl')) return '⚽';
  return '🏆';
}

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
  
  // Ensure valid date
  if (isNaN(date.getTime())) {
    return { gameDate: 'N/A', gameTime: 'N/A' };
  }
  
  try {
    const gameDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    }).format(date);
    
    const gameTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
    
    return { gameDate, gameTime };
  } catch (err) {
    console.error('Error formatting date:', err.message);
    return { gameDate: 'N/A', gameTime: 'N/A' };
  }
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

          const req = https.get(url, (res) => {
            let data = '';
            let isTimedOut = false;
            
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              if (isTimedOut) return; // Skip if already timed out
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

                  // ✅ FIX: Collect raw implied probabilities (no normalization by vig)
                  let processedBooks = 0;
                  bookmakers.forEach(bookmaker => {
                    const bookMarket = (bookmaker.markets || []).find(m => m.key === market);
                    const outcomes = bookMarket?.outcomes || [];
                    if (outcomes.length < 2) {
                      // This bookmaker doesn't have this market
                      return;
                    }
                    
                    processedBooks++;

                    outcomes.forEach(outcome => {
                      const impliedProb = americanToImpliedProb(outcome.price);
                      if (impliedProb == null) return;

                      const key = getOutcomeKey(outcome, market);
                      const existing = outcomeMap.get(key) || {
                        outcome,
                        impliedProbs: [],
                        bookmakers: new Set(),  // ✅ Track UNIQUE bookmakers
                        bestPrice: null,
                        bestBook: null
                      };

                      existing.impliedProbs.push(impliedProb);
                      existing.bookmakers.add(bookmaker.title);  // ✅ Add bookmaker name

                      if (existing.bestPrice == null || Number(outcome.price) > existing.bestPrice) {
                        existing.bestPrice = Number(outcome.price);
                        existing.bestBook = bookmaker.title;
                      }

                      outcomeMap.set(key, existing);
                    });
                  });

                  // DEBUG: Log outcome map size
                  if (outcomeMap.size > 0 && processedBooks > 0) {
                    console.log(`[GEM DEBUG] ${game.away_team} vs ${game.home_team} (${market}): Found ${outcomeMap.size} outcomes from ${processedBooks}/${bookmakers.length} books`);
                    outcomeMap.forEach((data, key) => {
                      console.log(`  Outcome: ${key}, Books: ${data.books}, BestPrice: ${data.bestPrice}, Probs: ${data.impliedProbs.length}`);
                    });
                  }

                  // ✅ FIX: Calculate edge using market consensus (no vig normalization)
                  let filteredCount = 0;
                  outcomeMap.forEach(({ outcome, impliedProbs, bestPrice, bestBook, bookmakers }) => {
                    const books = bookmakers.size;  // ✅ Count of UNIQUE bookmakers
                    if (!impliedProbs.length || bestPrice == null || books < 2) {
                      // DEBUG
                      if (allGems.length === 0 && processedBooks > 0) {
                        console.log(`[GEM SKIP] ${outcome.name}: Probs=${impliedProbs.length} Price=${bestPrice} Books=${books}`);
                      }
                      return;
                    }
                    
                    filteredCount++;

                    // Market consensus = average of raw implied probs across all bookmakers
                    const consensusProb = impliedProbs.reduce((sum, value) => sum + value, 0) / impliedProbs.length;
                    
                    // Best odds imply this probability
                    const bestOddsImpliedProb = americanToImpliedProb(bestPrice);
                    
                    // Edge: positive when consensus > best odds (value opportunity)
                    const edge = (consensusProb - bestOddsImpliedProb) * 100;
                    
                    const decimalOdds = americanToDecimal(bestPrice);
                    const ev = (consensusProb * decimalOdds) - 1;

                    // DEBUG LOGGING
                    const isValid = Number.isFinite(ev) && Number.isFinite(edge) && ev > 0.0001;
                    if (allGems.length < 5) {
                      // Log first 5 outcomes for debugging
                      console.log(`[GEM CALC] ${game.away_team} vs ${game.home_team} | ${outcome.name}: EV=${ev.toFixed(6)} Edge=${edge.toFixed(3)}% Books=${books} Valid=${isValid}`);
                    }

                    // Quality threshold: 2% EV minimum (eliminate noise, focus on real opportunities)
                    if (!Number.isFinite(ev) || !Number.isFinite(edge) || ev <= 0.02) return;

                    const kelly = calculateKellyStake(bankroll, consensusProb, bestPrice);  // ✅ Changed: use consensusProb
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
          });

          // Set timeout: 5 seconds max per request
          req.setTimeout(5000);
          req.on('timeout', () => {
            isTimedOut = true;
            req.destroy();
            console.warn(`[TIMEOUT] Request timed out for ${sport} ${market}`);
            completed++;
            if (completed === totalRequests) {
              resolve(allGems.length > 0 ? allGems : null);
            }
          });

          req.on('error', (err) => {
            if (isTimedOut) return; // Don't handle if already timed out
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

// /start command - Professional welcome with inline buttons
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || 'anonymous';
  
  logger.info('User initiated /start command', { userId, userName, chatId, isAdmin: isAdmin(userId) });
  
  // Clear any lingering awaiting state
  if (userBankrolls[userId] === 'awaiting_bankroll' || userBankrolls[userId] === 'awaiting_bankroll_update') {
    userBankrolls[userId] = 100; // Reset to default
    logger.debug('Cleared lingering bankroll state', { userId });
  }
  
  // Load existing timezone and bankroll from database if available
  try {
    const { data: user } = await supabaseClient.getUser(userId);
    if (user) {
      if (user.timezone) {
        userTimezones[userId] = user.timezone;
      }
      if (user.bankroll) {
        userBankrolls[userId] = user.bankroll;
        logger.info('Loaded user bankroll from database', { userId, bankroll: user.bankroll });
      }
    }
  } catch (err) {
    logger.debug('Could not load user data:', err.message);
  }
  
  // Professional welcome message
  const welcomeMessage = `
🎯 *AlexBET Sharp - Professional Sports Betting*

Find profitable edges in 6 sports:
*NFL • NBA • MLB • NHL • ATP Tennis • EPL Soccer*

Markets: *Moneyline, Spreads, Totals*
Real-time odds, edge detection, CLV tracking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ *What can this bot do?*

🔍 */scan* - Find top gems
📊 */stats* - Your performance  
📥 */export* - Download data (CSV/JSON/PDF)
🔀 */compare* - Line shopping
🌍 */timezone* - Set timezone
📱 */lite* - Web app tracker
❓ */help* - All commands

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Track bets: https://alexbet-lite.netlify.app
  `;
  
  // Check if user already has bankroll set
  if (userBankrolls[userId] && typeof userBankrolls[userId] === 'number') {
    bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Scan for Gems', callback_data: 'action_scan' }, { text: '📊 View Stats', callback_data: 'action_stats' }],
          [{ text: '💰 Update Bankroll ($' + userBankrolls[userId] + ')', callback_data: 'action_bankroll' }],
          [{ text: '⚙️ Settings', callback_data: 'action_settings' }, { text: '💎 Premium', callback_data: 'action_subscribe' }],
          [{ text: '📱 Go to Lite App', url: 'https://alexbet-lite.netlify.app' }],
          [{ text: '❓ Commands', callback_data: 'action_help' }]
        ]
      }
    });
  } else {
    // New user - ask for bankroll
    bot.sendMessage(chatId, welcomeMessage + `

💰 *What's your betting bankroll?*
(minimum $1, or reply with a number)
    `, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 $50', callback_data: 'bankroll_50' }, { text: '💵 $100', callback_data: 'bankroll_100' }, { text: '💵 $250', callback_data: 'bankroll_250' }],
          [{ text: '💵 $500', callback_data: 'bankroll_500' }, { text: '💵 $1000', callback_data: 'bankroll_1000' }],
          [{ text: '✏️ Enter Custom Amount', callback_data: 'bankroll_custom' }]
        ]
      }
    });
    
    userBankrolls[userId] = 'awaiting_bankroll';
    logger.debug('Awaiting user bankroll input', { userId, chatId });
  }
});


// Handle quick bankroll selection buttons

bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  console.log(`[MESSAGE] Received from ${userId}: "${msg.text}" (type: ${typeof msg.text})`);
  
  // CRITICAL: Commands always take priority - clear bankroll state immediately
  if (msg.text && msg.text.startsWith('/')) {
    console.log(`[MESSAGE] Command detected: ${msg.text}`);
    // Clear awaiting_bankroll state for ANY command
    if (userBankrolls[userId] === 'awaiting_bankroll' || userBankrolls[userId] === 'awaiting_bankroll_update') {
      console.log(`[MESSAGE] Clearing awaiting_bankroll state for command`);
      delete userBankrolls[userId];
    }
    return; // Return immediately - let command handlers process
  }
  
  console.log(`[MESSAGE] Non-command message, bankroll state: ${userBankrolls[userId]}`);
  
  if (userBankrolls[userId] === 'awaiting_bankroll') {
    const validation = validateBankroll(msg.text);
    
    if (!validation.valid) {
      logger.warn('Invalid bankroll input received', {
        userId,
        input: msg.text,
        error: validation.error
      });
      bot.sendMessage(chatId, validation.error);
      return;
    }
    
    userBankrolls[userId] = validation.value;
    
    // Save bankroll to database for persistence
    try {
      await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
      const { error } = await supabaseClient.supabase
        .from('users')
        .update({ bankroll: validation.value, updated_at: new Date() })
        .eq('telegram_id', userId);
      
      if (!error) {
        logger.info('Bankroll configured and saved', {
          userId,
          bankroll: validation.value,
          chatId
        });
        bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value}\\n\\nNow use /scan to find gems!`);
      } else {
        logger.warn('Could not save bankroll to database:', error.message);
        bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value} (local only)\\n\\nNow use /scan to find gems!`);
      }
    } catch (err) {
      logger.warn('Error saving bankroll:', err.message);
      bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value}\\n\\nNow use /scan to find gems!`);
    }
  }
});

/**
 * Retry with exponential backoff
 * Implements: delay = initialDelay * 2^(attemptNumber-1)
 * Attempt 1: 1s, Attempt 2: 2s, Attempt 3: 4s
 */
async function retryWithBackoff(fn, maxAttempts = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug('Attempting operation', { attempt, maxAttempts });
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        // Calculate exponential backoff: 1s, 2s, 4s, etc.
        const delayMs = initialDelay * Math.pow(2, attempt - 1);
        logger.warn('Request failed, retrying with backoff', {
          attempt,
          maxAttempts,
          nextRetryInMs: delayMs,
          nextRetryInSec: (delayMs / 1000).toFixed(1),
          error: error.message
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All attempts failed
  throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
}

// /scan command with Claude AI edge detection
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || 'anonymous';
  
  logger.info('User initiated /scan command', { userId, userName, chatId, isAdmin: isAdmin(userId) });
  
  // CHECK RATE LIMIT FIRST
  const rateLimitStatus = scanLimiter.isRateLimited(userId);
  if (rateLimitStatus.limited) {
    const waitTime = rateLimitStatus.secondsLeft;
    const userMsg = `⏱️ Rate limited! Please wait ${waitTime}s before next scan.\n\n📊 Limit: ${rateLimitStatus.maxRequests} scans per minute.`;
    bot.sendMessage(chatId, userMsg);
    logger.warn('User rate limited for /scan', { userId, waitTime, limit: rateLimitStatus.maxRequests });
    return; // Stop processing
  }
  
  // Get user's bankroll or use default
  const bankroll = userBankrolls[userId] || 100;
  const timezone = userTimezones[userId] || 'America/New_York';
  
  // Check user subscription tier
  let subscription = { tier: 'admin', gems: 9999, allowedMarkets: ['ML', 'Spread', 'Total'] };
  
  // Admins bypass subscription checks
  if (!isAdmin(userId)) {
    subscription = { tier: 'free', gems: 3, allowedMarkets: ['ML'] };
    try {
      const subDetails = await getSubscriptionDetails(userId);
      const tierConfig = {
        'free': { gems: 3, allowedMarkets: ['ML'] },
        'monthly': { gems: 10, allowedMarkets: ['ML', 'Total'] },
        'monthly_plus': { gems: 30, allowedMarkets: ['ML', 'Spread', 'Total'] },
        'yearly': { gems: 20, allowedMarkets: ['ML', 'Spread', 'Total'] },
        'lifetime': { gems: 9999, allowedMarkets: ['ML', 'Spread', 'Total'] }
      };
      subscription = {
        tier: subDetails.tier || 'free',
        gems: tierConfig[subDetails.tier]?.gems || 3,
        allowedMarkets: tierConfig[subDetails.tier]?.allowedMarkets || ['moneyline']
      };
    } catch (err) {
      logger.warn('Failed to fetch subscription status, using free tier', { userId, error: err.message });
      subscription = { tier: 'free', gems: 3, allowedMarkets: ['moneyline'] };
    }
  }
  
  logger.info('Scan parameters loaded', { userId, bankroll, timezone, subscription: subscription.tier, maxGems: subscription.gems, allowedMarkets: subscription.allowedMarkets });
  
  bot.sendMessage(chatId, '🔄 Fetching live odds + Claude AI analysis...');
  const scanStartTime = Date.now();
  
  try {
    logger.debug('Fetching gems from Odds API', { userId, bankroll, timezone });
    
    // Fetch gems with exponential backoff (3 attempts: 1s, 2s, 4s)
    let gems;
    try {
      gems = await retryWithBackoff(
        () => fetchRealGems(bankroll, timezone),
        3,    // max attempts
        1000  // initial delay (1 second)
      );
    } catch (retryError) {
      logger.error('Gems fetch failed after all retry attempts', {
        userId,
        error: retryError.message
      });
      bot.sendMessage(
        chatId,
        `❌ Unable to fetch gems after 3 attempts.\n\nAPI may be overloaded. Please try again in a moment.`
      );
      return;
    }
    
    const fetchDuration = ((Date.now() - scanStartTime) / 1000).toFixed(3);
    
    if (!gems || gems.length === 0) {
      logger.warn('No gems found from API', { userId, fetchDuration });
      console.log('[DEBUG] fetchRealGems returned null or empty array');
      console.log('[DEBUG] This means no outcomes passed the EV threshold (> 0.2%)');
      bot.sendMessage(chatId, '⏳ No live games scheduled right now.\\n\\nTry again in a few hours.');
      return;
    }

    logger.info('Gems fetched from API', { userId, gemCount: gems.length, fetchDuration });

    // ✅ FIX: Filter gems by subscription tier's allowed markets
    // Free: only ML (Moneyline)
    // Monthly: ML + Totals
    // Yearly+: ML + Spreads + Totals
    const filteredGems = gems.filter(gem => subscription.allowedMarkets.includes(gem.market));
    const filteredCount = gems.length - filteredGems.length;
    
    if (filteredCount > 0) {
      logger.info('Gems filtered by subscription tier', { 
        userId, 
        tier: subscription.tier, 
        allowedMarkets: subscription.allowedMarkets,
        originalCount: gems.length, 
        filteredCount,
        remainingCount: filteredGems.length 
      });
    }
    
    if (filteredGems.length === 0) {
      logger.warn('No gems available after market filtering', { userId, tier: subscription.tier, allowedMarkets: subscription.allowedMarkets });
      bot.sendMessage(chatId, `⏳ No ${subscription.allowedMarkets.join('/')} opportunities right now.\n\nUpgrade your subscription for access to more markets: /subscribe`);
      return;
    }

    // Use Claude optimizer if available
    let analyzedGems = filteredGems;
    let claudeStats = null;
    if (claudeOptimizer) {
      logger.debug('Starting Claude AI analysis pipeline', { userId, gemCount: gems.length });
      analyzedGems = [];
      
      // Analyze top 10 games with Haiku → Sonnet → Opus pipeline
      for (const gem of gems.slice(0, 10)) {
        try {
          const isPremium = subscription.tier !== 'free';
          const analysis = await claudeOptimizer.analyzeGame(gem, isPremium);
          gem.claudeEdge = analysis.edge;
          gem.claudeConfidence = analysis.confidence;
          gem.claudeModel = analysis.model;
          analyzedGems.push(gem);
          logger.debug('Claude analysis complete for game', {
            userId,
            pick: gem.pick,
            edge: analysis.edge,
            model: analysis.model,
            confidence: analysis.confidence
          });
        } catch (err) {
          logger.warn('Claude analysis failed for game', {
            userId,
            pick: gem.pick,
            error: err.message
          });
          analyzedGems.push(gem);
        }
      }
      claudeStats = claudeOptimizer.getStats();
      logger.info('Claude analysis pipeline complete', { userId, gemsAnalyzed: analyzedGems.length, stats: claudeStats });
    } else {
      logger.warn('Claude optimizer not available, using raw edge data', { userId });
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
      .slice(0, subscription.maxGems); // ✅ Apply tier-based gem limit (free: 3, monthly: 10, yearly: 20, lifetime: unlimited)
    
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
    const topGem = topGems[0];
    const topGemDisplay = topGem ? `#${topGems.indexOf(topGem) + 1} ${topGem.pick} (+${topGem.claudeEdge || topGem.edge}% edge)` : 'N/A';
    const summaryMsg = `✅ SCAN COMPLETE - ${gems.length} gems found

📊 BREAKDOWN
   💰 ${h2hCount} Moneylines | 📈 ${spreadCount} Spreads | ⬆️ ${totalCount} Totals

🎯 TOP OPPORTUNITY
   ${topGemDisplay}

📥 NEXT STEPS
   • Review gems below (ranked by edge %)
   • /export_csv to download all picks
   • /subscribe for premium features

📱 Dashboard: https://alexbet-lite.netlify.app`;
    bot.sendMessage(chatId, summaryMsg);

    // Store latest gems for export functionality
    userLatestScans[userId] = {
      gems: topGems,
      timestamp: Date.now(),
      count: gems.length,
      date: new Date().toISOString()
    };
    logger.info('Scan results stored for export', { userId, gemsCount: topGems.length });

    // Then send sport-grouped gem cards
    let gemCounter = 1;
    Object.keys(sportGroups).forEach(sport => {
      const gemsInSport = sportGroups[sport];
      let msg = `🏆 *${sport.toUpperCase()}*\n\n`;
      
      gemsInSport.forEach((gem, idx) => {
        // ✅ Use math-based edge (more reliable than Claude's vague analysis)
        const displayEdge = gem.edge;
        
        // ✅ Calculate confidence based on:
        // - Edge strength (higher edge = higher confidence)
        // - EV strength (validates edge with expected value)
        // - Consensus quality (more bookmakers = higher confidence)
        const edgeConfidence = Math.min(90, Math.max(35, Math.round(50 + (Math.abs(displayEdge) * 6)))); // 1% edge = 56%, 5% edge = 80%
        const evBonus = gem.ev > 5 ? 8 : gem.ev > 2 ? 4 : 0;
        const consensusBonus = gem.booksCompared >= 5 ? 12 : gem.booksCompared >= 3 ? 8 : 0;
        const confidence = Math.min(95, edgeConfidence + evBonus + consensusBonus); // Confidence formula
        
        // Format date better: "Fri, Apr 19" instead of "04/19"
        const gameDate = gem.gameDate ? gem.gameDate : 'TBD';
        const gameTime = gem.gameTime ? gem.gameTime : 'TBD';
        
        msg += `#${gemCounter} ${getSportEmoji(gem.sport)} *${gem.betType.toUpperCase()}* | ⚡ +${displayEdge}% | ${confidence}% confidence\n`;
        msg += `   *${gem.pick}* @ ${gem.odds > 0 ? '+' : ''}${gem.odds} | EV +${gem.ev}%\n`;
        msg += `   📍 ${gem.game}\n`;
        msg += `   📅 ${gameDate} | 🕐 ${gameTime}\n`;
        msg += `   💰 Kelly: $${gem.kelly} | Conservative: $${gem.conservative.two}\n`;
        msg += `   📊 Best: ${gem.book} | 📚 ${gem.booksCompared} books\n`;
        
        // Add separator between gems (except after last one)
        if (idx < gemsInSport.length - 1) {
          msg += `${'═'.repeat(45)}\n\n`;
        }
        
        gemCounter++;
      });
      
      bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    });
  } catch (err) {
    logger.error('Scan execution failed', {
      userId,
      error: err.message,
      stack: err.stack
    });
    
    // Provide helpful context about the error
    const isNetworkError = err.message.includes('ECONNREFUSED') || 
                          err.message.includes('ENOTFOUND') || 
                          err.message.includes('ETIMEDOUT');
    const isRateLimitError = err.message.includes('429') || 
                            err.message.includes('rate limit');
    const isTimeoutError = err.message.includes('timeout') || 
                          err.message.includes('5 second');
    
    let errorContext = 'An error occurred while scanning odds';
    let suggestion = 'Try again in a few minutes.';
    
    if (isNetworkError) {
      errorContext = '🔌 Network connection failed';
      suggestion = 'Check your connection and try again.';
    } else if (isRateLimitError) {
      errorContext = '⚡ API rate limit exceeded';
      suggestion = 'The API is overloaded. Wait a few minutes.';
    } else if (isTimeoutError) {
      errorContext = '⏱️ Request timed out';
      suggestion = 'API is slow. Try again in 30 seconds.';
    } else if (err.message.includes('Failed after')) {
      errorContext = '🔄 API unreliable';
      suggestion = 'Multiple retries failed. Try again later.';
    }
    
    logger.error('Contextual error info', {
      userId,
      isNetworkError,
      isRateLimitError,
      isTimeoutError,
      fullError: err.message
    });
    
    bot.sendMessage(chatId, `❌ ${errorContext}\\n\\n${suggestion}`);
  }
});

// /stats and /stat commands
bot.onText(/\/stats?/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📊 Your Stats*
🔄 This feature is coming soon!

Track your P&L, win rate, and bet history:
📊 https://alexbet-lite.netlify.app
  `, { parse_mode: 'Markdown' });
});

// /subscribe command - Now handled by whop-payment.js (registerPaymentHandlers)

// /lite command
bot.onText(/\/lite/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📊 *AlexBET Lite*

Track every bet with CLV analysis:

🔗 https://alexbet-lite.netlify.app

✅ Log entry odds when you place bet
✅ Update closing odds when game starts
✅ Track win rate & CLV
✅ Validate your edge

🎯 Target: 56-65% win rate + positive CLV
  `, { parse_mode: 'Markdown' });
});

// Store latest scan results per user (for export functionality)
const userLatestScans = {};

// Cleanup old scans every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Object.keys(userLatestScans).forEach(userId => {
    if (userLatestScans[userId].timestamp < oneHourAgo) {
      delete userLatestScans[userId];
    }
  });
}, 60 * 60 * 1000);

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
1. Visit https://alexbet-lite.netlify.app
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


// /bankroll command - Update user's betting bankroll
bot.onText(/\/bankroll\s*(\d+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const inlineAmount = match[1]; // Extract /bankroll 500
  
  const currentBankroll = userBankrolls[userId] && typeof userBankrolls[userId] === 'number' 
    ? userBankrolls[userId] 
    : 'Not set';
  
  // If amount provided inline (e.g., /bankroll 500)
  if (inlineAmount) {
    const validation = validateBankroll(inlineAmount);
    
    if (!validation.valid) {
      bot.sendMessage(chatId, validation.error);
      logger.warn('Invalid bankroll provided inline', { userId, input: inlineAmount, error: validation.error });
      return;
    }
    
    userBankrolls[userId] = validation.value;
    
    // Save to database
    try {
      await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
      const { error } = await supabaseClient.supabase
        .from('users')
        .update({ bankroll: validation.value, updated_at: new Date() })
        .eq('telegram_id', userId);
      
      if (!error) {
        logger.info('Bankroll set inline', { userId, bankroll: validation.value, chatId });
        bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value}\n\nNow use /scan to find gems!`);
      } else {
        logger.warn('Could not save bankroll to database:', error.message);
        bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value} (local only)\n\nNow use /scan to find gems!`);
      }
    } catch (err) {
      logger.warn('Error saving bankroll:', err.message);
      bot.sendMessage(chatId, `✅ Bankroll set to $${validation.value}\n\nNow use /scan to find gems!`);
    }
    return;
  }
  
  // No amount provided - ask for it
  bot.sendMessage(chatId, `
💰 *Update Your Bankroll*

Current bankroll: *$${currentBankroll}*

Please enter your new betting bankroll (minimum $1):
  `, { parse_mode: 'Markdown' });
  
  userBankrolls[userId] = 'awaiting_bankroll_update';
  logger.debug('Awaiting user bankroll update', { userId, chatId });
});

// Handle bankroll update
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Skip if this is a command
  if (msg.text && msg.text.startsWith('/')) {
    // Clear awaiting_bankroll_update state when a command is issued
    if (userBankrolls[userId] === 'awaiting_bankroll_update') {
      userBankrolls[userId] = 100; // Reset to default
    }
    return;
  }
  
  if (userBankrolls[userId] === 'awaiting_bankroll_update') {
    const validation = validateBankroll(msg.text);
    
    if (!validation.valid) {
      logger.warn('Invalid bankroll update received', {
        userId,
        input: msg.text,
        error: validation.error
      });
      bot.sendMessage(chatId, validation.error);
      return;
    }
    
    userBankrolls[userId] = validation.value;
    
    // Save updated bankroll to database
    try {
      const { error } = await supabaseClient.supabase
        .from('users')
        .update({ bankroll: validation.value, updated_at: new Date() })
        .eq('telegram_id', userId);
      
      if (!error) {
        logger.info('Bankroll updated by user', {
          userId,
          bankroll: validation.value,
          chatId
        });
        bot.sendMessage(chatId, `✅ Bankroll updated to $${validation.value}\\n\\nUse /scan to find gems!`);
      } else {
        logger.warn('Could not save bankroll to database:', error.message);
        bot.sendMessage(chatId, `✅ Bankroll updated to $${validation.value} (local only)`);
      }
    } catch (err) {
      logger.warn('Error updating bankroll:', err.message);
      bot.sendMessage(chatId, `✅ Bankroll updated to $${validation.value}`);
    }
  }
});

// TEST: Verify callbacks are reaching the bot at all
bot.on('callback_query', (query) => {
  console.log(`[TEST HANDLER] 🚀 CALLBACK REACHED TEST HANDLER!`);
  console.log(`[TEST HANDLER] Data: ${query.data}`);
  console.log(`[TEST HANDLER] User: ${query.from.id}`);
  // Don't return - let other handlers process
});

// UNIFIED CALLBACK QUERY HANDLER - Routes all callbacks based on prefix
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;
  
  console.log(`\n[HANDLER 2] ========================================`);
  console.log(`[HANDLER 2] Callback received!`);
  console.log(`[HANDLER 2] User ID: ${userId}`);
  console.log(`[HANDLER 2] Chat ID: ${chatId}`);
  console.log(`[HANDLER 2] Data: ${data}`);
  console.log(`[HANDLER 2] ========================================\n`);
  
  try {
    // ========== TIMEZONE CALLBACKS (tz_*) ==========
    if (data && data.startsWith('tz_')) {
      console.log(`[HANDLER 2] ✅ TIMEZONE CALLBACK MATCHED: ${data}`);
      
      try {
        console.log(`[TZ] About to answer callback query...`);
        // Answer immediately with loading indicator
        await bot.answerCallbackQuery(query.id, '⏳ Setting timezone...', false);
        console.log(`[TZ] ✅ Answered callback query`);
        
        // Send confirmation message  
        const tzName = data === 'tz_mst' ? 'MST (Denver)' : 
                       data === 'tz_est' ? 'EST (New York)' :
                       data === 'tz_cst' ? 'CST (Chicago)' :
                       data === 'tz_pst' ? 'PST (Los Angeles)' :
                       data === 'tz_akst' ? 'AKST (Alaska)' :
                       data === 'tz_hst' ? 'HST (Hawaii)' : data;
        
        console.log(`[TZ] About to send confirmation message to ${chatId}: ${tzName}`);
        await bot.sendMessage(chatId, `✅ **Timezone Set**\n\nYou are now using: **${tzName}**`);
        console.log(`[TZ] ✅ Sent confirmation message`);
      } catch (err) {
        console.error(`[TZ ERROR] Exception caught: ${err.message}`);
        console.error(`[TZ ERROR] Stack: ${err.stack}`);
        try {
          bot.answerCallbackQuery(query.id, '❌ Error: ' + err.message, true);
        } catch (e) {
          console.error(`[TZ ERROR] Failed to answer callback: ${e.message}`);
        }
      }
      return;
    }
  
  // ========== BANKROLL CALLBACKS (bankroll_*) ==========
  const bankrollMatch = data.match(/^bankroll_(\d+|custom)$/);
  if (bankrollMatch) {
    if (data === 'bankroll_custom') {
      bot.sendMessage(chatId, '💰 Please enter your custom bankroll amount (minimum $1):');
      userBankrolls[userId] = 'awaiting_bankroll';
      bot.answerCallbackQuery(query.id);
      return;
    }
    
    const amount = parseInt(bankrollMatch[1]);
    if (amount < 1) {
      bot.answerCallbackQuery(query.id, { text: '❌ Minimum bankroll is $1', show_alert: true });
      return;
    }
    
    userBankrolls[userId] = amount;
    
    try {
      await supabaseClient.upsertUser(userId, query.from.username || `user_${userId}`);
      await supabaseClient.supabase
        .from('users')
        .update({ bankroll: amount, updated_at: new Date() })
        .eq('telegram_id', userId);
      
      bot.editMessageText(`✅ Bankroll set to $${amount}\n\n🚀 Ready to find gems! Use /scan or tap below:`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Scan for Gems', callback_data: 'action_scan' }, { text: '📊 View Stats', callback_data: 'action_stats' }],
            [{ text: '⚙️ Settings', callback_data: 'action_settings' }, { text: '💎 Premium', callback_data: 'action_subscribe' }]
          ]
        }
      });
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: '✅ Bankroll set (local only)', show_alert: false });
    }
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // ========== ACTION CALLBACKS (action_*) ==========
  if (data === 'action_scan') {
    bot.answerCallbackQuery(query.id);
    // Action scan logic here (truncated for brevity)
    return;
  }
  
  if (data === 'whop_learn_more') {
    bot.sendMessage(chatId, `
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
    bot.answerCallbackQuery(query.id);
    return;
  }
  
    // Unknown callback
    console.log(`[UNKNOWN CALLBACK] ${data}`);
    bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error(`[CALLBACK ERROR] ${err.message}`);
    bot.answerCallbackQuery(query.id, { text: '❌ Error processing action', show_alert: true });
  }
});

// /timezone command (USA only)
bot.onText(/\/timezone/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Clear any pending bankroll state
  if (userBankrolls[userId] === 'awaiting_bankroll') {
    delete userBankrolls[userId];
  }
  
  console.log(`[/TIMEZONE] User ${userId} requested timezone selection`);
  
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

// /help command
// Export feature - CSV, JSON, PDF (Premium only)
bot.onText(/\/export/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    // Admins bypass subscription check
    if (!isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      
      if (!subscription.export) {
        bot.sendMessage(chatId, `❌ Export feature is premium only.\n\n/subscribe to unlock:\n  • Unlimited gems\n  • CSV/JSON/PDF export\n  • Full market access (Spreads, Totals)\n  • Advanced statistics`);
        return;
      }
    }
    
    // Ensure user exists in database
    await supabaseClient.upsertUser(userId, msg.from.username || `user_${userId}`);
    
    // Check if user has recent scan
    const userScans = userLatestScans[userId];
    if (!userScans || !userScans.gems || userScans.gems.length === 0) {
      bot.sendMessage(chatId, `❌ No recent scan found.\n\nRun /scan first, then export the results.`);
      return;
    }

    const message = `📊 Export Your Latest Scan\n\nYou have ${userScans.gems.length} gems from ${new Date(userScans.date).toLocaleString()}\n\nChoose format:\n\n/export_csv - Download as CSV (Excel)\n/export_txt - Download as TXT (readable)\n/export_json - Download as JSON (backup)`;
    bot.sendMessage(chatId, message);
  } catch (err) {
    logger.error('Error in /export:', err);
    bot.sendMessage(chatId, '❌ Error preparing export. Please try again.');
  }
});

// CSV export
bot.onText(/\/export_csv/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    // Check subscription (admins bypass)
    if (!isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      if (!subscription.export) {
        bot.sendMessage(chatId, `❌ CSV export is premium only.\n\n/subscribe to unlock CSV, JSON, and PDF exports`);
        return;
      }
    }
    
    // Check if user has recent scan
    const userScans = userLatestScans[userId];
    if (!userScans || !userScans.gems || userScans.gems.length === 0) {
      bot.sendMessage(chatId, `❌ No recent scan found.\n\nRun /scan first, then export.`);
      return;
    }

    // Apply gem limit (admins get all gems)
    let maxGems = 10;
    if (isAdmin(userId)) {
      maxGems = 9999; // Admins get unlimited
    } else {
      const subscription = await getSubscriptionDetails(userId);
      maxGems = subscription.gems || 10;
    }
    
    let gemsToExport = userScans.gems.slice(0, maxGems);
    if (userScans.gems.length > maxGems && !isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      bot.sendMessage(chatId, `⚠️ ${subscription.tier} tier limited to ${maxGems} gems. /subscribe for more`);
    }

    // Convert gems to export format
    const gems = gemsToExport.map(gem => ({
      sport: gem.sport || 'N/A',
      market: gem.betType || 'N/A',
      pick: gem.pick || 'N/A',
      odds: gem.odds || 'N/A',
      edge_percent: gem.edge ? gem.edge.toFixed(2) : 'N/A',
      ev_percent: gem.ev ? gem.ev.toFixed(2) : 'N/A',
      kelly_stake: gem.kelly || 'N/A',
      game: gem.game || 'N/A',
      game_date: gem.gameDate || 'N/A',
      game_time: gem.gameTime || 'N/A'
    }));

    // Create CSV
    const result = exportToCSV(gems, userId);
    
    // Send the actual file to Telegram using fs.createReadStream
    const fs = require('fs');
    const fileStream = fs.createReadStream(result.filepath);
    
    bot.sendDocument(chatId, fileStream, {
      caption: `📊 CSV Export\\n\\n📥 File: ${result.filename}\\n💾 Size: ${(result.size / 1024).toFixed(2)} KB\\n✅ ${result.gemsCount} gems exported`,
      filename: result.filename
    }, (err) => {
      if (err) {
        logger.error('Failed to send CSV file', { userId, error: err.message });
        bot.sendMessage(chatId, `❌ Failed to send file: ${err.message}`);
      } else {
        logger.info('CSV file sent to user', { userId, filename: result.filename });
      }
    });
  } catch (err) {
    logger.error('CSV export error', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Export failed: ${err.message}`);
  }
});

// TXT export
bot.onText(/\/export_txt/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    // Check subscription (admins bypass)
    if (!isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      if (!subscription.export) {
        bot.sendMessage(chatId, `❌ Text export is premium only.\n\n/subscribe to unlock CSV, JSON, and PDF exports`);
        return;
      }
    }
    
    // Check if user has recent scan
    const userScans = userLatestScans[userId];
    if (!userScans || !userScans.gems || userScans.gems.length === 0) {
      bot.sendMessage(chatId, `❌ No recent scan found.\n\nRun /scan first, then export.`);
      return;
    }

    // Apply gem limit (admins get all gems)
    let maxGems = 10;
    if (isAdmin(userId)) {
      maxGems = 9999; // Admins get unlimited
    } else {
      const subscription = await getSubscriptionDetails(userId);
      maxGems = subscription.gems || 10;
    }
    
    let gemsToExport = userScans.gems.slice(0, maxGems);
    if (userScans.gems.length > maxGems && !isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      bot.sendMessage(chatId, `⚠️ ${subscription.tier} tier limited to ${maxGems} gems. /subscribe for more`);
    }

    // Convert gems to export format
    const gems = gemsToExport.map(gem => ({
      sport: gem.sport || 'N/A',
      market: gem.betType || 'N/A',
      pick: gem.pick || 'N/A',
      odds: gem.odds || 'N/A',
      edge_percent: gem.edge ? gem.edge.toFixed(2) : 'N/A',
      ev_percent: gem.ev ? gem.ev.toFixed(2) : 'N/A',
      kelly_percent: gem.kelly ? (gem.kelly / 100).toFixed(2) : 'N/A',
      kelly_stake: gem.kelly || 'N/A',
      game: gem.game || 'N/A',
      game_time: gem.gameTime || 'N/A',
      best_book: gem.book || 'N/A',
      books_compared: 5
    }));

    // Create TXT
    const result = exportToTXT(gems, userId);
    
    // Send the actual file to Telegram using fs.createReadStream
    const fs = require('fs');
    const fileStream = fs.createReadStream(result.filepath);
    
    bot.sendDocument(chatId, fileStream, {
      caption: `📋 TXT Export\\n\\n📥 File: ${result.filename}\\n💾 Size: ${(result.size / 1024).toFixed(2)} KB\\n✅ ${result.gemsCount} gems exported`,
      filename: result.filename
    }, (err) => {
      if (err) {
        logger.error('Failed to send TXT file', { userId, error: err.message });
        bot.sendMessage(chatId, `❌ Failed to send file: ${err.message}`);
      } else {
        logger.info('TXT file sent to user', { userId, filename: result.filename });
      }
    });
  } catch (err) {
    logger.error('TXT export error', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Export failed: ${err.message}`);
  }
});

// JSON export
bot.onText(/\/export_json/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    // Check subscription (admins bypass)
    if (!isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      if (!subscription.export) {
        bot.sendMessage(chatId, `❌ JSON export is premium only.\n\n/subscribe to unlock CSV, JSON, and PDF exports`);
        return;
      }
    }
    
    // Check if user has recent scan
    const userScans = userLatestScans[userId];
    if (!userScans || !userScans.gems || userScans.gems.length === 0) {
      bot.sendMessage(chatId, `❌ No recent scan found.\n\nRun /scan first, then export.`);
      return;
    }

    // Apply gem limit (admins get all gems)
    let maxGems = 10;
    if (isAdmin(userId)) {
      maxGems = 9999; // Admins get unlimited
    } else {
      const subscription = await getSubscriptionDetails(userId);
      maxGems = subscription.gems || 10;
    }
    
    let gemsToExport = userScans.gems.slice(0, maxGems);
    if (userScans.gems.length > maxGems && !isAdmin(userId)) {
      const subscription = await getSubscriptionDetails(userId);
      bot.sendMessage(chatId, `⚠️ ${subscription.tier} tier limited to ${maxGems} gems. /subscribe for more`);
    }

    // Convert gems to export format
    const gems = gemsToExport.map(gem => ({
      sport: gem.sport || 'N/A',
      market: gem.betType || 'N/A',
      pick: gem.pick || 'N/A',
      odds: gem.odds || 'N/A',
      edge_percent: gem.edge ? gem.edge.toFixed(2) : 'N/A',
      ev_percent: gem.ev ? gem.ev.toFixed(2) : 'N/A',
      kelly_stake: gem.kelly || 'N/A',
      game: gem.game || 'N/A',
      game_date: gem.gameDate || 'N/A',
      game_time: gem.gameTime || 'N/A'
    }));

    // Create JSON
    const result = exportToJSON(gems, userId);
    
    // Send the actual file to Telegram using fs.createReadStream
    const fs = require('fs');
    const fileStream = fs.createReadStream(result.filepath);
    
    bot.sendDocument(chatId, fileStream, {
      caption: `📄 JSON Export\\n\\n📥 File: ${result.filename}\\n💾 Size: ${(result.size / 1024).toFixed(2)} KB\\n✅ ${result.gemsCount} gems exported (with metadata)`,
      filename: result.filename
    }, (err) => {
      if (err) {
        logger.error('Failed to send JSON file', { userId, error: err.message });
        bot.sendMessage(chatId, `❌ Failed to send file: ${err.message}`);
      } else {
        logger.info('JSON file sent to user', { userId, filename: result.filename });
      }
    });
  } catch (err) {
    logger.error('JSON export error', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Export failed: ${err.message}`);
  }
});

// /subscribe command - Now handled by whop-payment.js
// The registerPaymentHandlers() call above automatically registers this command
// Sell both: Bot access + Private channel on Whop

bot.onText(/\/status/, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    const subscriptionDetails = await getSubscriptionDetails(userId);
    
    let statusMsg = '📊 **Your Subscription Status**\n\n';
    
    if (subscriptionDetails.tier === 'free') {
      statusMsg += '**Status:** 🆓 Free Tier\n';
      statusMsg += '**Gems:** 3 per scan\n';
      statusMsg += '**Markets:** Moneyline only\n';
      statusMsg += '**Export:** Disabled\n\n';
      statusMsg += '💡 Upgrade for unlimited access:\n/subscribe';
    } else {
      statusMsg += `**Status:** ✅ ${subscriptionDetails.tier.toUpperCase()}\n`;
      statusMsg += `**Product:** ${subscriptionDetails.product_name}\n`;
      statusMsg += `**Gems:** ${subscriptionDetails.gems} per scan\n`;
      statusMsg += `**Markets:** ${subscriptionDetails.markets.join(', ')}\n`;
      statusMsg += `**Export:** ${subscriptionDetails.export ? '✅ Enabled' : '❌ Disabled'}\n`;
      
      if (subscriptionDetails.expires_at) {
        const expiryDate = new Date(subscriptionDetails.expires_at);
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        statusMsg += `**Expires:** ${expiryDate.toLocaleDateString()}\n`;
        
        if (daysLeft <= 7 && daysLeft > 0) {
          statusMsg += `\n⏰ _Renewal coming soon!_ (${daysLeft} days left)\n/subscribe to extend`;
        } else if (daysLeft <= 0) {
          statusMsg += '\n❌ _Subscription expired_\n/subscribe to renew';
        } else {
          statusMsg += `\n✅ Enjoy your premium access! (${daysLeft} days left)`;
        }
      } else {
        statusMsg += '\n✅ Lifetime access - No expiration';
      }
    }
    
    await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Error in /status command:', err);
    bot.sendMessage(msg.chat.id, '❌ Error checking status. Please try again.');
  }
});

// Handle callback queries
bot.on('callback_query', (query) => {
  if (query.data === 'whop_learn_more') {
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

// CATCH-ALL: Log any callback that reaches here (unhandled by previous handlers)
bot.on('callback_query', (query) => {
  console.log(`\n[CATCHALL CALLBACK] Unhandled callback reached catch-all handler`);
  console.log(`[CATCHALL CALLBACK] Data: ${query.data}`);
  console.log(`[CATCHALL CALLBACK] User: ${query.from.id}`);
  console.log(`[CATCHALL CALLBACK] This callback was NOT handled by any previous handler\n`);
  bot.answerCallbackQuery(query.id, '⚠️ Callback not handled', true);
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

❓ Didn't receive resources?
Email support@oddsifylabs.com

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
📊 AlexBET Sharp Bot - Command Menu

🔍 SCANNING
/scan - Find top +EV gems (free: 3 ML, paid: 10-30+)
/stats - View your performance stats

📥 EXPORT (Premium only)
/export - Export latest scan results
  ├─ /export_csv - Download as CSV (Excel)
  ├─ /export_txt - Download as readable text
  └─ /export_json - Download as JSON

⚙️  SETTINGS
/timezone - Set US timezone (EST, CST, MST, PST)
/bankroll - Set betting bankroll

💳 PREMIUM
/subscribe - View subscription tiers
/pricing - Detailed pricing & features

📖 HELP
/lite - Open AlexBET Lite tracker
/terms - Terms & Conditions
/support - Customer support
/paysupport - Payment issues
/help - This menu

💡 TIP: Run /scan first, then /export to download results!

📱 Full dashboard: https://alexbet-lite.netlify.app
⭐ Get premium: /subscribe
  `, { parse_mode: 'Markdown' });
});

// Cleanup expired subscriptions every hour
cron.schedule('0 * * * *', async () => {
  try {
    const result = await supabaseClient.cleanupExpiredSubscriptions();
    if (result && result.deletedCount > 0) {
      logger.info(`🧹 Cleanup: Expired ${result.deletedCount} subscriptions`);
    }
  } catch (err) {
    logger.error('Cleanup job failed:', err.message);
  }
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot running with Whop payment integration...');
console.log('📍 Subscribe: /subscribe');
console.log('🛒 Whop ready for payments');
