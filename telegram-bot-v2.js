/**
 * AlexBET Sharp Bot - Rebuilt Module by Module
 * Start: Phase 1 - Core Bot + Admin System
 * 
 * This version is rebuilt clean with proper logging and error handling
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const logger = require('./src/utils/logger');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN not found in .env');
}

// Initialize bot
const bot = new TelegramBot(token, { polling: true });
logger.info('🤖 AlexBET Sharp Bot initialized');

// ====================================
// PHASE 1: ADMIN SYSTEM
// ====================================

// Admin list
const ADMIN_IDS = [8502906149]; // Jesse Collins

function isAdmin(userId) {
  const result = ADMIN_IDS.includes(userId);
  logger.debug(`isAdmin check`, { userId, isAdmin: result });
  return result;
}

// ====================================
// PHASE 1: CORE COMMANDS
// ====================================

/**
 * /start - Initialize bot
 * Tests: Bot responds, shows welcome message
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.first_name || msg.from.username || `User_${userId}`;
  
  logger.info('/start command received', { userId, username, chatId });
  
  try {
    let welcomeText = `👋 Welcome to AlexBET Sharp!\n\n`;
    
    // Check if admin
    if (isAdmin(userId)) {
      welcomeText += `🔐 **ADMIN MODE** - Unlimited access\n\n`;
    }
    
    welcomeText += `📊 Find arbitrage opportunities in sports betting\n\n`;
    welcomeText += `**Quick Start:**\n`;
    welcomeText += `/scan - Find gems now\n`;
    welcomeText += `/stats - View your performance\n`;
    welcomeText += `/export - Download your bets\n`;
    welcomeText += `/help - All commands\n\n`;
    
    welcomeText += `💬 Community: https://t.me/testudolegio`;
    
    bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
    logger.info('/start completed successfully', { userId });
    
  } catch (err) {
    logger.error('/start command failed', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

/**
 * /help - Show all commands
 * Tests: Lists all commands
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  logger.info('/help command received', { userId });
  
  try {
    let helpText = `**AlexBET Sharp Commands**\n\n`;
    helpText += `📊 **Core Commands**\n`;
    helpText += `/scan - Find gems (5 per sport × markets)\n`;
    helpText += `/stats - Your performance stats\n`;
    helpText += `/export - Download bets (CSV/JSON/TXT)\n`;
    helpText += `/help - This message\n\n`;
    
    helpText += `⚙️ **Settings**\n`;
    helpText += `/timezone - Set US timezone\n`;
    helpText += `/bankroll - Set your bankroll\n\n`;
    
    helpText += `💳 **Premium**\n`;
    helpText += `/subscribe - Upgrade subscription\n`;
    helpText += `/status - Check subscription status\n`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    logger.info('/help completed successfully', { userId });
    
  } catch (err) {
    logger.error('/help command failed', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

/**
 * /scan - Find gems
 * Tests: Returns gem data, respects subscription, admins get unlimited
 */
bot.onText(/\/scan/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  logger.info('/scan command received', { userId, isAdmin: isAdmin(userId) });
  
  try {
    bot.sendMessage(chatId, '🔄 Scanning for gems...');
    
    // PHASE 3: Subscription check (stubbed for now)
    let subscription = {
      tier: isAdmin(userId) ? 'admin' : 'free',
      gems: isAdmin(userId) ? 9999 : 3,
      markets: isAdmin(userId) ? ['moneyline', 'spreads', 'totals'] : ['moneyline'],
      export: isAdmin(userId)
    };
    
    logger.debug('/scan subscription loaded', { userId, subscription });
    
    // Stub response
    let scanText = `🎯 **Top Gems Found**\n\n`;
    scanText += `Tier: ${subscription.tier}\n`;
    scanText += `Gems available: ${subscription.gems}\n`;
    scanText += `Markets: ${subscription.markets.join(', ')}\n`;
    
    if (!isAdmin(userId)) {
      scanText += `\n💡 /subscribe for unlimited gems`;
    }
    
    bot.sendMessage(chatId, scanText, { parse_mode: 'Markdown' });
    logger.info('/scan completed successfully', { userId, gemsCount: subscription.gems });
    
  } catch (err) {
    logger.error('/scan command failed', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

/**
 * /export - Export bets
 * Tests: Admin can export, free users see upgrade message
 */
bot.onText(/\/export/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  logger.info('/export command received', { userId, isAdmin: isAdmin(userId) });
  
  try {
    // Admin bypass
    if (isAdmin(userId)) {
      logger.info('/export - Admin access granted', { userId });
      bot.sendMessage(chatId, `📥 **Export Your Gems**\n\n/export_csv - Excel format\n/export_json - JSON format\n/export_txt - Text format`);
      return;
    }
    
    // Non-admin: check subscription
    logger.info('/export - Non-admin, checking subscription', { userId });
    bot.sendMessage(chatId, `❌ Export is premium only\n\n/subscribe to unlock:\n  • Unlimited gems\n  • CSV/JSON/TXT export\n  • All markets`);
    
  } catch (err) {
    logger.error('/export command failed', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

/**
 * /status - Check subscription
 * Tests: Shows subscription tier
 */
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  logger.info('/status command received', { userId });
  
  try {
    if (isAdmin(userId)) {
      bot.sendMessage(chatId, `✅ **Admin Access**\n\nTier: Admin\nGems: Unlimited\nExport: Enabled\nAll features unlocked`);
    } else {
      bot.sendMessage(chatId, `📊 **Free Tier**\n\nGems: 3\nMarkets: Moneyline\nExport: Disabled\n\n/subscribe to upgrade`);
    }
    logger.info('/status completed successfully', { userId });
    
  } catch (err) {
    logger.error('/status command failed', { userId, error: err.message });
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ====================================
// ERROR HANDLING
// ====================================

bot.on('polling_error', (err) => {
  logger.error('Polling error', { error: err.message });
});

bot.on('error', (err) => {
  logger.error('Bot error', { error: err.message });
});

// ====================================
// STARTUP
// ====================================

console.log('✅ AlexBET Sharp Bot running...');
console.log(`   Admin users: ${ADMIN_IDS.length}`);
console.log(`   Ready for testing`);

module.exports = { bot, isAdmin };
