/**
 * CSV serialisation + browser download helper.
 *
 * Exported files are UTF-8 with a BOM so that Excel on Windows renders the
 * Devanagari/Indic glyphs and leading zeros correctly.
 */

export type CsvValue = string | number | boolean | null | undefined
export type CsvRow = Record<string, CsvValue>

const BOM = '\uFEFF'

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Guard against spreadsheet formula injection in exported cells.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/** Convert rows into a CSV string. Column order follows `columns` when given. */
export function rowsToCsv(rows: CsvRow[], columns?: string[]): string {
  const headers =
    columns ??
    (rows.length > 0
      ? Array.from(rows).reduce<string[]>((acc, row) => {
          for (const key of Object.keys(row)) if (!acc.includes(key)) acc.push(key)
          return acc
        }, [])
      : [])

  const lines: string[] = []
  if (headers.length > 0) {
    lines.push(headers.map((header) => escapeCell(header)).join(','))
  }
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','))
  }
  return lines.join('\r\n')
}

/** Trigger a client-side download of the given CSV content. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Convenience wrapper: rows -> CSV -> browser download. */
export function exportRowsToCsv(
  filename: string,
  rows: CsvRow[],
  columns?: string[],
): number {
  const csv = rowsToCsv(rows, columns)
  downloadCsv(filename, csv)
  return rows.length
}
