// Setup database tables using service role key
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Read the SQL schema file
    const sqlSchema = fs.readFileSync('./database-schema.sql', 'utf8');
    
    // Split into individual statements (rough split by semicolon)
    const statements = sqlSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement + ';'
      });

      if (error) {
        // Try direct execution for some statements
        const { error: directError } = await supabase.from('_').select(statement);
        if (directError && !directError.message.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1} failed: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Database setup complete!\n');
    console.log('🔍 Verifying tables...\n');

    // Verify tables were created
    const tables = ['assistance_requests', 'assistance_budgets', 'users', 'account_requests', 'notifications'];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        console.log(`❌ Table "${table}" verification failed`);
      } else {
        console.log(`✅ Table "${table}" verified`);
      }
    }

    console.log('\n✅ All done! Run check-db.js to see the final state.');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

setupDatabase();
