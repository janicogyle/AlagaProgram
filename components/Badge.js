import styles from './Badge.module.css';

const variants = {
  'Senior Citizen': 'blue',
  'PWD': 'purple',
  'Solo Parent': 'orange',
  'Active': 'success',
  'Inactive': 'danger',
  'Admin': 'primary',
  'Staff': 'secondary',
  'Cash': 'green',
  'Medical': 'red',
  'Relief Goods': 'orange',
  'Educational': 'blue',
  // Assistance types
  'Medicine Assistance': 'green',
  'Confinement Assistance': 'blue',
  'Burial Assistance': 'purple',
  'Others': 'secondary',
  // Status types
  'Pending': 'warning',
  'Resubmitted': 'warning',
  'Approved': 'primary',
  'Released': 'success',
  'Incomplete': 'danger',
  'Rejected': 'danger',
  'Archived': 'secondary',
};

export default function Badge({ children, variant }) {
  const displayText = children === 'Rejected' ? 'Incomplete' : children;
  const colorVariant = variant || variants[displayText] || variants[children] || 'default';

  return (
    <span className={`${styles.badge} ${styles[colorVariant]}`}>
      {displayText}
    </span>
  );
}
