import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  sonnerToast,
} from "@levelup/shared-ui";

/** Grading pipeline toggles — UI placeholders until tenant grading config API lands. */
export default function GradingConfigPanel() {
  const [parallelGrading, setParallelGrading] = useState(true);
  const [ocrFallback, setOcrFallback] = useState(true);
  const [defaultPipeline, setDefaultPipeline] = useState("standard");

  const handleSaveStub = () => {
    // TODO(#teacher-grading-config): persist via v1.autograde.saveGradingConfig when callable ships
    sonnerToast.info("Grading config saved locally — server persistence pending API");
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-muted-foreground h-5 w-5" />
          <h2 className="font-display text-lg font-semibold">Grading Pipeline</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure how answer sheets move through scouting, OCR, and AI grading. These controls are
          placeholders until the grading-config callable is available.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Parallel question grading</p>
            <p className="text-muted-foreground text-xs">Grade multiple questions concurrently</p>
          </div>
          <Switch checked={parallelGrading} onCheckedChange={setParallelGrading} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">OCR fallback</p>
            <p className="text-muted-foreground text-xs">
              Retry with enhanced OCR when handwriting is unclear
            </p>
          </div>
          <Switch checked={ocrFallback} onCheckedChange={setOcrFallback} />
        </div>

        <div>
          <Label>Default pipeline</Label>
          <Select value={defaultPipeline} onValueChange={setDefaultPipeline}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (scout → grade)</SelectItem>
              <SelectItem value="fast">Fast (skip deep scouting)</SelectItem>
              <SelectItem value="manual">Manual review first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSaveStub} variant="outline">
          Save Grading Config
        </Button>
      </CardContent>
    </Card>
  );
}
