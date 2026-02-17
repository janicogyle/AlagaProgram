import styles from './FilterBar.module.css';

export default function FilterBar({ children, className = '' }) {
  return (
    <div className={`${styles.filterBar} ${className}`}>
      {children}
    </div>
  );
}
