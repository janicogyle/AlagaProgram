import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { computeBeneficiaryIdStatus } from '@/lib/beneficiaryIdStatus.server';
import { logActivity } from '@/lib/activityLogger.server';
import { normalizeSmsContactNumber, sendSms } from '@/lib/sms.server';
import { buildBeneficiaryIdRenewalReminderMessage } from '@/lib/smsTemplates';

export const runtime = 'nodejs';

const REMINDER_DAYS = new Set([30, 7, 0]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function dateOnly(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function daysUntil(value, nowInput = new Date()) {
  const expires = new Date(value);
  if (Number.isNaN(expires.getTime())) return null;
  const diff = dateOnly(expires).getTime() - dateOnly(new Date(nowInput)).getTime();
  return Math.ceil(diff / MS_PER_DAY);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

export async function POST(request) {
  try {
    const auth = authorize(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json({ data: null, error: 'Server configuration error. Database admin client not available.' }, { status: 500 });
    }

    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('beneficiary_cards')
      .select('id, resident_id, issued_at, expires_at, revoked_at, status')
      .is('revoked_at', null)
      .order('issued_at', { ascending: false });
    if (cardsError) throw cardsError;

    const latestByResident = new Map();
    for (const card of cards || []) {
      if (!card?.resident_id || latestByResident.has(card.resident_id)) continue;
      latestByResident.set(card.resident_id, card);
    }

    const residentIds = Array.from(latestByResident.keys());
    if (!residentIds.length) {
      return NextResponse.json({ data: { evaluated: 0, updated: 0, sent: 0, skipped: 0 }, error: null });
    }

    const { data: residents, error: residentsError } = await supabaseAdmin
      .from('residents')
      .select('id, first_name, last_name, contact_number, status')
      .in('id', residentIds);
    if (residentsError) throw residentsError;

    const residentById = new Map((residents || []).map((row) => [row.id, row]));
    const reminders = [];
    let updatedCount = 0;

    for (const [residentId, card] of latestByResident.entries()) {
      const resident = residentById.get(residentId);
      if (!resident || resident.status === 'Renewal Pending') continue;

      const nextStatus = computeBeneficiaryIdStatus({ card, residentStatus: resident.status });
      if (nextStatus !== resident.status) {
        const { error } = await supabaseAdmin.from('residents').update({ status: nextStatus }).eq('id', residentId);
        if (error) throw error;
        updatedCount += 1;
      }
      if (nextStatus !== card.status) {
        const { error } = await supabaseAdmin.from('beneficiary_cards').update({ status: nextStatus }).eq('id', card.id);
        if (error) throw error;
      }

      const days = daysUntil(card.expires_at);
      if (days == null || !REMINDER_DAYS.has(days)) continue;

      reminders.push({
        resident,
        card,
        days,
        expirationDate: formatDate(card.expires_at),
        referenceKey: `${residentId}:${card.id}:${days}:${String(card.expires_at).slice(0, 10)}`,
      });
    }

    if (!reminders.length) {
      return NextResponse.json({ data: { evaluated: residentIds.length, updated: updatedCount, sent: 0, skipped: 0 }, error: null });
    }

    const { data: existingLogs, error: logsError } = await supabaseAdmin
      .from('sms_logs')
      .select('reference_key')
      .eq('reference_type', 'beneficiary_id_renewal_reminder')
      .in('reference_key', reminders.map((row) => row.referenceKey));
    if (logsError && logsError.code !== 'PGRST116') throw logsError;

    const sentKeys = new Set((existingLogs || []).map((row) => row.reference_key));
    let sentCount = 0;
    let skippedCount = 0;

    for (const reminder of reminders) {
      if (sentKeys.has(reminder.referenceKey)) {
        skippedCount += 1;
        continue;
      }

      const contactNumber = normalizeSmsContactNumber(reminder.resident.contact_number);
      if (!contactNumber) {
        skippedCount += 1;
        continue;
      }

      const message = buildBeneficiaryIdRenewalReminderMessage({
        daysUntilExpiration: reminder.days,
        expirationDate: reminder.expirationDate,
      });

      await sendSms({
        to: contactNumber,
        message,
        referenceType: 'beneficiary_id_renewal_reminder',
        referenceId: reminder.resident.id,
        referenceKey: reminder.referenceKey,
      });

      await logActivity({
        actor_name: 'System',
        actor_role: 'System',
        action: reminder.days <= 0 ? 'Beneficiary ID expired' : 'Beneficiary ID renewal reminder',
        message,
        entity_type: 'beneficiary_card',
        entity_id: reminder.card.id,
        reference_number: String(reminder.card.id).slice(0, 8).toUpperCase(),
        link: '/beneficiary/profile',
        audience_resident_id: reminder.resident.id,
      }, supabaseAdmin);

      sentCount += 1;
    }

    return NextResponse.json({
      data: { evaluated: residentIds.length, updated: updatedCount, sent: sentCount, skipped: skippedCount },
      error: null,
    });
  } catch (error) {
    console.error('Beneficiary ID renewal cron error:', error);
    return NextResponse.json({ data: null, error: error?.message || 'Failed to process Beneficiary ID renewals.' }, { status: 500 });
  }
}
