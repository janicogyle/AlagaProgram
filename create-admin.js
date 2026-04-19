// Create first admin user
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
  return new Promise((resolve) => rl.question(query, resolve));
}

function questionHidden(query) {
  return new Promise((resolve) => {
    const originalWrite = rl._writeToOutput;
    rl.stdoutMuted = true;

    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        // Mask user input (but keep newlines, prompts, etc.)
        if (stringToWrite && stringToWrite.trim()) {
          rl.output.write('*');
        }
      } else {
        rl.output.write(stringToWrite);
      }
    };

    rl.question(query, (answer) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = originalWrite;
      rl.output.write('\n');
      resolve(answer);
    });
  });
}

async function createAdminUser() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   CREATE FIRST ADMIN USER              ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Get user input
    const fullName = await question('Enter full name: ');
    const email = await question('Enter email address: ');
    const password = await questionHidden('Enter password (min 6 chars): ');
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';

    console.log('Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}\n`);
    console.log(`You can now login at: ${baseUrl.replace(/\/$/, '')}/login`);
    console.log('Select "Admin" and use your email/password\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

createAdminUser();
