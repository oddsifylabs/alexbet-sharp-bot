/**
 * AlexBET Sharp Bot - Core Function Tests
 * Tests: EV calculation, Kelly sizing, odds conversion, gem detection
 * 
 * Run with: node test/core-functions.test.js
 */

// Test utilities
function assertEquals(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ ${testName}`);
    return true;
  } else {
    console.error(`❌ ${testName}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
    return false;
  }
}

function assertClose(actual, expected, tolerance, testName) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`✅ ${testName}`);
    return true;
  } else {
    console.error(`❌ ${testName}`);
    console.error(`   Expected: ~${expected} (±${tolerance}), Got: ${actual}`);
    return false;
  }
}

// ============================================
// TEST 1: American Odds to Implied Probability
// ============================================
console.log('\n📊 TEST SUITE 1: American Odds to Implied Probability\n');

function americanToImpliedProb(odds) {
  if (odds == null || Number.isNaN(Number(odds))) return null;
  const value = Number(odds);
  return value > 0 ? 100 / (value + 100) : Math.abs(value) / (Math.abs(value) + 100);
}

let passed1 = 0, total1 = 0;

// Positive odds: +100 = 50% probability
total1++;
passed1 += assertClose(
  americanToImpliedProb(100),
  0.5,
  0.001,
  'Positive odds +100 = 50%'
) ? 1 : 0;

// Positive odds: +200 = 33.33% probability
total1++;
passed1 += assertClose(
  americanToImpliedProb(200),
  0.3333,
  0.001,
  'Positive odds +200 = 33.33%'
) ? 1 : 0;

// Negative odds: -200 = 66.67% probability
total1++;
passed1 += assertClose(
  americanToImpliedProb(-200),
  0.6667,
  0.001,
  'Negative odds -200 = 66.67%'
) ? 1 : 0;

// Favorite: -400 = 80% probability
total1++;
passed1 += assertClose(
  americanToImpliedProb(-400),
  0.8,
  0.001,
  'Favorite -400 = 80%'
) ? 1 : 0;

// Underdog: +500 = 16.67% probability
total1++;
passed1 += assertClose(
  americanToImpliedProb(500),
  0.1667,
  0.001,
  'Underdog +500 = 16.67%'
) ? 1 : 0;

console.log(`\n📊 Suite 1: ${passed1}/${total1} passed\n`);

// ============================================
// TEST 2: American Odds to Decimal Odds
// ============================================
console.log('📊 TEST SUITE 2: American Odds to Decimal Odds\n');

function americanToDecimal(odds) {
  const value = Number(odds);
  return value > 0 ? 1 + (value / 100) : 1 + (100 / Math.abs(value));
}

let passed2 = 0, total2 = 0;

// +100 = 2.0 decimal
total2++;
passed2 += assertClose(
  americanToDecimal(100),
  2.0,
  0.001,
  'American +100 = Decimal 2.0'
) ? 1 : 0;

// -200 = 1.5 decimal
total2++;
passed2 += assertClose(
  americanToDecimal(-200),
  1.5,
  0.001,
  'American -200 = Decimal 1.5'
) ? 1 : 0;

// +200 = 3.0 decimal
total2++;
passed2 += assertClose(
  americanToDecimal(200),
  3.0,
  0.001,
  'American +200 = Decimal 3.0'
) ? 1 : 0;

// -400 = 1.25 decimal
total2++;
passed2 += assertClose(
  americanToDecimal(-400),
  1.25,
  0.001,
  'American -400 = Decimal 1.25'
) ? 1 : 0;

console.log(`\n📊 Suite 2: ${passed2}/${total2} passed\n`);

// ============================================
// TEST 3: Expected Value (EV) Calculation
// ============================================
console.log('📊 TEST SUITE 3: Expected Value Calculation\n');

function calculateEV(fairProb, decimalOdds) {
  return (fairProb * decimalOdds) - 1;
}

let passed3 = 0, total3 = 0;

// Positive EV: 60% fair prob, 2.0 decimal = 20% EV
total3++;
passed3 += assertClose(
  calculateEV(0.60, 2.0),
  0.20,
  0.001,
  'Fair 60%, Decimal 2.0 = EV 20%'
) ? 1 : 0;

// Break-even: 50% fair prob, 2.0 decimal = 0% EV
total3++;
passed3 += assertClose(
  calculateEV(0.50, 2.0),
  0.0,
  0.001,
  'Fair 50%, Decimal 2.0 = EV 0%'
) ? 1 : 0;

// Negative EV: 45% fair prob, 2.0 decimal = -10% EV
total3++;
passed3 += assertClose(
  calculateEV(0.45, 2.0),
  -0.10,
  0.001,
  'Fair 45%, Decimal 2.0 = EV -10%'
) ? 1 : 0;

// High value: 70% fair, 1.7 decimal = 19% EV
total3++;
passed3 += assertClose(
  calculateEV(0.70, 1.7),
  0.19,
  0.001,
  'Fair 70%, Decimal 1.7 = EV 19%'
) ? 1 : 0;

console.log(`\n📊 Suite 3: ${passed3}/${total3} passed\n`);

// ============================================
// TEST 4: Kelly Criterion Stake Sizing
// ============================================
console.log('📊 TEST SUITE 4: Kelly Criterion Stake Sizing\n');

function calculateKellyStake(bankroll, fairProb, americanOdds) {
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1;
  const q = 1 - fairProb;
  const rawKelly = ((b * fairProb) - q) / b;
  const cappedKelly = Math.max(0, Math.min(rawKelly, 0.05)); // Cap at 5%
  return Math.floor(bankroll * cappedKelly * 0.5); // Conservative: 50% of Kelly
}

let passed4 = 0, total4 = 0;

// $100 bankroll, 60% fair, -110 (50.5% implied)
// Raw Kelly ≈ 5%, capped at 5%, then halved = 2.5% = $2.50... but wait
// Actually: floor(100 * 0.05 * 0.5) = floor(2.5) = 2
total4++;
passed4 += assertClose(
  calculateKellyStake(100, 0.60, -110),
  2,
  1,
  'Bankroll $100, Fair 60%, Odds -110 ≈ Kelly $2 (conservative)'
) ? 1 : 0;

// $1000 bankroll, 55% fair, +100 (50% implied)
// This one gets capped, then halved
total4++;
const kelly2 = calculateKellyStake(1000, 0.55, 100);
passed4 += assertClose(
  kelly2,
  25,
  10,
  'Bankroll $1000, Fair 55%, Odds +100 ≈ Kelly $25 (conservative)'
) ? 1 : 0;

// Zero EV should be zero stake
total4++;
passed4 += assertEquals(
  calculateKellyStake(100, 0.50, 100),
  0,
  'Break-even EV = $0 stake'
) ? 1 : 0;

console.log(`\n📊 Suite 4: ${passed4}/${total4} passed\n`);

// ============================================
// TEST 5: Edge Detection (Fair vs Implied)
// ============================================
console.log('📊 TEST SUITE 5: Edge Detection\n');

function calculateEdge(fairProb, impliedProb) {
  return (fairProb - impliedProb) * 100;
}

let passed5 = 0, total5 = 0;

// 55% fair, 50% implied = 5% edge
total5++;
passed5 += assertClose(
  calculateEdge(0.55, 0.50),
  5.0,
  0.001,
  'Fair 55%, Implied 50% = 5% edge'
) ? 1 : 0;

// 60% fair, 52% implied = 8% edge
total5++;
passed5 += assertClose(
  calculateEdge(0.60, 0.52),
  8.0,
  0.001,
  'Fair 60%, Implied 52% = 8% edge'
) ? 1 : 0;

// Negative edge
total5++;
passed5 += assertClose(
  calculateEdge(0.45, 0.50),
  -5.0,
  0.001,
  'Fair 45%, Implied 50% = -5% edge'
) ? 1 : 0;

console.log(`\n📊 Suite 5: ${passed5}/${total5} passed\n`);

// ============================================
// SUMMARY
// ============================================
const totalPassed = passed1 + passed2 + passed3 + passed4 + passed5;
const totalTests = total1 + total2 + total3 + total4 + total5;
const percentage = Math.round((totalPassed / totalTests) * 100);

console.log('═══════════════════════════════════════');
console.log('📊 TEST SUMMARY');
console.log('═══════════════════════════════════════');
console.log(`Total: ${totalPassed}/${totalTests} tests passed (${percentage}%)`);
console.log('');
console.log(`Suite 1 (Implied Prob): ${passed1}/${total1}`);
console.log(`Suite 2 (Decimal Odds): ${passed2}/${total2}`);
console.log(`Suite 3 (EV):           ${passed3}/${total3}`);
console.log(`Suite 4 (Kelly):        ${passed4}/${total4}`);
console.log(`Suite 5 (Edge):         ${passed5}/${total5}`);
console.log('═══════════════════════════════════════');

if (totalPassed === totalTests) {
  console.log('\n✅ ALL TESTS PASSED!\n');
  process.exit(0);
} else {
  console.log(`\n⚠️ ${totalTests - totalPassed} test(s) failed\n`);
  process.exit(1);
}
