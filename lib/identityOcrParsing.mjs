const DATE_MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const SUPPORTED_ID_RULES = [
  {
    type: 'philsys',
    label: 'Philippine National ID (PhilSys)',
    patterns: [/\bphilsys\b/i, /philippine identification (?:card|system)/i, /\bphilid\b/i],
  },
  {
    type: 'drivers_license',
    label: "Driver's License",
    patterns: [/\bdriver'?s license\b/i, /land transportation office/i, /\blto\b[\s:.-]/i],
  },
  {
    type: 'pwd',
    label: 'PWD ID',
    patterns: [/\bperson with disabilit(?:y|ies)\b/i, /\bpwd(?:\s+id|\s+identification)?\b/i],
  },
  {
    type: 'senior_citizen',
    label: 'Senior Citizen ID',
    patterns: [/\bsenior citizen\b/i, /\boffice of senior citizens affairs\b/i, /\bosca\b/i],
  },
  {
    type: 'solo_parent',
    label: 'Solo Parent ID',
    patterns: [/\bsolo parent\b/i],
  },
  {
    type: 'passport',
    label: 'Philippine Passport',
    patterns: [/\bpassport\b/i, /\bpasaporte\b/i, /\bP<PHL/i],
  },
  {
    type: 'umid_sss_gsis',
    label: 'UMID / SSS / GSIS ID',
    patterns: [
      /unified multi-purpose id/i,
      /\bumid\b/i,
      /social security system/i,
      /government service insurance system/i,
      /\b(?:sss|gsis)\b[\s:.-]/i,
    ],
  },
  {
    type: 'voters',
    label: "Voter's ID",
    patterns: [/\bvoter'?s identification\b/i, /commission on elections/i, /\bcomelec\b/i],
  },
  {
    type: 'prc',
    label: 'PRC ID',
    patterns: [
      /professional regulation commission/i,
      /professional identification card/i,
      /\bprc\b[\s:.-]/i,
    ],
  },
];

const UNSUPPORTED_ID_PATTERNS = [
  { label: 'Postal ID', pattern: /\bpostal identification\b|\bpostal id\b/i },
  { label: 'Barangay ID', pattern: /\bbarangay (?:identification|id)\b/i },
  { label: 'Barangay Certificate', pattern: /\bcertificate of residency\b|\bbarangay certificate\b/i },
];

function cleanLine(value) {
  return String(value || '')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeIdentityName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\b(?:JR|SR|II|III|IV)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value) {
  return new Set(normalizeIdentityName(value).split(' ').filter((token) => token.length > 1));
}

export function namesMatch(extractedName, profile = {}) {
  const extracted = nameTokens(extractedName);
  const firstTokens = [...nameTokens(profile.firstName)];
  const lastTokens = [...nameTokens(profile.lastName)];
  if (!extracted.size || !firstTokens.length || !lastTokens.length) return false;
  return firstTokens.every((token) => extracted.has(token)) && lastTokens.every((token) => extracted.has(token));
}

function toIsoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseIdentityDate(value) {
  const text = cleanLine(value).replace(/[,]/g, ' ');
  let match = text.match(/\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])\b/);
  if (match) return toIsoDate(match[1], match[2], match[3]);

  match = text.match(/\b([0-2]?\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](19\d{2}|20\d{2})\b/);
  if (match) return toIsoDate(match[3], match[2], match[1]);

  match = text.match(
    /\b([0-2]?\d|3[01])\s+(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T|TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(19\d{2}|20\d{2})\b/i,
  );
  if (match) return toIsoDate(match[3], DATE_MONTHS[match[2].toLowerCase()], match[1]);

  match = text.match(
    /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T|TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+([0-2]?\d|3[01])\s+(19\d{2}|20\d{2})\b/i,
  );
  if (match) return toIsoDate(match[3], DATE_MONTHS[match[1].toLowerCase()], match[2]);
  return '';
}

function valueAfterLabel(lines, labelPattern, { maxLookahead = 1 } = {}) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(labelPattern);
    if (!match) continue;
    const sameLine = cleanLine(match.groups?.value || match[1] || '');
    if (sameLine) return sameLine;
    for (let offset = 1; offset <= maxLookahead; offset += 1) {
      const candidate = cleanLine(lines[index + offset]);
      if (candidate && !/^(?:name|surname|last name|given names?|first name|date of birth|birth date|id no|license no)\b/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return '';
}

function sanitizeName(value) {
  return cleanLine(value)
    .replace(/^(?:NAME|FULL NAME|SURNAME|LAST NAME|GIVEN NAMES?|FIRST NAME)\s*[:.-]?\s*/i, '')
    .replace(/\b(?:SEX|NATIONALITY|DATE OF BIRTH|BIRTH DATE|DOB|ADDRESS)\b.*$/i, '')
    .replace(/[^A-Za-zÀ-ÿ' .,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractName(lines, text, idType) {
  const lastName = sanitizeName(
    valueAfterLabel(lines, /^(?:SURNAME|LAST\s*NAME)\s*[:.-]?\s*(?<value>.*)$/i),
  );
  const firstName = sanitizeName(
    valueAfterLabel(lines, /^(?:GIVEN\s*NAMES?|FIRST\s*NAME)\s*[:.-]?\s*(?<value>.*)$/i),
  );
  if (firstName && lastName) return `${firstName} ${lastName}`.trim();

  const fullName = sanitizeName(
    valueAfterLabel(lines, /^(?:FULL\s*NAME|NAME)\s*[:.-]?\s*(?<value>.*)$/i),
  );
  if (normalizeIdentityName(fullName).split(' ').length >= 2) return fullName;

  if (idType === 'passport') {
    const mrzLine = lines.find((line) => /^P[<\s]PHL/i.test(line));
    if (mrzLine) {
      const mrzName = mrzLine.replace(/^P[<\s]PHL/i, '').replace(/<+/g, ' ').trim();
      const parts = mrzName.split(/\s{2,}/).filter(Boolean);
      const candidate = parts.length > 1 ? `${parts.slice(1).join(' ')} ${parts[0]}` : mrzName;
      if (normalizeIdentityName(candidate).split(' ').length >= 2) return sanitizeName(candidate);
    }
  }

  const nameContext = text.match(/(?:FULL\s*NAME|NAME)\s*[:.-]\s*([A-Z][A-Z' .,-]{5,})/i);
  return sanitizeName(nameContext?.[1] || '');
}

function sanitizeIdNumber(value) {
  const candidate = cleanLine(value)
    .replace(/^(?:ID|CARD|LICENSE|LICENCE|PASSPORT|REGISTRATION|CRN|SSS|GSIS|PCN)\s*(?:NO|NUMBER|#)?\s*[:.-]?\s*/i, '')
    .split(/\s{2,}/)[0]
    .replace(/[^A-Za-z0-9-]/g, '');
  return /[0-9]/.test(candidate) && candidate.length >= 5 ? candidate.toUpperCase() : '';
}

function extractIdNumber(lines, text, idType) {
  const labelsByType = {
    philsys: /^(?:PCN|PHILSYS\s*(?:CARD\s*)?NUMBER|ID\s*(?:NO|NUMBER))\s*[:.#-]?\s*(?<value>.*)$/i,
    drivers_license: /^(?:LICENSE|LICENCE)\s*(?:NO|NUMBER)\s*[:.#-]?\s*(?<value>.*)$/i,
    passport: /^PASSPORT\s*(?:NO|NUMBER)\s*[:.#-]?\s*(?<value>.*)$/i,
    umid_sss_gsis: /^(?:CRN|SSS|GSIS|ID)\s*(?:NO|NUMBER)?\s*[:.#-]?\s*(?<value>.*)$/i,
    prc: /^(?:REGISTRATION|LICENSE|ID)\s*(?:NO|NUMBER)\s*[:.#-]?\s*(?<value>.*)$/i,
  };
  const generic = /^(?:ID|CARD)\s*(?:NO|NUMBER|#)\s*[:.#-]?\s*(?<value>.*)$/i;
  const direct = sanitizeIdNumber(valueAfterLabel(lines, labelsByType[idType] || generic));
  if (direct) return direct;
  const fallback = sanitizeIdNumber(valueAfterLabel(lines, generic));
  if (fallback) return fallback;
  const inline = text.match(
    /(?:PCN|CRN|ID|CARD|LICENSE|LICENCE|PASSPORT|REGISTRATION)\s*(?:NO|NUMBER|#)?\s*[:.-]\s*([A-Z0-9-]{5,24})/i,
  );
  return sanitizeIdNumber(inline?.[1] || '');
}

function extractBirthDate(lines, text) {
  const labeled = valueAfterLabel(
    lines,
    /^(?:DATE\s*OF\s*BIRTH|BIRTH\s*DATE|BIRTHDATE|DOB)\s*[:.-]?\s*(?<value>.*)$/i,
  );
  return parseIdentityDate(labeled) || parseIdentityDate(text.match(/(?:DATE\s*OF\s*BIRTH|BIRTH\s*DATE|DOB)\s*[:.-]?\s*([^\n]+)/i)?.[1]);
}

function extractOptionalFields(lines) {
  const nationality = valueAfterLabel(lines, /^(?:NATIONALITY|CITIZENSHIP)\s*[:.-]?\s*(?<value>.*)$/i);
  const sex = valueAfterLabel(lines, /^(?:SEX|GENDER)\s*[:.-]?\s*(?<value>.*)$/i);
  const address = valueAfterLabel(lines, /^ADDRESS\s*[:.-]?\s*(?<value>.*)$/i, { maxLookahead: 2 });
  const expiryRaw = valueAfterLabel(
    lines,
    /^(?:DATE\s*OF\s*EXPIRY|EXPIRY\s*DATE|EXPIRATION\s*DATE|VALID\s*UNTIL)\s*[:.-]?\s*(?<value>.*)$/i,
  );
  return {
    ...(nationality ? { nationality } : {}),
    ...(sex ? { sex } : {}),
    ...(address ? { address } : {}),
    ...(parseIdentityDate(expiryRaw) ? { expiryDate: parseIdentityDate(expiryRaw) } : {}),
  };
}

export function maskIdNumber(value) {
  const normalized = sanitizeIdNumber(value);
  if (!normalized) return '';
  const visible = normalized.replace(/-/g, '').slice(-4);
  return `${'*'.repeat(Math.max(4, normalized.replace(/-/g, '').length - 4))}${visible}`;
}

export function parsePhilippineIdentityText(rawText) {
  const text = String(rawText || '').replace(/\r/g, '\n').trim();
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const unsupported = UNSUPPORTED_ID_PATTERNS.find(({ pattern }) => pattern.test(text));
  if (unsupported) {
    return { supported: false, unsupportedLabel: unsupported.label, idType: null, fields: {}, missingFields: [] };
  }

  const rule = SUPPORTED_ID_RULES.find(({ patterns }) => patterns.some((pattern) => pattern.test(text)));
  if (!rule) {
    return { supported: false, unsupportedLabel: '', idType: null, fields: {}, missingFields: [] };
  }

  const fields = {
    fullName: extractName(lines, text, rule.type),
    idNumber: extractIdNumber(lines, text, rule.type),
    birthDate: extractBirthDate(lines, text),
    ...extractOptionalFields(lines),
  };
  const missingFields = [
    !fields.fullName && 'fullName',
    !fields.idNumber && 'idNumber',
    !fields.birthDate && 'birthDate',
  ].filter(Boolean);

  return {
    supported: true,
    idType: rule.type,
    idTypeLabel: rule.label,
    fields,
    missingFields,
  };
}

export const SUPPORTED_ID_TYPES = SUPPORTED_ID_RULES.map(({ type, label }) => ({ type, label }));
