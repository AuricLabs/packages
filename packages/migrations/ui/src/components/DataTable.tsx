import { Fragment, useState, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowData,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { TableSkeleton } from './TableSkeleton';

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  initialSorting?: SortingState;
  /**
   * Renders an expandable detail panel below the row when set. Return `null`
   * to disable expansion for a specific row (e.g. when there is nothing to
   * show). When provided, an extra leading chevron column is added.
   */
  renderExpansion?: (row: TData) => ReactNode | null;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  loading,
  onRowClick,
  getRowId,
  initialSorting,
  renderExpansion,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
  });

  if (loading) {
    return <TableSkeleton rows={8} />;
  }

  const expansionEnabled = !!renderExpansion;
  const totalCols = columns.length + (expansionEnabled ? 1 : 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {expansionEnabled && (
                  <th className="w-8 border-b border-zinc-800" aria-hidden="true" />
                )}
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 border-b border-zinc-800 select-none"
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : undefined }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="size-3.5" />,
                        desc: <ChevronDown className="size-3.5" />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const expansionContent = renderExpansion ? renderExpansion(row.original) : null;
              const canExpand = expansionEnabled && expansionContent !== null;
              const isOpen = canExpand && !!expanded[row.id];

              return (
                <Fragment key={row.id}>
                  <tr
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {expansionEnabled && (
                      <td className="w-8 px-2 py-3 text-zinc-500">
                        {canExpand ? (
                          <button
                            type="button"
                            aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                            className="p-1 rounded hover:bg-zinc-700/50 hover:text-zinc-200 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
                            }}
                          >
                            {isOpen ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-zinc-300">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="bg-zinc-900/40">
                      <td colSpan={totalCols} className="px-4 py-3">
                        {expansionContent}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Rows per page</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-sm outline-none focus:border-zinc-600"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount() || 1}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
