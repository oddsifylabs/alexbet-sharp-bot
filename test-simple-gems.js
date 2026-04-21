#!/usr/bin/env node

/**
 * SIMPLIFIED gem calculator - direct calculation, no outcome mapping
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

console.log('🎯 SIMPLIFIED GEM CALCULATOR\n');

const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const games = JSON.parse(data);
    let gemsFound = 0;

    games.slice(0, 2).forEach(game => {
      console.log(`\n${game.away_team} @ ${game.home_team}`);
      console.log('='.repeat(50));
      
      // Get all odds for this game across all books
      const allOdds = new Map(); // teamName -> [odds1, odds2, ...]
      
      game.bookmakers.forEach(book => {
        const market = book.markets.find(m => m.key === 'h2h');
        if (!market) return;
        
        market.outcomes.forEach(outcome => {
          if (!allOdds.has(outcome.name)) {
            allOdds.set(outcome.name, []);
          }
          allOdds.get(outcome.name).push(outcome.price);
        });
      });

      // Calculate for each team
      allOdds.forEach((odds, teamName) => {
        if (odds.length < 2) return; // Need 2+ books
        
        const probs = odds.map(americanToImpliedProb);
        const consensusProb = probs.reduce((a, b) => a + b) / probs.length;
        const bestPrice = Math.max(...odds); // Best = highest (less negative or more positive)
        const bestProb = americanToImpliedProb(bestPrice);
        const decimal = americanToDecimal(bestPrice);
        const ev = (consensusProb * decimal) - 1;
        
        const isGem = ev > 0.0001;
        
        if (isGem) {
          console.log(`✅ ${teamName}`);
          console.log(`   EV: ${(ev * 100).toFixed(4)}%`);
          console.log(`   Consensus: ${(consensusProb * 100).toFixed(2)}%`);
          console.log(`   Best: ${bestPrice} → ${(bestProb * 100).toFixed(2)}%`);
          console.log(`   Books: ${odds.length}`);
          gemsFound++;
        }
      });
    });

    console.log(`\n\n🎯 Total gems found: ${gemsFound}`);
  });
});
