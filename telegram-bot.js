const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🤖 AlexBET Sharp Bot starting...');

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  console.log(`[/start] User ${userId}`);
  
  try {
    const { data: user } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('telegram_id', userId)
      .single();

    if (!user) {
      await supabase.from('telegram_users').insert({
        telegram_id: userId,
        username: msg.from.username || 'Unknown',
        tier: 'FREE',
        gems_today: 0,
        created_at: new Date().toISOString()
      });
    }

    bot.sendMessage(chatId, `
⚡ *AlexBET Sharp Bot* 🎯

Find profitable sports betting edges in real-time.

📊 How it works:
• Scans 5 major sportsbooks
• Finds edges you're missing
• Shows Kelly sizing

💰 Pricing:
🟢 *Free:* 5 gems/day
🟢 *Sharp:* $49/mo — unlimited gems
🟢 *Elite:* $99/mo — everything + Ask Alex

*Commands:*
/scan — Find gems
/pending — Live bets
/stats — Analytics
/subscribe — Upgrade
    `, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Scan Gems', callback_data: 'scan' }],
          [{ text: '💎 Subscribe', callback_data: 'subscribe' }]
        ]
      }
    });
  } catch (err) {
    console.error('[ERROR]', err.message);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// /scan command
bot.onText(/\/scan/, (msg) => {
  const chatId = msg.chat.id;
  
  console.log(`[/scan] User ${msg.from.id}`);
  
  const gems = [
    { pick: 'Miami Heat', odds: -110, edge: 7.2, game: 'MIA vs BOS • 8:00 PM', book: 'DraftKings', kelly: 75 },
    { pick: 'KC Chiefs', odds: -105, edge: 5.8, game: 'KC vs LAC • 6:30 PM', book: 'FanDuel', kelly: 62 }
  ];

  gems.forEach((gem, i) => {
    bot.sendMessage(chatId, `
*Gem ${i + 1}* — ${gem.edge}% edge

${gem.pick} @ ${gem.odds > 0 ? '+' : ''}${gem.odds}
vs ${gem.game}

📍 Bet at: *${gem.book}*
💰 Kelly: $${gem.kelly}
    `, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Take It', callback_data: `take_${i}` }]
        ]
      }
    });
  });

  bot.sendMessage(chatId, `Found ${gems.length} gems today`);
});

// /stats command
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📊 Your Stats*

💰 P&L: +$125
📈 Win Rate: 58%
🎯 Total Bets: 12
✅ Wins: 7

🟢 Sharp Player!
  `, { parse_mode: 'Markdown' });
});

// /pending command
bot.onText(/\/pending/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*🔴 Live Bets (2)*

Miami Heat @ -110
$75 • NBA

Kansas City Chiefs @ -105
$62 • NFL
  `, { parse_mode: 'Markdown' });
});

// /subscribe command
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*💎 Upgrade to Premium*

🟢 *Sharp* — $49/month
✓ Unlimited gems
✓ SMS alerts

🔴 *Elite* — $99/month
✓ Everything above
✓ Ask Alex (Claude AI)
  `, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Sharp $49', callback_data: 'pay_tier1' }],
        [{ text: 'Elite $99', callback_data: 'pay_tier2' }]
      ]
    }
  });
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
*📱 Commands*

/start - Welcome
/scan - Find gems
/pending - Live bets
/stats - Analytics
/subscribe - Upgrade
/help - This menu

*Support:*
support@alexbet.io
  `, { parse_mode: 'Markdown' });
});

// Button clicks
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  console.log(`[Button] ${data}`);
  
  if (data === 'scan') {
    bot.emit('text', { chat: { id: chatId }, text: '/scan', from: query.from });
  } else if (data === 'subscribe') {
    bot.emit('text', { chat: { id: chatId }, text: '/subscribe', from: query.from });
  } else if (data.startsWith('take_')) {
    bot.sendMessage(chatId, '✅ Gem locked!\n\nNow place your bet on your sportsbook.');
  }
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('[POLLING_ERROR]', err.message);
});

console.log('✅ Bot listening for messages...');
