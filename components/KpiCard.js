import styles from './KpiCard.module.css';
import { getKpiIcon } from './kpiIcons';

export default function KpiCard({ title, value, color = 'blue', icon = 'users', compact = false }) {
  return (
    <div className={`${styles.kpiCard} ${styles[color]} ${compact ? styles.compact : ''}`}>
      <div className={styles.kpiIconTop}>{getKpiIcon(icon)}</div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{title}</div>
    </div>
  );
}
