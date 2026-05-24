import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <div className={styles.loadingText}>Loading, please wait...</div>
    </div>
  );
}