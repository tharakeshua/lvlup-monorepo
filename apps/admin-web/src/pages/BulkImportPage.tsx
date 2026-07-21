import { useState } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import { useBulkImportStudents, useBulkImportTeachers } from "@levelup/query";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  BulkImportDialog,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from "@levelup/shared-ui";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  BULK_IMPORT_TEMPLATES,
  bulkImportParents,
  bulkImportScanners,
  bulkImportStaff,
  type BulkImportEntity,
} from "@/lib/bulk-import-callables";

const TAB_LABELS: Record<BulkImportEntity, string> = {
  students: "Students",
  teachers: "Teachers",
  parents: "Parents",
  staff: "Staff",
  scanners: "Scanners",
};

const IMPLEMENTED: Record<BulkImportEntity, boolean> = {
  students: true,
  teachers: true,
  parents: false,
  staff: false,
  scanners: false,
};

export default function BulkImportPage() {
  const tenantId = useCurrentTenantId();
  const bulkImportStudents = useBulkImportStudents();
  const bulkImportTeachers = useBulkImportTeachers();
  const [activeTab, setActiveTab] = useState<BulkImportEntity>("students");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit = async (rows: Record<string, string>[]) => {
    if (!tenantId) {
      toast.error("No active school session");
      return;
    }

    try {
      switch (activeTab) {
        case "students": {
          const importRows = rows.map((row) => {
            const classId = row["classId"] ?? row["class_id"];
            return {
              firstName: row["firstName"] ?? row["first_name"] ?? "",
              lastName: row["lastName"] ?? row["last_name"] ?? "",
              rollNumber: row["rollNumber"] ?? row["roll_number"] ?? undefined,
              email: row["email"] ?? undefined,
              section: row["section"] ?? undefined,
              classIds: classId ? [classId] : undefined,
            };
          });
          await bulkImportStudents.mutateAsync({ rows: importRows });
          toast.success("Students imported");
          break;
        }
        case "teachers": {
          const importRows = rows.map((row) => ({
            firstName: row["firstName"] ?? row["first_name"] ?? "",
            lastName: row["lastName"] ?? row["last_name"] ?? "",
            email: row["email"] ?? undefined,
            subjects: row["subjects"]
              ? row["subjects"]
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
          }));
          await bulkImportTeachers.mutateAsync({ rows: importRows });
          toast.success("Teachers imported");
          break;
        }
        case "parents":
          await bulkImportParents({ tenantId, rows });
          break;
        case "staff":
          await bulkImportStaff({ tenantId, rows });
          break;
        case "scanners":
          await bulkImportScanners({ tenantId, rows });
          break;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk import failed");
      throw error;
    }
  };

  const template = BULK_IMPORT_TEMPLATES[activeTab];
  const requiredColumns =
    activeTab === "students"
      ? ["firstName", "lastName", "rollNumber"]
      : activeTab === "teachers"
        ? ["firstName", "lastName", "email"]
        : ["firstName", "lastName", "email"];
  const optionalColumns = template.columns.filter((c) => !requiredColumns.includes(c));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Import"
        description="CSV upload for teachers, students, parents, staff, and scanner accounts"
      />

      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertTitle>Roadmap hub</AlertTitle>
        <AlertDescription>
          Students and teachers use live callables. Parents, staff, and scanners show CSV UI
          placeholders until P0-2 callables land — see{" "}
          <code className="text-xs">docs/PRODUCT-IMPROVEMENTS-ROADMAP.md</code>.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BulkImportEntity)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {(Object.keys(TAB_LABELS) as BulkImportEntity[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABELS[key]}
              {!IMPLEMENTED[key] ? " (planned)" : ""}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as BulkImportEntity[]).map((entity) => (
          <TabsContent key={entity} value={entity} className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import {TAB_LABELS[entity]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!IMPLEMENTED[entity] && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Callable not implemented</AlertTitle>
                    <AlertDescription>
                      CSV preview works; submit will fail until sdk-v1{" "}
                      <code className="text-xs">
                        bulkImport{entity.charAt(0).toUpperCase() + entity.slice(1)}
                      </code>{" "}
                      is added.
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-muted-foreground text-sm">
                  Expected columns:{" "}
                  <code className="text-xs">
                    {BULK_IMPORT_TEMPLATES[entity].columns.join(", ")}
                  </code>
                </p>

                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <BulkImportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`Import ${TAB_LABELS[activeTab]}`}
        description={`Upload a CSV with columns: ${template.columns.join(", ")}`}
        requiredColumns={requiredColumns}
        optionalColumns={optionalColumns}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
