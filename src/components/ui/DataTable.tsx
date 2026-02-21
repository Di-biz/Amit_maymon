'use client';

import { useState } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends object>({
  columns,
  data,
  searchPlaceholder = 'חיפוש...',
  searchKeys,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rowRecord = (row: T) => row as Record<string, unknown>;

  let filtered = data;
  if (search && searchKeys && searchKeys.length > 0) {
    const s = search.toLowerCase();
    filtered = data.filter((row) =>
      searchKeys.some((k) => String(rowRecord(row)[k as string] ?? '').toLowerCase().includes(s))
    );
  }

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const va = rowRecord(a)[sortKey];
      const vb = rowRecord(b)[sortKey];
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return (
    <div className="space-y-2">
      {(searchKeys?.length ?? 0) > 0 && (
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full max-w-xs"
        />
      )}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortKey(sortKey === col.key ? sortKey : col.key);
                      setSortDir(
                        sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc'
                      );
                    }}
                  >
                    {col.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((row) => (
              <tr
                key={rowKey(row as T)}
                onClick={() => onRowClick?.(row as T)}
                className={
                  onRowClick
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : ''
                }
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-sm">
                    {col.render
                      ? col.render(row as T)
                      : String(rowRecord(row)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
