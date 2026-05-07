import styles from './EmptyState.module.css';

export default function EmptyState({ 
  icon,
  title = 'No data found',
  description,
  action
}) {
  const defaultIcon = (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );

  return (
    <div className={styles.emptyState}>
      <div className={styles.icon}>
        {icon || defaultIcon}
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
