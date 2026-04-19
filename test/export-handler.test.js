const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { exportToCSV, exportToTXT, exportToJSON, EXPORTS_DIR } = require('../src/utils/export-handler');

// Test data - mock gems from scan results
const testGems = [
  {
    sport: 'NFL',
    market: 'Moneyline',
    pick: 'Kansas City Chiefs ML',
    odds: -110,
    edge: 5.25,
    ev: 4.77,
    kelly: 2.5,
    game: 'Kansas City Chiefs vs Pittsburgh Steelers',
    gameTime: '20:20 ET'
  },
  {
    sport: 'NBA',
    market: 'Spread',
    pick: 'Boston Celtics -5.5',
    odds: -105,
    edge: 3.75,
    ev: 3.57,
    kelly: 1.8,
    game: 'Boston Celtics vs Miami Heat',
    gameTime: '19:30 ET'
  },
  {
    sport: 'MLB',
    market: 'Total',
    pick: 'Over 8.5',
    odds: -110,
    edge: 2.10,
    ev: 1.90,
    kelly: 0.95,
    game: 'New York Mets vs Atlanta Braves',
    gameTime: '19:10 ET'
  }
];

const userId = 12345;

console.log('\n🧪 Testing Export Handler Functions\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: CSV Export
console.log('TEST 1: CSV Export');
try {
  const csvResult = exportToCSV(testGems, userId);
  
  assert(csvResult.filename, 'CSV filename should exist');
  assert(csvResult.filepath, 'CSV filepath should exist');
  assert(csvResult.size > 0, 'CSV file should have content');
  assert(csvResult.gemsCount === 3, 'Should export 3 gems');
  assert(csvResult.format === 'csv', 'Format should be csv');
  
  // Check file exists
  assert(fs.existsSync(csvResult.filepath), 'CSV file should exist on disk');
  
  // Check content
  const csvContent = fs.readFileSync(csvResult.filepath, 'utf8');
  assert(csvContent.includes('NFL'), 'CSV should contain sport');
  assert(csvContent.includes('Moneyline'), 'CSV should contain market');
  assert(csvContent.includes('5.25'), 'CSV should contain edge %');
  
  console.log(`  ✅ CSV export successful`);
  console.log(`     File: ${csvResult.filename}`);
  console.log(`     Size: ${(csvResult.size / 1024).toFixed(2)} KB`);
  console.log(`     Gems: ${csvResult.gemsCount}\n`);
} catch (err) {
  console.error(`  ❌ CSV export failed: ${err.message}\n`);
  process.exit(1);
}

// Test 2: TXT Export
console.log('TEST 2: TXT Export');
try {
  const txtResult = exportToTXT(testGems, userId);
  
  assert(txtResult.filename, 'TXT filename should exist');
  assert(txtResult.filepath, 'TXT filepath should exist');
  assert(txtResult.size > 0, 'TXT file should have content');
  assert(txtResult.gemsCount === 3, 'Should export 3 gems');
  assert(txtResult.format === 'txt', 'Format should be txt');
  
  // Check file exists
  assert(fs.existsSync(txtResult.filepath), 'TXT file should exist on disk');
  
  // Check content
  const txtContent = fs.readFileSync(txtResult.filepath, 'utf8');
  assert(txtContent.includes('AlexBET'), 'TXT should have header');
  assert(txtContent.includes('#1'), 'TXT should have rankings');
  assert(txtContent.includes('NFL'), 'TXT should contain sport');
  assert(txtContent.includes('Kansas City'), 'TXT should contain pick');
  
  console.log(`  ✅ TXT export successful`);
  console.log(`     File: ${txtResult.filename}`);
  console.log(`     Size: ${(txtResult.size / 1024).toFixed(2)} KB`);
  console.log(`     Gems: ${txtResult.gemsCount}\n`);
} catch (err) {
  console.error(`  ❌ TXT export failed: ${err.message}\n`);
  process.exit(1);
}

// Test 3: JSON Export
console.log('TEST 3: JSON Export');
try {
  const jsonResult = exportToJSON(testGems, userId);
  
  assert(jsonResult.filename, 'JSON filename should exist');
  assert(jsonResult.filepath, 'JSON filepath should exist');
  assert(jsonResult.size > 0, 'JSON file should have content');
  assert(jsonResult.gemsCount === 3, 'Should export 3 gems');
  assert(jsonResult.format === 'json', 'Format should be json');
  
  // Check file exists
  assert(fs.existsSync(jsonResult.filepath), 'JSON file should exist on disk');
  
  // Check content
  const jsonContent = fs.readFileSync(jsonResult.filepath, 'utf8');
  const parsed = JSON.parse(jsonContent);
  assert(parsed.metadata, 'JSON should have metadata');
  assert(parsed.gems.length === 3, 'JSON should have 3 gems');
  assert(parsed.summary, 'JSON should have summary');
  assert(parsed.summary.totalGemsFound === 3, 'Summary should show 3 gems');
  
  console.log(`  ✅ JSON export successful`);
  console.log(`     File: ${jsonResult.filename}`);
  console.log(`     Size: ${(jsonResult.size / 1024).toFixed(2)} KB`);
  console.log(`     Gems: ${jsonResult.gemsCount}\n`);
} catch (err) {
  console.error(`  ❌ JSON export failed: ${err.message}\n`);
  process.exit(1);
}

// Test 4: Error handling - empty gems
console.log('TEST 4: Error Handling (Empty Gems)');
try {
  exportToCSV([], userId);
  console.error(`  ❌ Should have thrown error for empty gems\n`);
  process.exit(1);
} catch (err) {
  assert(err.message === 'No gems to export', 'Should throw correct error');
  console.log(`  ✅ Empty gems handled correctly\n`);
}

// Test 5: Exports directory structure
console.log('TEST 5: Exports Directory');
try {
  assert(fs.existsSync(EXPORTS_DIR), 'Exports directory should exist');
  const files = fs.readdirSync(EXPORTS_DIR);
  console.log(`  ✅ Exports directory exists`);
  console.log(`     Path: ${EXPORTS_DIR}`);
  console.log(`     Files created: ${files.length}\n`);
} catch (err) {
  console.error(`  ❌ Directory check failed: ${err.message}\n`);
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ ALL EXPORT TESTS PASSED (5/5)\n');

// Cleanup test files
setTimeout(() => {
  const files = fs.readdirSync(EXPORTS_DIR);
  const testFiles = files.filter(f => f.includes(userId));
  testFiles.forEach(f => {
    fs.unlinkSync(path.join(EXPORTS_DIR, f));
  });
  console.log(`🧹 Cleaned up ${testFiles.length} test file(s)\n`);
}, 100);
