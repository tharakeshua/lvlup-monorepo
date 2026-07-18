import { useState } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import { useExams, useClasses, useGenerateReport } from "@levelup/query";
import type { Exam, Class } from "@levelup/shared-types";
import type { ExamId, ClassId } from "@levelup/domain";
import {
  DownloadPDFButton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
} from "@levelup/shared-ui";
import { FileText, Users } from "lucide-react";
import { pageItems } from "@/lib/utils";

export default function ReportsPage() {
  const tenantId = useCurrentTenantId();
  const exams = pageItems<Exam>(useExams({}).data);
  const classes = pageItems<Class>(useClasses({}).data);
  const generateReport = useGenerateReport();
  const [activeTab, setActiveTab] = useState<"exams" | "classes">("exams");

  const publishedExams = exams.filter(
    (e) => e.status === "grading" || e.status === "completed" || e.status === "results_released"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Generate and download PDF reports for exams and classes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "exams" | "classes")}>
        <TabsList>
          <TabsTrigger value="exams">Exam Reports</TabsTrigger>
          <TabsTrigger value="classes">Class Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="exams">
          <div className="space-y-3">
            {publishedExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <FileText className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground mt-2 text-sm">
                  No exams with results available yet
                </p>
              </div>
            ) : (
              publishedExams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="font-medium">{exam.title}</h3>
                      <p className="text-muted-foreground text-xs">
                        {exam.subject} &middot; {exam.totalMarks} marks &middot;{" "}
                        {exam.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tenantId && (
                        <DownloadPDFButton
                          onGenerate={async () => {
                            const res = await generateReport.mutateAsync({
                              kind: "exam",
                              examId: exam.id as ExamId,
                            });
                            return { downloadUrl: res.pdfUrl };
                          }}
                          label="Class Summary PDF"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="classes">
          <div className="space-y-3">
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Users className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground mt-2 text-sm">No classes found</p>
              </div>
            ) : (
              classes.map((cls) => (
                <Card key={cls.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="font-medium">{cls.name}</h3>
                      <p className="text-muted-foreground text-xs">
                        {[cls.grade, cls.section].filter(Boolean).join(" - ") || cls.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tenantId && (
                        <DownloadPDFButton
                          onGenerate={async () => {
                            const res = await generateReport.mutateAsync({
                              kind: "class",
                              classId: cls.id as ClassId,
                            });
                            return { downloadUrl: res.pdfUrl };
                          }}
                          label="Class Report PDF"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
