#!/usr/bin/env node

/**
 * Test gem calculation with REAL API data from Odds API
 */

const https = require('https');

const ODDS_API_KEY = process.env.ODDS_API_KEY || '6f46bbb3b2fb69b5e14980a57e9909da';

// American to implied prob
function americanToImpliedProb(americanOdds) {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

// American to decimal
function americanToDecimal(americanOdds) {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

console.log('🔍 Testing Real Gem Calculation with Odds API Data\n');

// Fetch NBA games from Odds API
const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const games = JSON.parse(data);
      if (!Array.isArray(games) || games.length === 0) {
        console.log('❌ No games from API');
        return;
      }

      console.log(`✅ Got ${games.length} games from Odds API\n`);

      const game = games[0];
      const bookmakers = game.bookmakers || [];
      
      console.log(`Game: ${game.away_team} @ ${game.home_team}`);
      console.log(`Bookmakers: ${bookmakers.length}\n`);

      // For each team, collect odds and calculate
      const teams = new Map();

      bookmakers.forEach(bm => {
        const market = (bm.markets || []).find(m => m.key === 'h2h');
        if (!market) return;
        
        const outcomes = market.outcomes || [];
        outcomes.forEach(outcome => {
          const key = outcome.name;
          if (!teams.has(key)) {
            teams.set(key, {
              name: key,
              probs: [],
              bestPrice: null,
              bestBook: null,
              books: 0
            });
          }
          
          const team = teams.get(key);
          const prob = americanToImpliedProb(outcome.price);
          team.probs.push(prob);
          team.books += 1;
          
          if (team.bestPrice == null || outcome.price > team.bestPrice) {
            team.bestPrice = outcome.price;
            team.bestBook = bm.title;
          }
        });
      });

      console.log('📊 Analysis per team:\n');

      teams.forEach((team, teamName) => {
        const consensusProb = team.probs.reduce((a, b) => a + b, 0) / team.probs.length;
        const bestOddsProb = americanToImpliedProb(team.bestPrice);
        const edge = (consensusProb - bestOddsProb) * 100;
        const decimalOdds = americanToDecimal(team.bestPrice);
        const ev = (consensusProb * decimalOdds) - 1;

        console.log(`Team: ${teamName}`);
        console.log(`  Consensus Prob: ${(consensusProb * 100).toFixed(2)}%`);
        console.log(`  Best Price: ${team.bestPrice} @ ${team.bestBook}`);
        console.log(`  Best Odds Prob: ${(bestOddsProb * 100).toFixed(2)}%`);
        console.log(`  Edge: ${edge.toFixed(3)}%`);
        console.log(`  EV: ${(ev * 100).toFixed(4)}%`);
        console.log(`  Books: ${team.books}`);
        
        const isGem = ev > 0.0001 && Number.isFinite(ev) && Number.isFinite(edge) && team.books >= 2;
        console.log(`  📍 Would create gem? ${isGem ? '✅ YES' : '❌ NO'}\n`);
      });

    } catch (err) {
      console.error('Error:', err.message);
    }
  });
}).on('error', err => {
  console.error('API Error:', err.message);
});
