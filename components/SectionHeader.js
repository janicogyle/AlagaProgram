import styles from './SectionHeader.module.css';

export default function SectionHeader({ id, title, subtitle, align = 'left' }) {
  return (
    <div className={styles.sectionHeader} style={{ textAlign: align }}>
      <h3 id={id} className={styles.sectionTitle}>{title}</h3>
      {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
    </div>
  );
}
