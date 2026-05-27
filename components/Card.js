import styles from './Card.module.css';

export default function Card({ 
  children, 
  title, 
  subtitle,
  headerAction,
  className = '',
  padding = true,
  fillHeight = false,
}) {
  return (
    <div
      className={`${styles.card} ${padding ? styles.withPadding : ''} ${fillHeight ? styles.fillHeight : ''} ${className}`}
    >
      {(title || subtitle) && (
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderText}>
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
          {headerAction && <div className={styles.cardHeaderAction}>{headerAction}</div>}
        </div>
      )}
      <div className={`${styles.cardContent} ${fillHeight ? styles.fillHeightContent : ''}`}>
        {children}
      </div>
    </div>
  );
}
