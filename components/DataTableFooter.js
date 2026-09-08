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
      <span className={styles.count} role="status" aria-live="polite">
        {hasPagination && showing > 0 ? `Showing ${(safePage - 1) * pageSize + 1}\u2013${Math.min((safePage - 1) * pageSize + showing, total)}` : `Showing ${showing}`} of {total} {itemName}
      </span>
      {hasPagination ? (
        <div className={styles.pagination}>
          <label className={styles.pageSizeLabel}>
            Rows per page
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
              aria-label="Previous page"
              title="Previous page"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.pageText}>
              Page {safePage} of {safeTotalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= safeTotalPages}
              aria-label="Next page"
              title="Next page"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
