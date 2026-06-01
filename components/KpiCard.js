import Link from 'next/link';
import styles from './KpiCard.module.css';
import { getKpiIcon } from './kpiIcons';

export default function KpiCard({ title, value, color = 'blue', icon = 'users', compact = false, href }) {
  const className = `${styles.kpiCard} ${styles[color]} ${compact ? styles.compact : ''} ${href ? styles.clickable : ''}`;
  const content = (
    <>
      <div className={styles.kpiContent}>
        <div className={styles.kpiValue}>{value}</div>
        <div className={styles.kpiLabel}>{title}</div>
      </div>
      <div className={styles.kpiIcon}>{getKpiIcon(icon)}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${title} - open related page`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
