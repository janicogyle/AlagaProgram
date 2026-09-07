import styles from './Table.module.css';

export default function Table({ 
  columns, 
  data, 
  emptyMessage = 'No data available',
  fitToContainer = false,
  label = 'Results',
}) {
  return (
    <div className={styles.tableWrapper} role="region" aria-label={label} tabIndex={0}>
      <table className={`${styles.table} ${fitToContainer ? styles.fitTable : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={styles.th} data-column={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className={styles.tr}>
                {columns.map((column) => (
                  <td key={column.key} className={styles.td} data-column={column.key}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
