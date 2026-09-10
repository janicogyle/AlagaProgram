export const assistanceTypeOptions = [
  { value: 'Medicine Assistance', label: 'Medicine Assistance' },
  { value: 'Confinement Assistance', label: 'Confinement Assistance' },
  { value: 'Burial Assistance', label: 'Burial Assistance' },
];

export const assistanceData = {
  'Medicine Assistance': {
    ceiling: 500,
    requirements: [
      "Original copy of prescription of medicine dated within July–December 2025 (must include: name of Senior Citizen / PWD / Solo Parent, medicines prescribed, name & signature of physician, and physician's license number)",
      'Official receipt of medicine purchased within the quarter',
      'Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID',
    ],
    icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 20.5a4.5 4.5 0 0 1-3.18-7.68l8.5-8.5a4.5 4.5 0 0 1 6.36 6.36l-8.5 8.5a4.48 4.48 0 0 1-3.18 1.32Z" />
            <path d="m9.25 7.9 6.85 6.85" />
        </svg>
    ),
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
  },
  'Confinement Assistance': {
    ceiling: 1000,
    requirements: [
      'Official receipt',
      'Certificate of confinement dated within July–December 2025',
      'Clinical abstract',
      'Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID',
    ],
    icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <path d="M12 8v8M8 12h8" />
        </svg>
    ),
    iconBg: '#dbeafe',
    iconColor: '#1e40af',
  },
  'Burial Assistance': {
    ceiling: 1000,
    requirements: [
      'Original copy of death certificate within July–December 2025',
      'Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID',
      'Valid ID of claimant or proof of relation to deceased',
    ],
    icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 8.5c0 5-8 10.5-8 10.5S4 13.5 4 8.5A4.5 4.5 0 0 1 12 5.7a4.5 4.5 0 0 1 8 2.8Z" />
        </svg>
    ),
    iconBg: '#f3e8ff',
    iconColor: '#7e22ce',
  },
  'Others': {
    ceiling: 0,
    requirements: [],
  },
};

export const baseRequirements = [
  'Valid Government-issued ID (e.g., PhilSys, SSS, GSIS, Voter\'s ID)',
  'Barangay Certificate of Residency',
  'Birth Certificate (PSA or Local Civil Registrar)',
  '1x1 or 2x2 Recent ID Photo',
];

export const sectorRequirements = {
  pwd: 'PWD ID',
  seniorCitizen: 'Senior Citizen ID',
  soloParent: 'Solo Parent ID',
};
