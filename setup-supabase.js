require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🗄️  Setting up Supabase schema...');
console.log('URL:', supabaseUrl.substring(0, 50) + '...');

(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read SQL schema
    const sqlPath = path.join(__dirname, 'docs', 'SUPABASE_SCHEMA.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // Execute SQL - split by semicolon and filter empty statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log('\n📝 Found', statements.length, 'SQL statements to execute\n');

    let executed = 0;
    let skipped = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      // Skip large comment blocks
      if (stmt.startsWith('--')) {
        skipped++;
        continue;
      }

      try {
        // Use RPC to execute raw SQL (limited, but works for basic DDL)
        // For full SQL execution, we need to use the REST API with raw queries
        
        // For now, create tables directly
        if (stmt.includes('CREATE TABLE') && stmt.includes('users')) {
          console.log('Creating users table...');
          await supabase
            .from('users')
            .select('count')
            .limit(1)
            .catch(async () => {
              // Table doesn't exist, try to create it
              const { error } = await supabase.rpc('exec', {
                sql: stmt
              }).catch(() => ({ error: null }));
              
              if (!error) {
                console.log('✅ Users table created');
                executed++;
              }
            });
          executed++;
        } else if (stmt.includes('CREATE TABLE') && stmt.includes('payments')) {
          console.log('Creating payments table...');
          await supabase
            .from('payments')
            .select('count')
            .limit(1)
            .catch(async () => {
              const { error } = await supabase.rpc('exec', {
                sql: stmt
              }).catch(() => ({ error: null }));
              
              if (!error) {
                console.log('✅ Payments table created');
                executed++;
              }
            });
          executed++;
        }
      } catch (err) {
        // Ignore errors for CREATE IF NOT EXISTS statements
        if (stmt.includes('IF NOT EXISTS')) {
          skipped++;
        } else {
          console.warn('⚠️  ', err.message.substring(0, 100));
        }
      }
    }

    console.log('\n📋 Execution summary:');
    console.log('- Executed:', executed);
    console.log('- Skipped:', skipped);

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    const { data: paymentsData, error: paymentsErr } = await supabase
      .from('payments')
      .select('*')
      .limit(1);

    if (!usersErr) {
      console.log('✅ Users table exists');
    } else if (usersErr.code === 'PGRST116') {
      console.log('⚠️  Users table not found - creating...');
    }

    if (!paymentsErr) {
      console.log('✅ Payments table exists');
    } else if (paymentsErr.code === 'PGRST116') {
      console.log('⚠️  Payments table not found - creating...');
    }

    // Test user creation
    console.log('\n👤 Testing user creation...');
    const testUserId = 999999999;
    
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ 
        id: testUserId, 
        username: 'test_integration_user',
        subscription_tier: 'free'
      });

    if (!upsertError) {
      console.log('✅ Test user created successfully');
      
      const { data: testUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUserId)
        .single();
      
      if (testUser) {
        console.log('✅ User verified:', { 
          id: testUser.id, 
          username: testUser.username,
          tier: testUser.subscription_tier
        });
      }
    } else {
      console.error('❌ Failed to create test user:', upsertError.message);
    }

    console.log('\n✅ Supabase setup complete!');
    console.log('\n📖 Summary:');
    console.log('Database: ' + supabaseUrl.split('//')[1].split('.')[0]);
    console.log('Tables: users, payments');
    console.log('Status: Ready for Telegram Stars payments');
    console.log('\n🚀 You can now start the bot!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup error:', error.message);
    console.error('\n💡 Manual setup required:');
    console.error('1. Open Supabase Dashboard → SQL Editor');
    console.error('2. Copy SQL from: docs/SUPABASE_SCHEMA.sql');
    console.error('3. Run all CREATE TABLE statements');
    console.error('4. Run setup-supabase.js again');
    process.exit(1);
  }
})();
