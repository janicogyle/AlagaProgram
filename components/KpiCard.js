import Link from 'next/link';
import styles from './KpiCard.module.css';
import { getKpiIcon } from './kpiIcons';

export default function KpiCard({
  title,
  value,
  subtitle,
  color = 'blue',
  icon = 'users',
  compact = false,
  variant = 'default',
  href,
}) {
  const isSummary = variant === 'summary';
  const className = `${styles.kpiCard} ${styles[color]} ${compact ? styles.compact : ''} ${isSummary ? styles.summary : ''} ${href ? styles.clickable : ''}`;
  const content = isSummary ? (
    <div className={styles.kpiContent}>
      <div className={styles.summaryTitle}>{title}</div>
      <div className={styles.kpiValue}>{value}</div>
      {subtitle ? <div className={styles.summaryLabel}>{subtitle}</div> : null}
    </div>
  ) : (
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
