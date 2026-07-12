/**
 * ExamWizardScreen — 4-step exam creation wizard.
 *
 * Step 0 — Metadata: title, subject, totalMarks, instructions
 * Step 1 — Upload question paper: camera / gallery / PDF picker
 *           (expo-image-picker for camera/gallery; expo-document-picker for PDF)
 * Step 2 — Extracting: fires useExtractQuestions; auto-advances on success
 * Step 3 — Review & edit: per-question inline edit via useSaveExamQuestion
 *
 * The exam is created in Step 0 (useSaveExam, status:'draft'); question paper
 * images are uploaded + saved in Step 1; extraction triggered in Step 2.
 * The optional `examId` query param allows re-entering the wizard at Step 3
 * for an existing exam (e.g. re-entering from the Review tab).
 */
import { useState, useCallback } from "react";
import { Text, View, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  useSaveExam,
  useExtractQuestions,
  useExamQuestions,
  useSaveExamQuestion,
  useApiError,
} from "@levelup/query";

import { Button, Card, Icon, TextField, Screen } from "../../components";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";
import { useQuestionPaperUpload, type QuestionPaperFile } from "../../lib/media-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamMeta {
  title: string;
  subject: string;
  totalMarks: string;
  instructions: string;
}

interface QuestionDraft {
  id?: string;
  text: string;
  maxMarks: number;
  order: number;
  imageUrls?: string[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-2">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`rounded-full ${i === current ? "bg-brand h-2 w-6" : i < current ? "bg-brand/50 h-2 w-2" : "bg-border-strong h-2 w-2"}`}
        />
      ))}
    </View>
  );
}

function PaperThumbnail({ file, onRemove }: { file: QuestionPaperFile; onRemove: () => void }) {
  return (
    <View className="bg-surface-sunken border-border-subtle relative rounded-lg border px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <Icon name={file.kind === "pdf" ? "file-text" : "image"} size={16} color={colors.brand} />
        <Text className="text-text-secondary flex-1 text-sm" numberOfLines={1}>
          {file.name ?? (file.kind === "pdf" ? "document.pdf" : "photo.jpg")}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Icon name="x" size={15} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function QuestionEditCard({
  question,
  examId,
  index,
}: {
  question: QuestionDraft;
  examId: string;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [maxMarks, setMaxMarks] = useState(String(question.maxMarks ?? 1));
  const saveQuestion = useSaveExamQuestion();
  const { handleError } = useApiError();

  const save = useCallback(async () => {
    try {
      await saveQuestion.mutateAsync({
        id: question.id as never,
        examId: examId as never,
        data: {
          text,
          maxMarks: Number(maxMarks) || 1,
        },
      });
      setEditing(false);
    } catch (err) {
      handleError(err, "Failed to save question");
    }
  }, [examId, maxMarks, question.id, saveQuestion, text, handleError]);

  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="bg-brand h-6 w-6 items-center justify-center rounded-full">
          <Text className="text-text-on-accent text-xs font-bold">{question.order}</Text>
        </View>
        <Pressable onPress={() => setEditing((v) => !v)} className="flex-row items-center gap-1">
          <Icon name={editing ? "chevron-up" : "pencil"} size={14} color={colors.brand} />
          <Text className="text-brand text-xs font-semibold">{editing ? "Cancel" : "Edit"}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View className="gap-3">
          <TextField
            label="Question text"
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Enter question…"
          />
          <TextField
            label="Max marks"
            value={maxMarks}
            onChangeText={setMaxMarks}
            keyboardType="numeric"
            placeholder="1"
          />
          <Button variant="primary" size="sm" loading={saveQuestion.isPending} onPress={save}>
            Save
          </Button>
        </View>
      ) : (
        <Text className="text-text-primary text-sm leading-relaxed">{text || "—"}</Text>
      )}

      <View className="flex-row items-center gap-3">
        <Text className="text-text-muted text-xs">
          {maxMarks} mark{Number(maxMarks) !== 1 ? "s" : ""}
        </Text>
        {(question.imageUrls?.length ?? 0) > 0 && (
          <View className="flex-row items-center gap-1">
            <Icon name="image" size={12} color={colors.textMuted} />
            <Text className="text-text-muted text-xs">
              {question.imageUrls?.length} image{question.imageUrls!.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExamWizardScreen() {
  const router = useRouter();
  const { examId: existingExamId } = useLocalSearchParams<{ examId?: string }>();

  const [step, setStep] = useState(existingExamId ? 3 : 0);
  const [examId, setExamId] = useState<string | undefined>(existingExamId);

  // Step 0 form state
  const [meta, setMeta] = useState<ExamMeta>({
    title: "",
    subject: "",
    totalMarks: "",
    instructions: "",
  });
  const [metaErrors, setMetaErrors] = useState<Partial<ExamMeta>>({});

  // Step 1 state
  const [paperFiles, setPaperFiles] = useState<QuestionPaperFile[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  // Step 2 state
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);

  const saveExam = useSaveExam();
  const extractQuestions = useExtractQuestions();
  const questionReview = useExamQuestions(examId ?? "");
  const { handleError } = useApiError();
  const { upload: uploadPaper } = useQuestionPaperUpload();

  // ---------------------------------------------------------------------------
  // Step 0 → create exam + advance
  // ---------------------------------------------------------------------------

  function validateMeta(): boolean {
    const errors: Partial<ExamMeta> = {};
    if (!meta.title.trim()) errors.title = "Title is required";
    if (!meta.subject.trim()) errors.subject = "Subject is required";
    if (meta.totalMarks && isNaN(Number(meta.totalMarks))) errors.totalMarks = "Must be a number";
    setMetaErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreateExam() {
    if (!validateMeta()) return;
    try {
      const result = (await saveExam.mutateAsync({
        data: {
          title: meta.title.trim(),
          subject: meta.subject.trim(),
          ...(meta.totalMarks ? { totalMarks: Number(meta.totalMarks) } : {}),
        },
      })) as { id: string };
      setExamId(result.id);
      setStep(1);
    } catch (err) {
      handleError(err, "Failed to create exam");
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1 → pick files (camera / gallery / PDF)
  // ---------------------------------------------------------------------------

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera permission is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPaperFiles((prev) => [
        ...prev,
        { uri: asset.uri, kind: "image", contentType: "image/jpeg" },
      ]);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Photo library permission is needed.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        kind: "image" as const,
        contentType: "image/jpeg",
      }));
      setPaperFiles((prev) => [...prev, ...picked]);
    }
  }

  async function pickPDF() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.size && asset.size > 14 * 1024 * 1024) {
        Alert.alert("File too large", "PDF must be under 14 MB.");
        return;
      }
      setPaperFiles((prev) => [
        ...prev,
        { uri: asset.uri, kind: "pdf", name: asset.name, contentType: "application/pdf" },
      ]);
    }
  }

  async function handleUploadAndExtract() {
    if (!examId || paperFiles.length === 0) return;

    // Upload all files
    const paths: string[] = [];
    for (let i = 0; i < paperFiles.length; i++) {
      setUploadingIdx(i);
      try {
        const path = await uploadPaper(paperFiles[i], examId);
        paths.push(path);
      } catch (err) {
        setUploadingIdx(null);
        handleError(err, `Failed to upload file ${i + 1}`);
        return;
      }
    }
    setUploadingIdx(null);
    setUploadedPaths(paths);

    // Persist paths onto the exam
    try {
      await saveExam.mutateAsync({
        id: examId as never,
        data: { questionPaperImages: paths },
      });
    } catch (err) {
      handleError(err, "Failed to save question paper");
      return;
    }

    // Advance to extraction step
    setStep(2);
    try {
      const res = (await extractQuestions.mutateAsync({
        examId: examId as never,
      })) as { warnings?: string[] };
      setExtractionWarnings(res?.warnings ?? []);
      setStep(3);
    } catch (err) {
      handleError(err, "Question extraction failed");
      setStep(1);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3 → publish
  // ---------------------------------------------------------------------------

  async function handlePublish() {
    if (!examId) return;
    try {
      await saveExam.mutateAsync({
        id: examId as never,
        data: { status: "question_paper_uploaded" as never },
      });
      Alert.alert("Exam ready", "Questions reviewed and exam is ready for grading.", [
        { text: "Done", onPress: () => router.replace(routes.review()) },
      ]);
    } catch (err) {
      handleError(err, "Failed to update exam status");
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const questions: QuestionDraft[] = (questionReview.data as QuestionDraft[] | undefined) ?? [];

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="border-border-subtle flex-row items-center gap-2 border-b px-4 py-3">
        <Pressable
          onPress={() => {
            if (step > 0 && step < 2) setStep((s) => s - 1);
            else router.back();
          }}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text className="font-display text-text-primary flex-1 text-lg font-semibold">
          {step === 0
            ? "Exam details"
            : step === 1
              ? "Question paper"
              : step === 2
                ? "Extracting…"
                : "Review questions"}
        </Text>
        <StepDots current={step} total={4} />
      </View>

      {/* Step 0 — Metadata */}
      {step === 0 && (
        <Screen scroll contentClassName="gap-4">
          <TextField
            label="Exam title"
            required
            value={meta.title}
            onChangeText={(t) => setMeta((m) => ({ ...m, title: t }))}
            placeholder="e.g. Mid-term Mathematics"
            error={metaErrors.title}
          />
          <TextField
            label="Subject"
            required
            value={meta.subject}
            onChangeText={(t) => setMeta((m) => ({ ...m, subject: t }))}
            placeholder="e.g. Mathematics"
            error={metaErrors.subject}
          />
          <TextField
            label="Total marks"
            value={meta.totalMarks}
            onChangeText={(t) => setMeta((m) => ({ ...m, totalMarks: t }))}
            keyboardType="numeric"
            placeholder="100"
            error={metaErrors.totalMarks}
          />
          <TextField
            label="Instructions (optional)"
            multiline
            value={meta.instructions}
            onChangeText={(t) => setMeta((m) => ({ ...m, instructions: t }))}
            placeholder="Attempt all questions…"
          />
          <Button variant="primary" block loading={saveExam.isPending} onPress={handleCreateExam}>
            Next
          </Button>
        </Screen>
      )}

      {/* Step 1 — Upload question paper */}
      {step === 1 && (
        <Screen scroll contentClassName="gap-4">
          <View className="gap-1">
            <Text className="font-display text-text-primary text-base font-semibold">
              Add question paper
            </Text>
            <Text className="text-text-muted text-sm">
              Take photos of each page, pick from gallery, or attach a PDF.
            </Text>
          </View>

          {/* Picker buttons */}
          <View className="gap-2">
            <Button variant="secondary" block leadingIcon="camera" onPress={pickFromCamera}>
              Take photo
            </Button>
            <Button variant="secondary" block leadingIcon="image" onPress={pickFromGallery}>
              Choose from gallery
            </Button>
            <Button variant="secondary" block leadingIcon="file-text" onPress={pickPDF}>
              Attach PDF (max 14 MB)
            </Button>
          </View>

          {/* Picked files */}
          {paperFiles.length > 0 && (
            <View className="gap-2">
              <Text className="text-text-secondary text-sm font-semibold">
                {paperFiles.length} file{paperFiles.length !== 1 ? "s" : ""} selected
              </Text>
              {paperFiles.map((f, i) => (
                <PaperThumbnail
                  key={i}
                  file={f}
                  onRemove={() => setPaperFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </View>
          )}

          {/* Upload progress indicator */}
          {uploadingIdx !== null && (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={colors.brand} />
              <Text className="text-text-secondary text-sm">
                Uploading file {uploadingIdx + 1} of {paperFiles.length}…
              </Text>
            </View>
          )}

          <View className="gap-2 pt-2">
            <Button
              variant="primary"
              block
              disabled={paperFiles.length === 0}
              loading={uploadingIdx !== null || extractQuestions.isPending}
              onPress={handleUploadAndExtract}
            >
              Extract questions
            </Button>
            <Button variant="ghost" block onPress={() => setStep(3)}>
              Skip — add questions manually
            </Button>
          </View>
        </Screen>
      )}

      {/* Step 2 — Extracting */}
      {step === 2 && (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <ActivityIndicator size="large" color={colors.brand} />
          <View className="items-center gap-1">
            <Text className="font-display text-text-primary text-lg font-semibold">
              Extracting questions…
            </Text>
            <Text className="text-text-muted text-center text-sm">
              AI is reading the question paper. This takes 15–30 seconds.
            </Text>
          </View>
        </View>
      )}

      {/* Step 3 — Review questions */}
      {step === 3 && (
        <View className="flex-1">
          {extractionWarnings.length > 0 && (
            <View className="bg-warning/10 border-warning/30 mx-4 mt-3 rounded-lg border px-3 py-2">
              <Text className="text-text-primary text-xs font-semibold">Extraction notes</Text>
              {extractionWarnings.map((w, i) => (
                <Text key={i} className="text-text-secondary mt-1 text-xs">
                  {w}
                </Text>
              ))}
            </View>
          )}

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {questionReview.isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <>
                {questions.map((q, i) => (
                  <QuestionEditCard key={q.id ?? i} question={q} examId={examId ?? ""} index={i} />
                ))}
                <AddQuestionCard examId={examId ?? ""} nextOrder={questions.length + 1} />
              </>
            )}
          </ScrollView>

          <View className="border-border-subtle border-t px-4 py-3">
            <Button variant="primary" block loading={saveExam.isPending} onPress={handlePublish}>
              Mark exam ready
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// AddQuestionCard — inline "add manual question" affordance for Step 3
// ---------------------------------------------------------------------------

function AddQuestionCard({ examId, nextOrder }: { examId: string; nextOrder: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [maxMarks, setMaxMarks] = useState("1");
  const saveQuestion = useSaveExamQuestion();
  const { handleError } = useApiError();

  async function handleAdd() {
    if (!text.trim()) return;
    try {
      await saveQuestion.mutateAsync({
        examId: examId as never,
        data: {
          text: text.trim(),
          maxMarks: Number(maxMarks) || 1,
          order: nextOrder,
        },
      });
      setText("");
      setMaxMarks("1");
      setOpen(false);
    } catch (err) {
      handleError(err, "Failed to add question");
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        className="border-border-strong flex-row items-center justify-center gap-2 rounded-xl border border-dashed py-4"
      >
        <Icon name="plus" size={16} color={colors.brand} />
        <Text className="text-brand text-sm font-semibold">Add question manually</Text>
      </Pressable>
    );
  }

  return (
    <Card className="gap-3">
      <Text className="text-text-secondary text-sm font-semibold">New question #{nextOrder}</Text>
      <TextField
        label="Question text"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Enter question…"
      />
      <TextField
        label="Max marks"
        value={maxMarks}
        onChangeText={setMaxMarks}
        keyboardType="numeric"
        placeholder="1"
      />
      <View className="flex-row gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onPress={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          loading={saveQuestion.isPending}
          disabled={!text.trim()}
          onPress={handleAdd}
        >
          Add
        </Button>
      </View>
    </Card>
  );
}
