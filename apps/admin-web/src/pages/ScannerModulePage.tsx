import { Link } from "react-router-dom";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from "@levelup/shared-ui";
import { ScanLine, QrCode, FileText, ExternalLink } from "lucide-react";

/**
 * Admin placeholder for scanner orchestration — provisioning, active sessions,
 * and pipeline status. See docs/scanner/SCANNER-MODULE.md.
 */
export default function ScannerModulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scanner Operations"
        description="Manual Agent (QR + answer-sheet capture) — module stub"
      />

      <Alert>
        <ScanLine className="h-4 w-4" />
        <AlertTitle>Scaffold only</AlertTitle>
        <AlertDescription>
          Scanner PWA and session callables are planned in P0-3. Service stubs live in{" "}
          <code className="text-xs">packages/services/src/scanner/orchestration.ts</code>.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" /> QR Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>Start session → attach student QR → upload pages → close with signature.</p>
            <p className="text-2xs font-medium uppercase tracking-wide text-amber-600">
              TODO: startScannerSession
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4" /> Active scanners
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>Monitor field agents, failed uploads, and requeue pipeline jobs.</p>
            <p className="text-2xs font-medium uppercase tracking-wide text-amber-600">
              TODO: admin session list
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Docs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Architecture stub and security invariants for the Manual Agent journey.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/bulk-import">
                Provision scanners via Bulk Import
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
