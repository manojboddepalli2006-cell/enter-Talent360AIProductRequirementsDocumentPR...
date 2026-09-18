/**
 * Minimal CSV export used by the AI Decision Log and reporting surfaces.
 * Values are quoted and internal quotes escaped so exports open cleanly.
 */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows.length) return "";
  const keys = columns ?? Object.keys(rows[0]);

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = keys.map(escape).join(",");
  const body = rows.map((row) => keys.map((key) => escape(row[key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>, columns?: string[]): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
