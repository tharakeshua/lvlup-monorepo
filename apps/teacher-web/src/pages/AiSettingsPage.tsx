import { Link } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  Card,
  CardContent,
  Badge,
} from "@levelup/shared-ui";
import { Bot, BookOpen, Sliders, Sparkles } from "lucide-react";
import RubricPresetsPanel from "../components/ai-settings/RubricPresetsPanel";
import EvaluationSettingsPanel from "../components/ai-settings/EvaluationSettingsPanel";
import GradingConfigPanel from "../components/ai-settings/GradingConfigPanel";

export default function AiSettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>AI Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-xl font-semibold">AI Settings</h1>
        <p className="text-muted-foreground text-sm">
          Rubric presets, evaluation behavior, agents, and grading configuration
        </p>
      </div>

      <Tabs defaultValue="presets" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="presets" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Rubric Presets
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Evaluation
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Agents
          </TabsTrigger>
          <TabsTrigger value="grading" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Grading
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presets">
          <RubricPresetsPanel />
        </TabsContent>

        <TabsContent value="evaluation">
          <EvaluationSettingsPanel />
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <Bot className="text-muted-foreground h-5 w-5" />
                <h2 className="font-display text-lg font-semibold">AI Agents</h2>
                <Badge variant="outline" className="text-xs">
                  Per space
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Evaluator, tutor, and interviewer agents are configured inside each learning space.
                Open a space editor to manage agent identity, prompts, strictness, and model policy.
              </p>
              {/* TODO(#teacher-agents-tenant): add tenant-wide agent templates when v1.levelup.listAgents supports scope=tenant */}
              <Link
                to="/spaces"
                className="text-brand inline-flex text-sm font-medium underline underline-offset-2"
              >
                Open Spaces to configure agents
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grading">
          <GradingConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
