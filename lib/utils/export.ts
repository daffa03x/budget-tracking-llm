type CsvValue = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

function escapeCsvValue(value: CsvValue) {
  const text = value === null || value === undefined ? "" : String(value);
  const normalizedText = text.replace(/\r?\n/g, " ");

  if (!/[",\n]/.test(normalizedText)) {
    return normalizedText;
  }

  return `"${normalizedText.replace(/"/g, '""')}"`;
}

export function serializeCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(","),
  );

  return [header, ...body].join("\n");
}
