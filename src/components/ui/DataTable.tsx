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
    <div className="space-y-4 p-4">
      {(searchKeys?.length ?? 0) > 0 && (
        <div className="relative">
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortKey(sortKey === col.key ? sortKey : col.key);
                      setSortDir(
                        sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc'
                      );
                    }}
                    className="hover:text-indigo-600 transition-colors flex items-center gap-1"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-indigo-600">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">📭</span>
                    <span>לא נמצאו תוצאות</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={rowKey(row as T)}
                  onClick={() => onRowClick?.(row as T)}
                  className={
                    onRowClick
                      ? 'hover:bg-indigo-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-indigo-400'
                      : ''
                  }
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 text-sm text-gray-700">
                      {col.render
                        ? col.render(row as T)
                        : String(rowRecord(row)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
