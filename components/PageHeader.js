import styles from './PageHeader.module.css';

export default function PageHeader({ 
  title, 
  subtitle, 
  children,
  className = '' 
}) {
  return (
    <div className={`${styles.pageHeader} ${className}`}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
