import { useState } from "react";
import { useApiError, useExportTenantData } from "@levelup/query";
import { sonnerToast as toast } from "@levelup/shared-ui";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@levelup/shared-ui";
import { Download, Check } from "lucide-react";

// Aligned to the exportTenantData contract enum (zExportCollection). The legacy
// "submissions" scope is not part of the contract; "parents"/"analytics" are.
const EXPORT_COLLECTIONS = [
  "students",
  "teachers",
  "parents",
  "classes",
  "exams",
  "analytics",
] as const;

interface Props {
  tenantId: string;
}

export function TenantDataExportCard({ tenantId }: Props) {
  const { handleError } = useApiError();
  // GAP: the exportTenantData contract takes no `format` field, so the JSON/CSV
  // selector below is informational only and is not sent to the server.
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv");
  const [exportCollections, setExportCollections] = useState<string[]>([
    "students",
    "teachers",
    "classes",
  ]);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const exportMut = useExportTenantData();
  const exporting = exportMut.isPending;

  const handleExport = async () => {
    if (exportCollections.length === 0) return;
    setExportUrl(null);
    try {
      // The contract requires a single `scope`; we export the union via "all"
      // and pass the chosen collections as the per-collection filter.
      const result = (await exportMut.mutateAsync({
        tenantOverride: tenantId,
        scope: "all",
        collections: exportCollections,
      })) as { downloadUrl: string; expiresAt: string };
      setExportUrl(result.downloadUrl);
      toast.success("Export ready");
    } catch (err) {
      handleError(err, "Failed to export data");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {EXPORT_COLLECTIONS.map((col) => {
            const isSelected = exportCollections.includes(col);
            return (
              <Button
                key={col}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setExportCollections((prev) =>
                    prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                  )
                }
                className="h-7 gap-1 text-xs capitalize"
              >
                {isSelected && <Check className="h-3 w-3" />}
                {col}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "json" | "csv")}>
            <SelectTrigger className="h-9 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExport}
            disabled={exporting || exportCollections.length === 0}
            size="sm"
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>
        {exportUrl && (
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download export (expires in 1 hour)
          </a>
        )}
      </CardContent>
    </Card>
  );
}
