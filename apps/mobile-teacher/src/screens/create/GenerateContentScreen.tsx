/**
 * GenerateContentScreen — AI content generation flow.
 *
 * 3-step flow:
 *   Step 0 — Pick space (from useSpaces list)
 *   Step 1 — Pick story point (from useStoryPoints for the selected space)
 *   Step 2 — Spec form + generate + drafts review
 *
 * The generate flow mirrors GenerateContentPanel.tsx (teacher-web) adapted for RN:
 *   PDF source upload → useGenerateContent → drafts → useSaveItem per accepted draft.
 *
 * Optional `spaceId`/`storyPointId` query params allow deep-linking from the
 * Create Hub or from a future space-detail screen (CC-7).
 */
import { useState, useMemo, useCallback } from "react";
import { Text, View, Pressable, ActivityIndicator, FlatList, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  useSpaces,
  useStoryPoints,
  useGenerateContent,
  useSaveItem,
  useApiError,
  asApiError,
} from "@levelup/query";

import { Button, Card, Icon, Screen, SearchField, Badge, Chip } from "../../components";
import { colors } from "../../theme";
import { useContentSourceUpload } from "../../lib/media-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpaceRow {
  id?: string;
  title?: string;
  subject?: string;
  status?: string;
}

interface StoryPointRow {
  id?: string;
  title?: string;
  orderIndex?: number;
}

interface GeneratedDraft {
  itemType: string;
  questionType?: string;
  title: string;
  payload: unknown;
  bloomsLevel?: string;
  topics?: string[];
}

type DifficultyKey = "" | "easy" | "medium" | "hard" | "expert";

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "mcaq", label: "Multiple Correct" },
  { value: "true-false", label: "True/False" },
  { value: "numerical", label: "Numerical" },
  { value: "text", label: "Short Answer" },
  { value: "paragraph", label: "Long Answer" },
  { value: "code", label: "Code" },
  { value: "fill-blanks", label: "Fill Blanks" },
  { value: "matching", label: "Matching" },
  { value: "jumbled", label: "Reorder" },
];

const DIFFICULTIES: Array<{ key: DifficultyKey; label: string }> = [
  { key: "", label: "Any" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "expert", label: "Expert" },
];

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function readableGenerateError(err: unknown): string {
  const api = asApiError(err);
  if (api.code === "RATE_LIMITED") return "Generation limit reached. Wait a moment and try again.";
  if (api.code === "PRECONDITION_FAILED")
    return "PDF too large (max 14 MB) or content moderation blocked this request.";
  return api.message ?? "Generation failed. Please try again.";
}

function flattenSpaces(data: unknown): SpaceRow[] {
  if (!data || typeof data !== "object") return [];
  const d = data as { pages?: Array<{ items?: SpaceRow[] }> };
  return (d.pages ?? []).flatMap((p) => p.items ?? []);
}

function flattenPoints(data: unknown): StoryPointRow[] {
  if (!Array.isArray(data)) return [];
  return data as StoryPointRow[];
}

// ---------------------------------------------------------------------------
// Step 0 — Space picker
// ---------------------------------------------------------------------------

function SpacePicker({ onSelect }: { onSelect: (id: string, title: string) => void }) {
  const [query, setQuery] = useState("");
  const spacesQuery = useSpaces();
  const spaces = useMemo(() => flattenSpaces(spacesQuery.data), [spacesQuery.data]);
  const filtered = useMemo(
    () =>
      query
        ? spaces.filter(
            (s) =>
              s.title?.toLowerCase().includes(query.toLowerCase()) ||
              s.subject?.toLowerCase().includes(query.toLowerCase())
          )
        : spaces,
    [spaces, query]
  );

  return (
    <View className="flex-1 gap-3 px-4 pt-3">
      <Text className="font-display text-text-primary text-base font-semibold">Choose a space</Text>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search spaces…" />
      {spacesQuery.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <View className="items-center gap-2 py-12">
          <Icon name="layout-template" size={28} color={colors.textMuted} />
          <Text className="text-text-muted text-sm">No spaces found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s, i) => s.id ?? String(i)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.id && onSelect(item.id, item.title ?? "Untitled")}
              className="border-border-subtle active:bg-surface-sunken flex-row items-center gap-3 border-b py-3.5"
            >
              <View className="bg-brand-subtle h-9 w-9 items-center justify-center rounded-lg">
                <Icon name="layout-template" size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-semibold" numberOfLines={1}>
                  {item.title ?? "Untitled"}
                </Text>
                {item.subject && <Text className="text-text-muted text-xs">{item.subject}</Text>}
              </View>
              <Icon name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Story point picker
// ---------------------------------------------------------------------------

function StoryPointPicker({
  spaceId,
  onSelect,
  onBack,
}: {
  spaceId: string;
  onSelect: (id: string, title: string) => void;
  onBack: () => void;
}) {
  const pointsQuery = useStoryPoints(spaceId);
  const points = useMemo(() => flattenPoints(pointsQuery.data), [pointsQuery.data]);

  return (
    <View className="flex-1 gap-3 px-4 pt-3">
      <Pressable onPress={onBack} className="flex-row items-center gap-1 self-start py-1">
        <Icon name="arrow-left" size={16} color={colors.brand} />
        <Text className="text-brand text-sm">Back to spaces</Text>
      </Pressable>
      <Text className="font-display text-text-primary text-base font-semibold">
        Choose a story point
      </Text>
      {pointsQuery.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
      ) : points.length === 0 ? (
        <View className="items-center gap-2 py-12">
          <Icon name="layers" size={28} color={colors.textMuted} />
          <Text className="text-text-muted text-sm">No story points in this space</Text>
        </View>
      ) : (
        <FlatList
          data={points}
          keyExtractor={(p, i) => p.id ?? String(i)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.id && onSelect(item.id, item.title ?? "Untitled")}
              className="border-border-subtle active:bg-surface-sunken flex-row items-center gap-3 border-b py-3.5"
            >
              <View className="bg-surface-sunken border-border-subtle h-8 w-8 items-center justify-center rounded-full border">
                <Text className="text-text-muted text-xs font-bold">{item.orderIndex ?? "•"}</Text>
              </View>
              <Text className="text-text-primary flex-1 text-sm" numberOfLines={1}>
                {item.title ?? "Untitled"}
              </Text>
              <Icon name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Generate spec + results
// ---------------------------------------------------------------------------

interface SpecStepProps {
  spaceId: string;
  storyPointId: string;
  spaceTitle: string;
  storyPointTitle: string;
  onBack: () => void;
  onDone: () => void;
}

function SpecAndGenerateStep({ spaceId, storyPointId, onBack, onDone }: SpecStepProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["mcq"]);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<DifficultyKey>("");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [acceptedSet, setAcceptedSet] = useState<Set<number>>(new Set());
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const generateContent = useGenerateContent();
  const saveItem = useSaveItem();
  const { upload: uploadPdf, isPending: pdfUploading } = useContentSourceUpload();
  const { handleError } = useApiError();

  function toggleType(t: string) {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function pickSourcePdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 14 * 1024 * 1024) {
      setPdfError("PDF must be under 14 MB.");
      return;
    }
    setPdfError(null);
    setPdfName(asset.name);
    setPdfPath(null);
    try {
      const path = await uploadPdf(asset.uri, spaceId);
      setPdfPath(path);
    } catch (err) {
      setPdfError(asApiError(err).message ?? "Upload failed.");
      setPdfName(null);
    }
  }

  async function handleGenerate() {
    if (selectedTypes.length === 0) {
      Alert.alert("Select at least one question type");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setDrafts([]);
    setAcceptedSet(new Set());
    try {
      const result = (await generateContent.mutateAsync({
        storyPointId,
        spaceId,
        spec: {
          types: selectedTypes,
          count,
          ...(difficulty ? { difficulty } : {}),
        },
        ...(pdfPath ? { sourcePdfPath: pdfPath } : {}),
      })) as { drafts?: GeneratedDraft[] };
      const received = result?.drafts ?? [];
      setDrafts(received);
      if (received.length === 0)
        setGenerateError("No drafts were generated. Try adjusting the types or count.");
    } catch (err) {
      setGenerateError(readableGenerateError(err));
    } finally {
      setGenerating(false);
    }
  }

  const acceptDraft = useCallback(
    async (idx: number) => {
      const draft = drafts[idx];
      if (!draft) return;
      setAcceptingIdx(idx);
      try {
        await saveItem.mutateAsync({
          spaceId,
          storyPointId,
          data: {
            type: draft.itemType,
            payload: draft.payload,
            title: draft.title,
            ...(draft.topics?.length ? { topics: draft.topics } : {}),
            ...(difficulty ? { difficulty } : {}),
          },
        });
        setAcceptedSet((prev) => new Set(prev).add(idx));
      } catch (err) {
        handleError(err, "Failed to save item");
      } finally {
        setAcceptingIdx(null);
      }
    },
    [drafts, difficulty, handleError, saveItem, spaceId, storyPointId]
  );

  async function acceptAll() {
    const pending = drafts.map((_, i) => i).filter((i) => !acceptedSet.has(i));
    if (pending.length === 0) return;
    setAcceptingAll(true);
    for (const idx of pending) {
      await acceptDraft(idx);
    }
    setAcceptingAll(false);
  }

  const pendingCount = drafts.filter((_, i) => !acceptedSet.has(i)).length;

  if (generating) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <ActivityIndicator size="large" color={colors.brand} />
        <View className="items-center gap-1">
          <Text className="font-display text-text-primary text-lg font-semibold">
            Generating {count} item{count !== 1 ? "s" : ""}
            {pdfPath ? " from your PDF" : ""}…
          </Text>
          <Text className="text-text-muted text-center text-sm">This may take 15–30 seconds.</Text>
        </View>
      </View>
    );
  }

  if (drafts.length > 0) {
    return (
      <View className="flex-1">
        {/* Drafts header */}
        <View className="border-border-subtle flex-row items-center justify-between border-b px-4 py-3">
          <Text className="text-text-primary text-sm font-semibold">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""} generated
            {acceptedSet.size > 0 && (
              <Text className="text-text-muted font-normal"> ({acceptedSet.size} accepted)</Text>
            )}
          </Text>
          {pendingCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={acceptingAll}
              onPress={acceptAll}
              leadingIcon="check-check"
            >
              {acceptingAll ? "Accepting…" : `Accept all (${pendingCount})`}
            </Button>
          )}
        </View>

        <FlatList
          data={drafts}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: draft, index: idx }) => {
            const accepted = acceptedSet.has(idx);
            const accepting = acceptingIdx === idx;
            return (
              <Card className={`gap-2 ${accepted ? "opacity-50" : ""}`}>
                <View className="flex-row items-start gap-2">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-text-primary text-sm font-semibold" numberOfLines={2}>
                      {draft.title || "Untitled"}
                    </Text>
                    <View className="flex-row flex-wrap gap-1">
                      {draft.itemType === "question" && draft.questionType && (
                        <Badge variant="neutral">{draft.questionType}</Badge>
                      )}
                      {draft.bloomsLevel && <Badge variant="info">{draft.bloomsLevel}</Badge>}
                    </View>
                  </View>
                  {accepted ? (
                    <View className="flex-row items-center gap-1">
                      <Icon name="check-circle" size={14} color={colors.success} />
                      <Text className="text-success text-xs font-semibold">Saved</Text>
                    </View>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={accepting}
                      disabled={acceptingAll}
                      onPress={() => acceptDraft(idx)}
                    >
                      {accepting ? "Saving…" : "Accept"}
                    </Button>
                  )}
                </View>
                {draft.topics && draft.topics.length > 0 && (
                  <View className="flex-row flex-wrap gap-1">
                    {draft.topics.slice(0, 3).map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </View>
                )}
              </Card>
            );
          }}
        />

        <View className="border-border-subtle flex-row items-center justify-between border-t px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={acceptingAll}
            onPress={() => {
              setDrafts([]);
              setGenerateError(null);
              setAcceptedSet(new Set());
            }}
            leadingIcon="refresh-ccw"
          >
            Start over
          </Button>
          <Button variant="secondary" size="sm" onPress={onDone}>
            Done
          </Button>
        </View>
      </View>
    );
  }

  // Spec form
  return (
    <Screen scroll contentClassName="gap-4">
      <Pressable onPress={onBack} className="flex-row items-center gap-1 self-start">
        <Icon name="arrow-left" size={16} color={colors.brand} />
        <Text className="text-brand text-sm">Change story point</Text>
      </Pressable>

      {/* Question types */}
      <View className="gap-2">
        <Text className="text-text-secondary text-sm font-semibold">Question types</Text>
        <View className="flex-row flex-wrap gap-2">
          {QUESTION_TYPES.map(({ value, label }) => (
            <Chip
              key={value}
              active={selectedTypes.includes(value)}
              onPress={() => toggleType(value)}
            >
              {label}
            </Chip>
          ))}
        </View>
        {selectedTypes.length === 0 && (
          <Text className="text-error text-xs">Select at least one type.</Text>
        )}
      </View>

      {/* Count */}
      <View className="gap-2">
        <Text className="text-text-secondary text-sm font-semibold">Count: {count}</Text>
        <View className="flex-row items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={count <= 1}
            onPress={() => setCount((c) => Math.max(1, c - 1))}
            leadingIcon="minus"
          >
            {""}
          </Button>
          <Text className="font-display text-text-primary w-8 text-center text-lg font-bold">
            {count}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            disabled={count >= 50}
            onPress={() => setCount((c) => Math.min(50, c + 1))}
            leadingIcon="plus"
          >
            {""}
          </Button>
          <Text className="text-text-muted text-xs">1–50 items</Text>
        </View>
      </View>

      {/* Difficulty */}
      <View className="gap-2">
        <Text className="text-text-secondary text-sm font-semibold">Difficulty</Text>
        <View className="flex-row flex-wrap gap-2">
          {DIFFICULTIES.map(({ key, label }) => (
            <Chip key={key} active={difficulty === key} onPress={() => setDifficulty(key)}>
              {label}
            </Chip>
          ))}
        </View>
      </View>

      {/* Source PDF */}
      <View className="gap-2">
        <Text className="text-text-secondary text-sm font-semibold">
          Source PDF <Text className="text-text-muted font-normal">(optional · max 14 MB)</Text>
        </Text>
        {!pdfName ? (
          <Button
            variant="secondary"
            block
            loading={pdfUploading}
            leadingIcon="file-text"
            onPress={pickSourcePdf}
          >
            {pdfUploading ? "Uploading…" : "Upload PDF to guide generation"}
          </Button>
        ) : (
          <View className="bg-surface-sunken border-border-subtle flex-row items-center gap-2 rounded-lg border px-3 py-2.5">
            <Icon name={pdfPath ? "file-check" : "file-text"} size={16} color={colors.brand} />
            <Text className="text-text-secondary flex-1 text-sm" numberOfLines={1}>
              {pdfName}
            </Text>
            {pdfUploading ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Pressable
                onPress={() => {
                  setPdfName(null);
                  setPdfPath(null);
                  setPdfError(null);
                }}
                hitSlop={8}
              >
                <Icon name="x" size={15} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}
        {pdfError && <Text className="text-error text-xs">{pdfError}</Text>}
      </View>

      {generateError && (
        <View className="bg-error/10 border-error/20 rounded-lg border px-3 py-2">
          <Text className="text-error text-sm">{generateError}</Text>
        </View>
      )}

      <Button
        variant="primary"
        block
        disabled={selectedTypes.length === 0 || pdfUploading}
        onPress={handleGenerate}
        leadingIcon="sparkles"
      >
        Generate {count} item{count !== 1 ? "s" : ""}
      </Button>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GenerateContentScreen() {
  const router = useRouter();
  const { spaceId: initialSpaceId, storyPointId: initialStoryPointId } = useLocalSearchParams<{
    spaceId?: string;
    storyPointId?: string;
  }>();

  const [step, setStep] = useState(
    initialSpaceId && initialStoryPointId ? 2 : initialSpaceId ? 1 : 0
  );
  const [spaceId, setSpaceId] = useState<string | undefined>(initialSpaceId);
  const [storyPointId, setStoryPointId] = useState<string | undefined>(initialStoryPointId);
  const [spaceTitle, setSpaceTitle] = useState("");
  const [storyPointTitle, setStoryPointTitle] = useState("");

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="border-border-subtle flex-row items-center gap-2 border-b px-4 py-3">
        <Pressable
          onPress={() => {
            if (step > 0) setStep((s) => s - 1);
            else router.back();
          }}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Icon name="sparkles" size={16} color={colors.brand} />
            <Text className="font-display text-text-primary text-base font-semibold">
              Generate with AI
            </Text>
          </View>
          {spaceTitle && storyPointTitle && (
            <Text className="text-text-muted text-xs" numberOfLines={1}>
              {spaceTitle} · {storyPointTitle}
            </Text>
          )}
        </View>
      </View>

      {step === 0 && (
        <SpacePicker
          onSelect={(id, title) => {
            setSpaceId(id);
            setSpaceTitle(title);
            setStep(1);
          }}
        />
      )}
      {step === 1 && spaceId && (
        <StoryPointPicker
          spaceId={spaceId}
          onBack={() => setStep(0)}
          onSelect={(id, title) => {
            setStoryPointId(id);
            setStoryPointTitle(title);
            setStep(2);
          }}
        />
      )}
      {step === 2 && spaceId && storyPointId && (
        <SpecAndGenerateStep
          spaceId={spaceId}
          storyPointId={storyPointId}
          spaceTitle={spaceTitle}
          storyPointTitle={storyPointTitle}
          onBack={() => setStep(1)}
          onDone={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}
