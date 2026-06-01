/**
 * Script to remove Janico Sorio (BENEF-002) records from the database.
 * Removes:
 *   1. assistance_requests where control_number contains 'BENEF-002'
 *   2. residents row with control_number 'BENEF-002'
 *   3. account_requests row matching Janico Sorio's contact number
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== Removing Janico Sorio (BENEF-002) records ===\n');

  // 1. Find the resident record
  const { data: residents, error: resErr } = await supabase
    .from('residents')
    .select('id, control_number, first_name, last_name, contact_number, account_request_id')
    .or('control_number.eq.BENEF-002,and(first_name.ilike.Janico,last_name.ilike.Sorio)');

  if (resErr) {
    console.error('Error finding resident:', resErr.message);
  } else {
    console.log(`Found ${residents?.length || 0} resident record(s):`, residents);
  }

  const residentIds = (residents || []).map((r) => r.id);
  const contactNumbers = (residents || []).map((r) => r.contact_number).filter(Boolean);
  const accountRequestIds = (residents || []).map((r) => r.account_request_id).filter(Boolean);

  // 2. Delete assistance_requests linked to these residents or with control_number containing BENEF-002
  {
    // By resident_id
    if (residentIds.length) {
      const { data: arByResident, error: arErr1 } = await supabase
        .from('assistance_requests')
        .delete()
        .in('resident_id', residentIds)
        .select('id, control_number, assistance_type');

      if (arErr1) {
        console.error('Error deleting assistance_requests by resident_id:', arErr1.message);
      } else {
        console.log(`\nDeleted ${arByResident?.length || 0} assistance_request(s) by resident_id:`, arByResident);
      }
    }

    // Also by control_number pattern BENEF-002 (in case resident_id wasn't linked)
    const { data: arByCtrl, error: arErr2 } = await supabase
      .from('assistance_requests')
      .delete()
      .like('control_number', '%BENEF-002%')
      .select('id, control_number, assistance_type');

    if (arErr2) {
      console.error('Error deleting assistance_requests by control_number:', arErr2.message);
    } else {
      console.log(`Deleted ${arByCtrl?.length || 0} additional assistance_request(s) by control_number BENEF-002:`, arByCtrl);
    }

    // Also by beneficiary_name
    const { data: arByName, error: arErr3 } = await supabase
      .from('assistance_requests')
      .delete()
      .ilike('beneficiary_name', '%Janico%Sorio%')
      .select('id, control_number, assistance_type');

    if (arErr3) {
      console.error('Error deleting assistance_requests by beneficiary_name:', arErr3.message);
    } else {
      console.log(`Deleted ${arByName?.length || 0} additional assistance_request(s) by beneficiary_name:`, arByName);
    }
  }

  // 3. Delete resident record(s)
  if (residentIds.length) {
    const { data: delRes, error: delResErr } = await supabase
      .from('residents')
      .delete()
      .in('id', residentIds)
      .select('id, control_number, first_name, last_name');

    if (delResErr) {
      console.error('Error deleting resident(s):', delResErr.message);
    } else {
      console.log(`\nDeleted ${delRes?.length || 0} resident record(s):`, delRes);
    }
  }

  // 4. Delete account_requests (signup) for Janico Sorio
  // By linked account_request_id
  if (accountRequestIds.length) {
    const { data: delAr, error: delArErr } = await supabase
      .from('account_requests')
      .delete()
      .in('id', accountRequestIds)
      .select('id, first_name, last_name, contact_number');

    if (delArErr) {
      console.error('Error deleting account_requests by id:', delArErr.message);
    } else {
      console.log(`\nDeleted ${delAr?.length || 0} account_request(s) by id:`, delAr);
    }
  }

  // By contact number
  if (contactNumbers.length) {
    const { data: delArContact, error: delArContactErr } = await supabase
      .from('account_requests')
      .delete()
      .in('contact_number', contactNumbers)
      .select('id, first_name, last_name, contact_number');

    if (delArContactErr) {
      console.error('Error deleting account_requests by contact:', delArContactErr.message);
    } else {
      console.log(`Deleted ${delArContact?.length || 0} account_request(s) by contact_number:`, delArContact);
    }
  }

  // By name (fallback)
  const { data: delArName, error: delArNameErr } = await supabase
    .from('account_requests')
    .delete()
    .ilike('first_name', 'Janico')
    .ilike('last_name', 'Sorio')
    .select('id, first_name, last_name, contact_number');

  if (delArNameErr) {
    console.error('Error deleting account_requests by name:', delArNameErr.message);
  } else {
    console.log(`Deleted ${delArName?.length || 0} account_request(s) by name match:`, delArName);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
