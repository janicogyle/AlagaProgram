// Create first admin user
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   CREATE FIRST ADMIN USER              ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Get user input
    const fullName = await question('Enter full name: ');
    const email = await question('Enter email address: ');
    const password = await question('Enter password (min 6 chars): ');
    const role = await question('Enter role (Admin/Staff) [Admin]: ') || 'Admin';

    console.log('\n📝 Creating admin user...\n');

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('❌ Auth Error:', authError.message);
      rl.close();
      return;
    }

    console.log('✅ Auth user created');

    // Create user record
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        email,
        role,
        status: 'Active',
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ User table error:', userError.message);
      rl.close();
      return;
    }

    console.log('✅ User record created\n');
    console.log('═══════════════════════════════════════');
    console.log('🎉 Admin user created successfully!');
    console.log('═══════════════════════════════════════\n');
    console.log('Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}\n`);
    console.log('You can now login at: http://localhost:3000/login');
    console.log('Select "Admin" and use your email/password\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

createAdminUser();
