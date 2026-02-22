import styles from './Card.module.css';

export default function Card({ 
  children, 
  title, 
  subtitle,
  headerAction,
  className = '',
  padding = true 
}) {
  return (
    <div className={`${styles.card} ${padding ? styles.withPadding : ''} ${className}`}>
      {(title || subtitle) && (
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderText}>
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
          {headerAction && <div className={styles.cardHeaderAction}>{headerAction}</div>}
        </div>
      )}
      <div className={styles.cardContent}>
        {children}
      </div>
    </div>
  );
}
