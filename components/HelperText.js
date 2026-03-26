import styles from './HelperText.module.css';

export default function HelperText({ children }) {
  return <p className={styles.helperText}>{children}</p>;
}
