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
import { Text, View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../../components";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";

interface ActionCardProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
}

function ActionCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  badge,
  onPress,
}: ActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border-border-subtle active:bg-surface-sunken flex-row items-center gap-4 rounded-xl border p-4"
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-display text-text-primary text-base font-semibold">{title}</Text>
          {badge && (
            <View className="bg-brand-subtle rounded-full px-2 py-0.5">
              <Text className="text-brand text-xs font-semibold">{badge}</Text>
            </View>
          )}
        </View>
        <Text className="text-text-muted text-sm">{description}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

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
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-bold">Create</Text>
          <Text className="text-text-muted text-sm">Build exams and content for your classes.</Text>
        </View>

        {/* Primary actions */}
        <View className="gap-3">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
            Authoring
          </Text>
          <ActionCard
            icon="file-scan"
            iconColor="#423A82"
            iconBg="#EDE9FC"
            title="Create Exam"
            description="Upload question paper, extract questions, and publish."
            onPress={() => router.push(routes.examWizard())}
          />
          <ActionCard
            icon="sparkles"
            iconColor="#B45309"
            iconBg="#FEF3C7"
            title="Generate with AI"
            badge="AI"
            description="Pick a story point and generate draft items instantly."
            onPress={() => router.push(routes.generateContent())}
          />
        </View>

        {/* CC-7 item editor entry (plugged in by CC-7 lane) */}
        <View className="gap-3">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
            Items
          </Text>
          <ActionCard
            icon="pencil-line"
            iconColor="#0369A1"
            iconBg="#E0F2FE"
            title="New Item"
            description="Create a question or material for any story point."
            onPress={() => router.push(routes.itemEditor())}
          />
        </View>

        {/* Continue on web affordances */}
        <View className="gap-2">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
            Full authoring suite (web)
          </Text>
          <View className="bg-surface border-border-subtle rounded-xl border px-4 py-2">
            <WebAffordanceRow icon="layout-template" label="Space & story point management" />
            <View className="bg-border-subtle h-px" />
            <WebAffordanceRow icon="sliders" label="Rubric builder & evaluation settings" />
            <View className="bg-border-subtle h-px" />
            <WebAffordanceRow icon="database" label="Question bank & bulk import" />
            <View className="bg-border-subtle h-px" />
            <WebAffordanceRow icon="bot" label="AI agent configuration" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
