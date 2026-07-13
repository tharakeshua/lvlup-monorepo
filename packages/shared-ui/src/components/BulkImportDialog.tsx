import * as React from "react";
import { parseCSVLine } from "@levelup/shared-utils/csv";
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

interface ParsedRow {
  [key: string]: string;
}

interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  requiredColumns: string[];
  optionalColumns?: string[];
  onSubmit: (rows: ParsedRow[]) => Promise<void>;
  validateRow?: (row: ParsedRow, index: number) => ValidationError[];
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]!);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!);
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

export function BulkImportDialog({
  open,
  onOpenChange,
  title = "Bulk Import",
  description = "Upload a CSV file to import records.",
  requiredColumns,
  optionalColumns = [],
  onSubmit,
  validateRow,
}: BulkImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setErrors([]);
    setSubmitting(false);
    setSubmitted(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setSubmitted(false);

    const text = await f.text();
    const { headers: h, rows: r } = parseCSV(text);
    setHeaders(h);
    setRows(r);

    // Validate required columns
    const missingColumns = requiredColumns.filter(
      (col) => !h.map((x) => x.toLowerCase()).includes(col.toLowerCase())
    );
    const validationErrors: ValidationError[] = [];
    if (missingColumns.length > 0) {
      validationErrors.push({
        rowIndex: -1,
        field: "headers",
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      });
    }

    // Row-level validation
    if (validateRow && missingColumns.length === 0) {
      r.forEach((row, idx) => {
        validationErrors.push(...validateRow(row, idx));
      });
    }

    setErrors(validationErrors);
  };

  const handleSubmit = async () => {
    if (errors.length > 0 || rows.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(rows);
      setSubmitted(true);
    } catch {
      setErrors([{ rowIndex: -1, field: "submit", message: "Import failed. Please try again." }]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (openState: boolean) => {
    if (!openState) reset();
    onOpenChange(openState);
  };

  const allColumns = [...requiredColumns, ...optionalColumns];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold">Import Successful</p>
            <p className="text-muted-foreground text-sm">
              {rows.length} record(s) imported successfully.
            </p>
          </div>
        ) : (
          <>
            {/* File upload area */}
            {!file ? (
              <div
                className="hover:border-primary/50 hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="text-muted-foreground h-10 w-10" />
                <div className="text-center">
                  <p className="font-medium">Click to upload CSV</p>
                  <p className="text-muted-foreground text-sm">
                    Required: {requiredColumns.join(", ")}
                  </p>
                  {optionalColumns.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Optional: {optionalColumns.join(", ")}
                    </p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <>
                {/* File info */}
                <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2">
                  <FileSpreadsheet className="text-muted-foreground h-4 w-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-muted-foreground text-xs">({rows.length} rows)</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={reset}>
                    Change file
                  </Button>
                </div>

                {/* Errors */}
                {errors.length > 0 && (
                  <div className="border-destructive/50 bg-destructive/5 rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertCircle className="text-destructive h-4 w-4" />
                      <span className="text-destructive text-sm font-medium">
                        {errors.length} validation error(s)
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {errors.slice(0, 10).map((err, i) => (
                        <li key={i} className="text-destructive text-xs">
                          {err.rowIndex >= 0 ? `Row ${err.rowIndex + 1}: ` : ""}
                          {err.message}
                        </li>
                      ))}
                      {errors.length > 10 && (
                        <li className="text-muted-foreground text-xs">
                          ...and {errors.length - 10} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview table */}
                {rows.length > 0 && (
                  <ScrollArea className="max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          {allColumns
                            .filter((col) =>
                              headers.map((h) => h.toLowerCase()).includes(col.toLowerCase())
                            )
                            .map((col) => (
                              <TableHead key={col}>
                                {col}
                                {requiredColumns.includes(col) && (
                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                    req
                                  </Badge>
                                )}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 20).map((row, idx) => {
                          const rowErrors = errors.filter((e) => e.rowIndex === idx);
                          return (
                            <TableRow
                              key={idx}
                              className={rowErrors.length > 0 ? "bg-destructive/5" : ""}
                            >
                              <TableCell className="text-muted-foreground text-xs">
                                {idx + 1}
                              </TableCell>
                              {allColumns
                                .filter((col) =>
                                  headers.map((h) => h.toLowerCase()).includes(col.toLowerCase())
                                )
                                .map((col) => {
                                  const matchingHeader = headers.find(
                                    (h) => h.toLowerCase() === col.toLowerCase()
                                  );
                                  return (
                                    <TableCell key={col} className="text-xs">
                                      {matchingHeader ? (row[matchingHeader] ?? "") : ""}
                                    </TableCell>
                                  );
                                })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {rows.length > 20 && (
                      <p className="text-muted-foreground mt-2 text-center text-xs">
                        Showing first 20 of {rows.length} rows
                      </p>
                    )}
                  </ScrollArea>
                )}
              </>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {submitted ? "Close" : "Cancel"}
          </Button>
          {!submitted && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || errors.length > 0 || rows.length === 0}
            >
              {submitting ? "Importing..." : `Import ${rows.length} Record(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
