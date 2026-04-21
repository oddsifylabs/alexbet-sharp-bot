#!/usr/bin/env node

/**
 * Test gem calculation with real API data
 */

// Convert American odds to implied probability
function americanToImpliedProb(americanOdds) {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

// Convert American odds to decimal
function americanToDecimal(americanOdds) {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

// Sample game from API
const game = {
  home_team: "Boston Celtics",
  away_team: "Philadelphia 76ers",
  bookmakers: [
    { title: "DraftKings", price: -850 },
    { title: "BetRivers", price: -1000 },
    { title: "BetMGM", price: -900 },
    { title: "FanDuel", price: -1100 },
    { title: "LowVig.ag", price: -834 },
    { title: "BetOnline.ag", price: -850 },
    { title: "Caesars", price: -1000 },
    { title: "Fanatics", price: -900 },
    { title: "Bovada", price: -950 },
    { title: "MyBookie.ag", price: -1111 },
    { title: "BetUS", price: -950 }
  ]
};

console.log('🔍 Testing Gem Calculation');
console.log('=============================================\n');

console.log(`Game: ${game.away_team} @ ${game.home_team}`);
console.log(`Bookmakers: ${game.bookmakers.length}\n`);

// Calculate implied probabilities
const impliedProbs = game.bookmakers.map(b => americanToImpliedProb(b.price));
console.log('Implied Probabilities (by bookmaker):');
game.bookmakers.forEach((b, i) => {
  console.log(`  ${b.title.padEnd(15)}: ${b.price.toString().padEnd(6)} → ${(impliedProbs[i] * 100).toFixed(2)}%`);
});

// Calculate consensus (average)
const consensusProb = impliedProbs.reduce((a, b) => a + b, 0) / impliedProbs.length;
console.log(`\n📊 Consensus Probability: ${(consensusProb * 100).toFixed(2)}%`);

// Find best price (lowest for favorite)
const bestPrice = Math.max(...game.bookmakers.map(b => b.price)); // Highest negative = best for favorite
const bestOddsImpliedProb = americanToImpliedProb(bestPrice);
console.log(`💰 Best Price: ${bestPrice} (${(bestOddsImpliedProb * 100).toFixed(2)}%)`);

// Calculate edge
const edge = (consensusProb - bestOddsImpliedProb) * 100;
console.log(`\n✨ Edge Calculation:`);
console.log(`  Consensus (${(consensusProb * 100).toFixed(2)}%) - Best Odds (${(bestOddsImpliedProb * 100).toFixed(2)}%)`);
console.log(`  = ${edge.toFixed(2)}%`);

// Calculate EV
const decimalOdds = americanToDecimal(bestPrice);
const ev = (consensusProb * decimalOdds) - 1;
console.log(`\n📈 EV Calculation:`);
console.log(`  Decimal odds: ${decimalOdds.toFixed(3)}`);
console.log(`  EV = (Consensus × Decimal) - 1`);
console.log(`  EV = (${consensusProb.toFixed(4)} × ${decimalOdds.toFixed(3)}) - 1`);
console.log(`  EV = ${(ev * 100).toFixed(2)}%`);

console.log(`\n✅ Would this create a gem?`);
console.log(`  Edge > 0.5%? ${edge > 0.5 ? '✅ YES' : '❌ NO'} (current: ${edge.toFixed(2)}%)`);
console.log(`  EV > 1%? ${(ev * 100) > 1 ? '✅ YES' : '❌ NO'} (current: ${(ev * 100).toFixed(2)}%)`);
console.log(`  EV > 0.01? ${ev > 0.01 ? '✅ YES' : '❌ NO'} (current: ${ev.toFixed(4)})`);

console.log('\n🔴 Current issue: Edge is positive but very small');
console.log('The consensus is barely different from best odds');
console.log('This means books are efficiently priced');
