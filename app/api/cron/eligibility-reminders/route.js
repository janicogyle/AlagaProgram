import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCooldownInfo } from '@/lib/requestCooldown';
import { sendSms, normalizeSmsContactNumber } from '@/lib/sms.server';
import { buildEligibilityReminderMessage } from '@/lib/smsTemplates';

export const runtime = 'nodejs';

function authorize(request) {
  const secret = process.env.SMS_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, response: NextResponse.json({ data: null, error: 'Missing SMS_CRON_SECRET.' }, { status: 500 }) };
  }

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token && token === secret) return { ok: true };

  return { ok: false, response: NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 }) };
}

export async function POST(request) {
  try {
    const auth = authorize(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    let { data: releasedRows, error: releasedError } = await supabaseAdmin
      .from('assistance_requests')
      .select('resident_id, request_date, released_at, created_at, updated_at')
      .eq('status', 'Released');

    if (releasedError && String(releasedError.message || '').toLowerCase().includes('released_at')) {
      ({ data: releasedRows, error: releasedError } = await supabaseAdmin
        .from('assistance_requests')
        .select('resident_id, request_date, created_at, updated_at')
        .eq('status', 'Released'));
    }

    if (releasedError) throw releasedError;

    const latestByResident = new Map();
    (releasedRows || []).forEach((row) => {
      if (!row?.resident_id) return;
      const rowDate = new Date(row.released_at || row.updated_at || row.request_date || row.created_at || 0);
      const existing = latestByResident.get(row.resident_id);
      const existingDate = existing
        ? new Date(existing.released_at || existing.updated_at || existing.request_date || existing.created_at || 0)
        : null;
      if (!existing || rowDate > existingDate) latestByResident.set(row.resident_id, row);
    });

    const residentIds = Array.from(latestByResident.keys());
    if (!residentIds.length) {
      return NextResponse.json({ data: { evaluated: 0, sent: 0, skipped: 0 }, error: null });
    }

    const { data: residents, error: residentsError } = await supabaseAdmin
      .from('residents')
      .select('id, contact_number, first_name, last_name')
      .in('id', residentIds);

    if (residentsError) throw residentsError;

    const reminders = [];
    (residents || []).forEach((resident) => {
      const last = latestByResident.get(resident.id);
      const lastRequestDate = last?.released_at || last?.updated_at || last?.request_date || last?.created_at || null;
      const cooldown = getCooldownInfo(lastRequestDate);
      if (!cooldown?.nextEligibleDate || !cooldown.isEligible) return;

      reminders.push({
        residentId: resident.id,
        contactNumber: resident.contact_number,
        nextEligibleDate: cooldown.nextEligibleDate,
      });
    });

    if (!reminders.length) {
      return NextResponse.json({ data: { evaluated: residentIds.length, sent: 0, skipped: 0 }, error: null });
    }

    const reminderKeys = reminders.map((reminder) => `${reminder.residentId}:${reminder.nextEligibleDate}`);

    const { data: existingLogs, error: logsError } = await supabaseAdmin
      .from('sms_logs')
      .select('reference_key')
      .eq('reference_type', 'eligibility_reminder')
      .in('reference_key', reminderKeys);

    if (logsError && logsError.code !== 'PGRST116') {
      throw logsError;
    }

    const sentKeys = new Set((existingLogs || []).map((row) => row.reference_key));

    let sentCount = 0;
    let skippedCount = 0;

    for (const reminder of reminders) {
      const referenceKey = `${reminder.residentId}:${reminder.nextEligibleDate}`;
      if (sentKeys.has(referenceKey)) {
        skippedCount += 1;
        continue;
      }

      const contactNumber = normalizeSmsContactNumber(reminder.contactNumber);
      if (!contactNumber) {
        skippedCount += 1;
        continue;
      }

      const message = buildEligibilityReminderMessage({ nextEligibleDate: reminder.nextEligibleDate });
      await sendSms({
        to: contactNumber,
        message,
        referenceType: 'eligibility_reminder',
        referenceId: reminder.residentId,
        referenceKey,
      });
      sentCount += 1;
    }

    return NextResponse.json({
      data: { evaluated: reminders.length, sent: sentCount, skipped: skippedCount },
      error: null,
    });
  } catch (error) {
    console.error('Eligibility reminder cron error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to send eligibility reminders.' },
      { status: 500 },
    );
  }
}
