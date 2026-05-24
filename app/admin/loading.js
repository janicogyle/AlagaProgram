import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.skeletonContainer}>
      {/* Header Skeleton */}
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonTitle}></div>
        <div className={styles.skeletonSubtitle}></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className={styles.skeletonStatsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.skeletonStatCard}>
            <div className={styles.skeletonIcon}></div>
            <div className={styles.skeletonStatContent}>
              <div className={styles.skeletonStatTitle}></div>
              <div className={styles.skeletonStatValue}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className={styles.skeletonMainContent}>
        <div className={styles.skeletonChart}>
           <div className={styles.skeletonChartHeader}></div>
           <div className={styles.skeletonChartBody}></div>
        </div>
        <div className={styles.skeletonList}>
           <div className={styles.skeletonListHeader}></div>
           {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className={styles.skeletonListItem}></div>
           ))}
        </div>
      </div>
    </div>
  );
}