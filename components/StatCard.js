import styles from './StatCard.module.css';

const iconColors = {
  blue: '#1e40af',
  green: '#16a34a',
  orange: '#ea580c',
  red: '#dc2626',
  purple: '#7c3aed',
};

const iconBgColors = {
  blue: '#dbeafe',
  green: '#dcfce7',
  orange: '#ffedd5',
  red: '#fee2e2',
  purple: '#ede9fe',
};

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'blue' 
}) {
  const icons = {
    disability: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* Head */}
        <circle cx="9" cy="6" r="2" />
        {/* Back */}
        <path d="M9 8v3" />
        {/* Arm to wheel */}
        <path d="M9 9h3" />
        {/* Seat */}
        <path d="M9 11h4" />
        {/* Wheel */}
        <circle cx="14" cy="17" r="4" />
        {/* Leg */}
        <path d="M13 11l2 4" />
      </svg>
    ),
    senior: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    youth: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    parent: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  };

  return (
    <div className={styles.statCard}>
      <div className={styles.content}>
        <span className={styles.title}>{title}</span>
        <span className={styles.value}>{value}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      {icon && (
        <div 
          className={styles.iconWrapper}
          style={{ 
            backgroundColor: iconBgColors[color],
            color: iconColors[color]
          }}
        >
          {icons[icon] || icon}
        </div>
      )}
    </div>
  );
}
