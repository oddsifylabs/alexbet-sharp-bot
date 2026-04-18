/**
 * Unit tests for validation utilities
 * Run with: npm test
 */

const assert = require('assert');
const { validateBankroll, validateTimezone, parseAPIResponse } = require('../src/utils/validation');

console.log('🧪 Running validation tests...\n');

// Test suite 1: validateBankroll
console.log('TEST SUITE 1: validateBankroll()');
console.log('─'.repeat(50));

const testCases = [
  { input: '100', expected: { valid: true, value: 100 }, desc: 'Valid: 100' },
  { input: '50', expected: { valid: true, value: 50 }, desc: 'Valid: minimum (50)' },
  { input: '1000000', expected: { valid: true, value: 1000000 }, desc: 'Valid: maximum (1M)' },
  { input: 'abc', expected: { valid: false }, desc: 'Invalid: non-numeric' },
  { input: '25', expected: { valid: false }, desc: 'Invalid: below minimum' },
  { input: '5000000', expected: { valid: false }, desc: 'Invalid: above maximum' }
];

let passed = 0;
let failed = 0;

testCases.forEach(tc => {
  const result = validateBankroll(tc.input);
  const isValid = result.valid === tc.expected.valid &&
    (tc.expected.value === undefined || result.value === tc.expected.value);
  
  if (isValid) {
    console.log(`✅ ${tc.desc}`);
    passed++;
  } else {
    console.log(`❌ ${tc.desc}`);
    console.log(`   Got: ${JSON.stringify(result)}`);
    console.log(`   Expected valid=${tc.expected.valid}, value=${tc.expected.value}`);
    failed++;
  }
});

console.log(`\nResults: ${passed}/${testCases.length} passed\n`);

// Test suite 2: validateTimezone
console.log('TEST SUITE 2: validateTimezone()');
console.log('─'.repeat(50));

const tzTests = [
  { input: 'America/New_York', expected: true, desc: 'Valid: America/New_York' },
  { input: 'America/Los_Angeles', expected: true, desc: 'Valid: America/Los_Angeles' },
  { input: 'UTC', expected: true, desc: 'Valid: UTC' },
  { input: 'Invalid/Zone', expected: false, desc: 'Invalid: Invalid/Zone' },
  { input: 'Europe/London', expected: false, desc: 'Invalid: Non-US timezone' }
];

let tzPassed = 0;
let tzFailed = 0;

tzTests.forEach(tz => {
  const result = validateTimezone(tz.input);
  if ((result.valid === tz.expected)) {
    console.log(`✅ ${tz.desc}`);
    tzPassed++;
  } else {
    console.log(`❌ ${tz.desc}`);
    console.log(`   Got: ${result.valid}, Expected: ${tz.expected}`);
    tzFailed++;
  }
});

console.log(`\nResults: ${tzPassed}/${tzTests.length} passed\n`);

// Test suite 3: parseAPIResponse
console.log('TEST SUITE 3: parseAPIResponse()');
console.log('─'.repeat(50));

const jsonTests = [
  {
    name: 'Valid empty response',
    data: '[]',
    sport: 'nba',
    market: 'h2h',
    expectedGames: 0
  },
  {
    name: 'Valid games response',
    data: JSON.stringify([
      { id: '1', home_team: 'Team A', away_team: 'Team B', commence_time: '2024-04-18T20:00Z', bookmakers: [] }
    ]),
    sport: 'nba',
    market: 'h2h',
    expectedGames: 1
  },
  {
    name: 'Empty string',
    data: '',
    sport: 'nba',
    market: 'h2h',
    expectedGames: 0
  },
  {
    name: 'Invalid JSON',
    data: '{not valid json}',
    sport: 'nba',
    market: 'h2h',
    shouldFail: true
  }
];

let jsonPassed = 0;
let jsonFailed = 0;

jsonTests.forEach(jt => {
  const result = parseAPIResponse(jt.data, jt.sport, jt.market);
  
  if (jt.shouldFail) {
    if (!result.success) {
      console.log(`✅ ${jt.name}`);
      jsonPassed++;
    } else {
      console.log(`❌ ${jt.name} - should have failed`);
      jsonFailed++;
    }
  } else {
    if (result.success && result.games && result.games.length === jt.expectedGames) {
      console.log(`✅ ${jt.name}`);
      jsonPassed++;
    } else {
      console.log(`❌ ${jt.name}`);
      console.log(`   Expected ${jt.expectedGames} games, got ${result.games?.length || 0}`);
      jsonFailed++;
    }
  }
});

console.log(`\nResults: ${jsonPassed}/${jsonTests.length} passed\n`);

// Summary
const totalPassed = passed + tzPassed + jsonPassed;
const totalTests = testCases.length + tzTests.length + jsonTests.length;

console.log('═'.repeat(50));
console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed`);
console.log('═'.repeat(50));

if (totalPassed === totalTests) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log(`❌ ${totalTests - totalPassed} test(s) failed`);
  process.exit(1);
}
