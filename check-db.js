// Test Supabase connection and check existing schema
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'Present' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking Supabase connection...\n');
  
  // Test connection
  const { data: testData, error: testError } = await supabase
    .from('residents')
    .select('count')
    .limit(1);
  
  if (testError) {
    console.log('❌ Connection failed:', testError.message);
    return;
  }
  
  console.log('✅ Connection successful!\n');
  
  // Check existing tables
  const tables = ['residents', 'assistance_requests', 'assistance_budgets', 'users', 'account_requests'];
  
  console.log('📊 Checking tables...\n');
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log(`❌ Table "${table}" does NOT exist`);
      } else {
        console.log(`❌ Table "${table}" error:`, error.message);
      }
    } else {
      console.log(`✅ Table "${table}" exists`);
      
      // Get column info if table exists
      if (data !== null) {
        const { data: columns } = await supabase.from(table).select('*').limit(0);
        if (data.length > 0 || columns) {
          const cols = data.length > 0 ? Object.keys(data[0]) : [];
          console.log(`   Columns: ${cols.join(', ') || 'empty table'}`);
        }
      }
    }
  }
  
  // Check row counts
  console.log('\n📈 Data Summary:\n');
  
  for (const table of ['residents', 'assistance_requests', 'assistance_budgets']) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      console.log(`   ${table}: ${count} rows`);
    }
  }
}

checkDatabase().then(() => {
  console.log('\n✅ Database check complete!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
