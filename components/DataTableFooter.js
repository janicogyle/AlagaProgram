import styles from './DataTableFooter.module.css';

export default function DataTableFooter({ 
  showing, 
  total, 
  itemName = 'items' 
}) {
  return (
    <div className={styles.footer}>
      <span className={styles.count}>
        Showing {showing} of {total} {itemName}
      </span>
    </div>
  );
}
