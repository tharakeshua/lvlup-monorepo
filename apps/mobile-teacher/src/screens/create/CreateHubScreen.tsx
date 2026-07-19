/**
 * CreateHubScreen — the "Create" tab root for the teacher authoring lane.
 *
 * Two primary paths:
 *   1. Exam creation wizard (camera/gallery/PDF → extract → review → publish)
 *   2. AI generate content (pick space/story point → spec → drafts → accept)
 *
 * CC-7 plugs the full 15-type item editor lane into this tab via the item-editor
 * route. This screen shows a "Continue on web" affordance for features not yet
 * native (full space management, bulk edits, rubric builder).
 */
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { FeatureActionCard, Icon, Screen, SectionHeader, TeacherHero } from "../../components";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";

function WebAffordanceRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text className="text-text-secondary flex-1 text-sm">{label}</Text>
      <View className="bg-surface-sunken rounded-full px-2 py-0.5">
        <Text className="text-text-muted text-xs">Web</Text>
      </View>
    </View>
  );
}

export default function CreateHubScreen() {
  const router = useRouter();

  return (
    <Screen contentClassName="gap-6">
      <TeacherHero
        eyebrow="Authoring studio"
        title="Make the next great lesson"
        subtitle="Start from a paper, a prompt, or a blank page. Everything stays editable before students see it."
        icon="wand-sparkles"
      >
        <View className="flex-row items-center gap-2">
          <View className="bg-surface/80 rounded-pill flex-row items-center gap-1.5 px-3 py-1.5">
            <Icon name="shield-check" size={13} color={colors.success} />
            <Text className="font-ui text-text-secondary text-xs">Draft-first publishing</Text>
          </View>
          <View className="bg-surface/80 rounded-pill flex-row items-center gap-1.5 px-3 py-1.5">
            <Icon name="sparkles" size={13} color={colors.spark} />
            <Text className="font-ui text-text-secondary text-xs">AI assisted</Text>
          </View>
        </View>
      </TeacherHero>

      <View className="gap-3">
        <SectionHeader
          title="Start creating"
          subtitle="Choose the workflow that fits the material."
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FeatureActionCard
              icon="file-scan"
              eyebrow="Assessment"
              title="Create exam"
              description="Scan or upload a paper and review extracted questions."
              tone="brand"
              onPress={() => router.push(routes.examWizard())}
            />
          </View>
          <View className="flex-1">
            <FeatureActionCard
              icon="sparkles"
              eyebrow="Copilot"
              title="Generate"
              badge="AI"
              description="Turn a learning objective into editable draft items."
              tone="spark"
              onPress={() => router.push(routes.generateContent())}
            />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FeatureActionCard
              icon="pencil-line"
              eyebrow="From scratch"
              title="New item"
              description="Build any question or learning material with full control."
              tone="sky"
              onPress={() => router.push(routes.itemEditor())}
            />
          </View>
          <View className="flex-1">
            <FeatureActionCard
              icon="library"
              eyebrow="Reuse"
              title="Question bank"
              description="Find, refine, and reuse your strongest questions."
              tone="brand"
              onPress={() => router.push(routes.questionBank())}
            />
          </View>
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader
          title="Continue on web"
          subtitle="Complex curriculum operations stay available on the larger canvas."
        />
        <View className="bg-surface border-border-subtle rounded-xl border px-4 py-2 shadow-sm">
          <WebAffordanceRow icon="layout-template" label="Space & story point management" />
          <View className="bg-border-subtle h-px" />
          <WebAffordanceRow icon="sliders" label="Rubric builder & evaluation settings" />
          <View className="bg-border-subtle h-px" />
          <WebAffordanceRow icon="bot" label="AI agent configuration" />
        </View>
      </View>
    </Screen>
  );
}
