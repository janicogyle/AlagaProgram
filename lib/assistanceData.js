export const assistanceTypeOptions = [
  { value: 'Medicine Assistance', label: 'Medicine Assistance' },
  { value: 'Confinement Assistance', label: 'Confinement Assistance' },
  { value: 'Burial Assistance', label: 'Burial Assistance' },
  { value: 'Others', label: 'Others' },
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.5 20.5L3.5 13.5C1.5 11.5 1.5 8.5 3.5 6.5C5.5 4.5 8.5 4.5 10.5 6.5L12 8L13.5 6.5C15.5 4.5 18.5 4.5 20.5 6.5C22.5 8.5 22.5 11.5 20.5 13.5L13.5 20.5C12.67 21.33 11.33 21.33 10.5 20.5Z" />
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path d="M8 8h8v8H8z" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
        </svg>
    ),
    iconBg: '#e5e7eb',
    iconColor: '#4b5563',
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
