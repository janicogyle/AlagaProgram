import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ 
        data: null, 
        error: 'Server configuration error. Database client not available.' 
      }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ 
        data: null, 
        error: 'Invalid request body.' 
      }, { status: 400 });
    }

    const { reportType, format } = body;

    if (!reportType || !format) {
      return NextResponse.json({ 
        data: null, 
        error: 'Report type and format are required.' 
      }, { status: 400 });
    }

    const validReportTypes = ['pwd', 'senior', 'soloparent', 'all'];
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json({ 
        data: null, 
        error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}.` 
      }, { status: 400 });
    }

    const validFormats = ['csv', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json({
        data: null,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}.`,
      }, { status: 400 });
    }

    const selectFields =
      'control_number, last_name, first_name, middle_name, birthday, age, sex, contact_number, house_no, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, status';

    let query = supabase.from('residents').select(selectFields);

    // Filter by sector
    if (reportType === 'pwd') {
      query = query.eq('is_pwd', true);
    } else if (reportType === 'senior') {
      query = query.eq('is_senior_citizen', true);
    } else if (reportType === 'soloparent') {
      query = query.eq('is_solo_parent', true);
    }

    const { data, error } = await query.order('last_name', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ 
        data: [], 
        error: null, 
        message: 'No data found for this report type.' 
      });
    }

    // Generate CSV format
    if (format === 'csv') {
      const csvContent = generateCSV(data);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // For PDF, return JSON data (frontend will handle generation)
    return NextResponse.json({
      data,
      error: null,
      message: `${data.length} records found.`,
    });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json({ 
      data: null, 
      error: error.message || 'Failed to generate report.' 
    }, { status: 500 });
  }
}

function generateCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = [
    'Control Number',
    'Last Name',
    'First Name',
    'Middle Name',
    'Birthday',
    'Age',
    'Sex',
    'Contact Number',
    'Address',
    'Barangay',
    'City',
    'PWD',
    'Senior Citizen',
    'Solo Parent',
    'Status',
  ];

  const rows = data.map(row => [
    row.control_number || '',
    row.last_name || '',
    row.first_name || '',
    row.middle_name || '',
    row.birthday || '',
    row.age || '',
    row.sex || '',
    row.contact_number || '',
    `${row.house_no || ''} ${row.street || ''}`.trim(),
    row.barangay || '',
    row.city || '',
    row.is_pwd ? 'Yes' : 'No',
    row.is_senior_citizen ? 'Yes' : 'No',
    row.is_solo_parent ? 'Yes' : 'No',
    row.status || '',
  ]);

  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
  ];

  return csvRows.join('\n');
}
