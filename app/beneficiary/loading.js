import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.skeletonContainer}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonProfilePic}></div>
        <div className={styles.skeletonHeaderInfo}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonSubtitle}></div>
        </div>
      </div>

      <div className={styles.skeletonActionGrid}>
        {[1, 2].map((i) => (
          <div key={i} className={styles.skeletonActionCard}></div>
        ))}
      </div>

      <div className={styles.skeletonRecordContent}>
        <div className={styles.skeletonRecordHeader}></div>
        <div className={styles.skeletonRecordBody}>
           {[1, 2, 3].map((i) => (
             <div key={i} className={styles.skeletonRecordItem}></div>
           ))}
        </div>
      </div>
    </div>
  );
}