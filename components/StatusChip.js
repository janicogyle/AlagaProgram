import styles from './StatusChip.module.css';

export default function StatusChip({ label, tone = 'info' }) {
  return (
    <span className={`${styles.chip} ${styles[tone] || ''}`}>
      {label}
    </span>
  );
}
