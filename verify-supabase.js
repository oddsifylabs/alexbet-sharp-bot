require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Verifying Supabase tables...\n');

(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Testing connection to:', supabaseUrl.split('//')[1].split('.')[0]);

    // Test users table
    console.log('\n📊 Checking users table...');
    const { data: users, error: usersError, status: usersStatus } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (!usersError) {
      console.log('✅ Users table EXISTS');
      console.log('   Structure: id, username, subscription_tier, subscription_expiry, ...');
    } else if (usersError.code === 'PGRST116') {
      console.log('❌ Users table NOT FOUND');
      console.log('   Error:', usersError.message);
    } else {
      console.log('⚠️  Unexpected error:', usersError.message);
    }

    // Test payments table
    console.log('\n💳 Checking payments table...');
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .limit(1);

    if (!paymentsError) {
      console.log('✅ Payments table EXISTS');
      console.log('   Structure: id, user_id, amount_stars, tier, status, ...');
    } else if (paymentsError.code === 'PGRST116') {
      console.log('❌ Payments table NOT FOUND');
      console.log('   Error:', paymentsError.message);
    } else {
      console.log('⚠️  Unexpected error:', paymentsError.message);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (!usersError && !paymentsError) {
      console.log('✅ ALL TABLES READY - Bot can start!');
      console.log('\n🚀 Start bot with: node telegram-bot.js');
      process.exit(0);
    } else {
      console.log('❌ TABLES MISSING - Please create them:');
      console.log('\n1. Open Supabase Dashboard → SQL Editor');
      console.log('2. Copy SQL from: docs/SUPABASE_SCHEMA.sql');
      console.log('3. Run all CREATE TABLE statements');
      console.log('4. Run this again: node verify-supabase.js');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nCheck your credentials:');
    console.error('  SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 50) + '...');
    console.error('  SUPABASE_SERVICE_ROLE_KEY: set?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    process.exit(1);
  }
})();
