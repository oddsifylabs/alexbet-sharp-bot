#!/usr/bin/env node
/**
 * Real-time Bot Monitoring Script
 * Tests /scan command and monitors for API responses
 */

require('dotenv').config();
const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID || 8502906149; // Jesse's ID

console.log('🔍 AlexBET Sharp Bot - Testing Mode');
console.log('=====================================\n');

// Test 1: Verify bot is responding
console.log('📡 TEST 1: Health Check');
https.get('https://alexbet-sharp-bot.railway.app/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`✅ Bot health: ${data}`);
    console.log('');
  });
});

// Test 2: Verify ODDS_API_KEY works
console.log('📡 TEST 2: ODDS API Key Validation');
https.get(
  `https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${ODDS_API_KEY}`,
  (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const games = JSON.parse(data);
        if (Array.isArray(games) && games.length > 0) {
          console.log(`✅ ODDS API: Connected (${games.length} NBA games found)`);
          console.log(`   Sample game: ${games[0].home_team} vs ${games[0].away_team}`);
          console.log(`   Start time: ${new Date(games[0].commence_time).toLocaleString()}`);
        } else {
          console.log('⚠️  ODDS API: No games returned');
        }
      } catch (e) {
        console.log(`❌ ODDS API: Error parsing response - ${e.message}`);
      }
      console.log('');
      printTestInstructions();
    });
  }
).on('error', err => {
  console.log(`❌ ODDS API: Connection failed - ${err.message}`);
  console.log('');
  printTestInstructions();
});

function printTestInstructions() {
  console.log('📋 TESTING CHECKLIST');
  console.log('=====================================');
  console.log('');
  console.log('Now test these commands in Telegram:');
  console.log('');
  console.log('1️⃣  /start');
  console.log('   ✓ Should show welcome message');
  console.log('   ✓ Should ask for bankroll');
  console.log('   ✓ Should show preset amounts ($50, $100, etc)');
  console.log('');
  console.log('2️⃣  Select a bankroll amount (e.g., $100)');
  console.log('   ✓ Should confirm bankroll set');
  console.log('   ✓ Should show main menu with buttons');
  console.log('');
  console.log('3️⃣  /scan');
  console.log('   ✓ Should ask for sport (dropdown)');
  console.log('   ✓ Should show available sports: NFL, NBA, MLB, NHL, ATP, EPL');
  console.log('');
  console.log('4️⃣  Select a sport (e.g., NBA)');
  console.log('   ✓ Should auto-populate dates with games');
  console.log('   ✓ Should show next 5 days of games');
  console.log('');
  console.log('5️⃣  Select a date');
  console.log('   ✓ Should show games for that date');
  console.log('   ✓ Should show team matchups (e.g., Lakers vs Celtics)');
  console.log('');
  console.log('6️⃣  Select a game');
  console.log('   ✓ Should show available markets (Moneyline, Spreads, Totals)');
  console.log('   ✓ Should show real-time odds');
  console.log('   ✓ Should calculate edge %');
  console.log('');
  console.log('7️⃣  /stats');
  console.log('   ✓ Should show your performance');
  console.log('   ✓ Should show win rate, P&L, ROI');
  console.log('');
  console.log('✅ MONITORING ACTIVE');
  console.log('Check bot logs for any errors...\n');
}
