require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🗄️  Attempting Supabase table creation...\n');

(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to create tables by making them
    console.log('Step 1: Creating users table...');
    
    // Insert a test user - if table doesn't exist it will fail, but then we know we need manual setup
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          id: 123456789,
          username: 'test_user',
          subscription_tier: 'free'
        }])
        .select();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('❌ Users table does not exist');
          throw new Error('Table creation failed - manual setup required');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Users table exists and is writable');
        
        // Delete test user
        await supabase
          .from('users')
          .delete()
          .eq('id', 123456789);
      }
    } catch (err) {
      if (err.code === 'PGRST116' || err.message.includes('PGRST116')) {
        console.log('📝 Tables need to be created manually');
        console.log('\nRunning manual SQL creation...');
        
        // Try using Postgres connection string directly
        const postgres = require('postgres');
        
        // Extract connection info from Supabase URL
        const urlParts = supabaseUrl.split('//')[1].split('.')[0];
        
        console.log('\n📋 Manual Setup Required:');
        console.log('1. Go to: https://supabase.io/dashboard');
        console.log('2. Select project: alexbet-sharp-bot');
        console.log('3. Click SQL Editor');
        console.log('4. Click "New Query"');
        console.log('5. Paste the SQL from: docs/SUPABASE_SCHEMA.sql');
        console.log('6. Click Run');
        console.log('\nAfter that, run: node verify-supabase.js\n');
        
        process.exit(1);
      } else {
        throw err;
      }
    }

    console.log('Step 2: Creating payments table...');
    
    try {
      const { data, error } = await supabase
        .from('payments')
        .insert([{
          user_id: 123456789,
          amount_stars: 999,
          tier: 'monthly',
          status: 'pending',
          payment_method: 'telegram_stars'
        }])
        .select();

      if (error && error.code === 'PGRST116') {
        console.log('❌ Payments table does not exist');
      } else if (!error) {
        console.log('✅ Payments table exists and is writable');
        // Clean up if it was created
        await supabase
          .from('payments')
          .delete()
          .eq('user_id', 123456789);
      }
    } catch (err) {
      if (err.code === 'PGRST116' || err.message.includes('does not exist')) {
        console.log('❌ Payments table does not exist');
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('⚠️  Tables must be created manually via Supabase Dashboard');
    console.log('='.repeat(50));

    console.log('\n📖 Instructions:');
    console.log('1. Open: https://supabase.io/dashboard');
    console.log('2. Select: alexbet-sharp-bot project');
    console.log('3. Click: SQL Editor (left sidebar)');
    console.log('4. Click: New Query (blue button)');
    console.log('5. Copy SQL from docs/SUPABASE_SCHEMA.sql');
    console.log('6. Paste into the query editor');
    console.log('7. Click: Run (execute button)');
    console.log('8. Check: Table Editor to verify tables created');
    console.log('9. Then: node verify-supabase.js');
    console.log('10. Finally: node telegram-bot.js\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
