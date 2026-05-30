import styles from './DataTableFooter.module.css';

export default function DataTableFooter({ 
  showing, 
  total, 
  itemName = 'items',
  page = 1,
  pageSize,
  totalPages,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
}) {
  const hasPagination =
    typeof pageSize === 'number' &&
    typeof totalPages === 'number' &&
    typeof onPageChange === 'function' &&
    typeof onPageSizeChange === 'function';
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page || 1), safeTotalPages);

  return (
    <div className={styles.footer}>
      <span className={styles.count}>
        Showing {showing} of {total} {itemName}
      </span>
      {hasPagination ? (
        <div className={styles.pagination}>
          <label className={styles.pageSizeLabel}>
            Rows
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.pageControls}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage <= 1}
            >
              Previous
            </button>
            <span className={styles.pageText}>
              Page {safePage} of {safeTotalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= safeTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
