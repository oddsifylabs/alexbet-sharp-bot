#!/bin/bash
# Test the bot systematically

echo "========================================="
echo "AlexBET Sharp Bot - Systematic Testing"
echo "========================================="
echo ""

# Test 1: Syntax check
echo "TEST 1: Syntax validation..."
node -c telegram-bot.js 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Syntax valid"
else
  echo "❌ Syntax error"
  exit 1
fi
echo ""

# Test 2: Module imports
echo "TEST 2: Module imports..."
node -e "
const bot = require('node-telegram-bot-api');
const logger = require('./src/utils/logger');
const RateLimiter = require('./src/services/rateLimiter');
const { exportToCSV } = require('./src/utils/export-handler');
const { registerPaymentHandlers, getSubscriptionDetails } = require('./src/services/whop-payment');
console.log('✅ All modules imported successfully');
" 2>&1
if [ $? -eq 0 ]; then
  echo ""
else
  echo "❌ Module import failed"
  exit 1
fi
echo ""

# Test 3: Environment variables
echo "TEST 3: Environment variables..."
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "⚠️  TELEGRAM_BOT_TOKEN not set (will fail at runtime)"
else
  echo "✅ TELEGRAM_BOT_TOKEN is set"
fi

if [ -z "$WHOP_API_KEY" ]; then
  echo "⚠️  WHOP_API_KEY not set"
else
  echo "✅ WHOP_API_KEY is set"
fi
echo ""

# Test 4: Database connectivity (stub)
echo "TEST 4: Database connectivity..."
echo "⚠️  Skipped (requires live database)"
echo ""

# Summary
echo "========================================="
echo "✅ All syntax tests passed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Deploy to Railway: git push origin main"
echo "2. Test in Telegram manually"
echo "3. Monitor logs for errors"
echo ""
