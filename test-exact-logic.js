#!/usr/bin/env node

/**
 * Test with EXACT code logic from telegram-bot.js
 */

const https = require('https');

const ODDS_API_KEY = '6f46bbb3b2fb69b5e14980a57e9909da';

function americanToImpliedProb(odds) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function americanToDecimal(odds) {
  if (odds > 0) return (odds / 100) + 1;
  return (100 / Math.abs(odds)) + 1;
}

function getOutcomeKey(outcome, market) {
  if (market === 'spreads' || market === 'totals') {
    return `${outcome.name}|${outcome.point ?? ''}`;
  }
  return `${outcome.name}`;
}

console.log('🎯 TEST WITH EXACT BOT LOGIC (bookmakers Set)\n');

const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const games = JSON.parse(data);
    let gemsCount = 0;

    games.slice(0, 1).forEach(game => {
      console.log(`\n${game.away_team} @ ${game.home_team}`);
      console.log('='.repeat(60));
      
      const bookmakers = game.bookmakers || [];
      if (bookmakers.length === 0) {
        console.log('No bookmakers!');
        return;
      }
      
      const market = 'h2h';
      const outcomeMap = new Map();
      
      let processedBooks = 0;

      // EXACT CODE FROM BOT
      bookmakers.forEach(bookmaker => {
        const bookMarket = (bookmaker.markets || []).find(m => m.key === market);
        const outcomes = bookMarket?.outcomes || [];
        if (outcomes.length < 2) {
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
            bookmakers: new Set(),  // ✅ EXACT FROM BOT
            bestPrice: null,
            bestBook: null
          };

          existing.impliedProbs.push(impliedProb);
          existing.bookmakers.add(bookmaker.title);  // ✅ EXACT FROM BOT

          if (existing.bestPrice == null || Number(outcome.price) > existing.bestPrice) {
            existing.bestPrice = Number(outcome.price);
            existing.bestBook = bookmaker.title;
          }

          outcomeMap.set(key, existing);
        });
      });

      console.log(`Processed ${processedBooks}/${bookmakers.length} books`);
      console.log(`Outcome map size: ${outcomeMap.size}\n`);

      // EXACT FILTER FROM BOT
      let filteredCount = 0;
      outcomeMap.forEach(({ outcome, impliedProbs, bestPrice, bestBook, bookmakers }) => {
        const books = bookmakers.size;  // ✅ EXACT FROM BOT
        
        console.log(`  ${outcome.name}:`);
        console.log(`    - Implied probs: ${impliedProbs.length}`);
        console.log(`    - Best price: ${bestPrice}`);
        console.log(`    - Books count: ${books}`);
        
        if (!impliedProbs.length || bestPrice == null || books < 2) {
          console.log(`    ❌ FILTERED OUT (Probs=${impliedProbs.length} Price=${bestPrice} Books=${books})`);
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

        const isValid = Number.isFinite(ev) && Number.isFinite(edge) && ev > 0.0001;
        
        console.log(`    ✅ EV: ${(ev * 100).toFixed(4)}% | Edge: ${edge.toFixed(3)}% | Valid: ${isValid}`);
        
        if (isValid) {
          gemsCount++;
        }
      });
      
      console.log(`\nFiltered outcomes: ${filteredCount}`);
    });

    console.log(`\n\n🎯 Total gems created: ${gemsCount}`);
  });
});
