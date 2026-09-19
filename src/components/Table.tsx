import { useMemo, useState, type ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ columns, rows, rowKey, onRowClick }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
  }, [rows, sortKey, sortDir, columns]);

  function onHeaderClick(column: TableColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(column.key);
      setSortDir(1);
    }
  }

  return (
    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              onClick={() => onHeaderClick(column)}
              style={{
                cursor: column.sortValue ? "pointer" : "default",
                textAlign: column.align ?? "left",
                borderBottom: "1px solid var(--color-line-strong)",
                padding: "8px 10px",
                fontSize: 11.5,
                color: "var(--color-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ cursor: onRowClick ? "pointer" : undefined }}
          >
            {columns.map((column) => (
              <td
                key={column.key}
                style={{
                  textAlign: column.align ?? "left",
                  borderBottom: "1px solid var(--color-line)",
                  padding: "9px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
