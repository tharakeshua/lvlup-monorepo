/**
 * WIRE-PRESERVING request schemas + response types for the legacy levelup
 * callables. Ported VERBATIM from @levelup/shared-types (U3.2, DATA-MODEL-FIX-PLAN
 * §3/§6, MIGRATION-PATTERN.md rule 4) so that package can be deleted (U3.5).
 *
 * These deliberately do NOT adopt the @levelup/api-contract v1 request shapes:
 * the v1 contract restructured payloads (two-level `type`-discriminated item
 * payload, `maxScore` rubric criteria, envelope `{data}` responses, …) and this
 * package serves the DEPLOYED legacy wire. Each schema notes its v1 successor
 * (all under `packages/api-contract/src/levelup/`); this file dies with the
 * legacy stack.
 *
 * Wire quirks preserved on purpose:
 *  - SaveStoryPointRequestSchema still accepts the legacy `'test'` storyPoint
 *    type (deployed clients send it); the value is stored as-received.
 *  - The embedded rubric fragment uses the legacy `maxPoints` vocabulary.
 *  - StoredEvaluation fields use `.nullish()` because the Firebase callable SDK
 *    encodes undefined → null.
 *
 * B8 note: timestamps in RESPONSES from migrated handlers are canonical ISO
 * strings — EXCEPT DigitalTestSession timing fields (startedAt/serverDeadline),
 * which remain Firestore Timestamps end-to-end until U3.5 (see
 * contracts/legacy-docs.ts header addendum).
 */
import { z } from "zod";
/** Firestore document ID pattern (no slashes, non-empty). */
export declare const firestoreId: z.ZodString;
/** v1 successor: api-contract `SaveResponseSchema` (adds `archived?`). */
export interface SaveResponse {
  id: string;
  created: boolean;
}
/** v1 successor: api-contract levelup `SaveSpaceRequestSchema`. */
export declare const SaveSpaceRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        thumbnailUrl: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<
          z.ZodEnum<{
            practice: "practice";
            hybrid: "hybrid";
            assessment: "assessment";
            learning: "learning";
            resource: "resource";
          }>
        >;
        subject: z.ZodOptional<z.ZodString>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString>>;
        classIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        teacherIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        accessType: z.ZodOptional<
          z.ZodEnum<{
            class_assigned: "class_assigned";
            tenant_wide: "tenant_wide";
            public_store: "public_store";
          }>
        >;
        academicSessionId: z.ZodOptional<z.ZodString>;
        defaultEvaluatorAgentId: z.ZodOptional<z.ZodString>;
        defaultTutorAgentId: z.ZodOptional<z.ZodString>;
        defaultTimeLimitMinutes: z.ZodOptional<z.ZodNumber>;
        allowRetakes: z.ZodOptional<z.ZodBoolean>;
        maxRetakes: z.ZodOptional<z.ZodNumber>;
        showCorrectAnswers: z.ZodOptional<z.ZodBoolean>;
        defaultRubric: z.ZodOptional<
          z.ZodObject<
            {
              scoringMode: z.ZodEnum<{
                criteria_based: "criteria_based";
                dimension_based: "dimension_based";
                holistic: "holistic";
                hybrid: "hybrid";
              }>;
              criteria: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodOptional<z.ZodString>;
                      maxPoints: z.ZodNumber;
                      weight: z.ZodOptional<z.ZodNumber>;
                      levels: z.ZodOptional<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              score: z.ZodNumber;
                              label: z.ZodString;
                              description: z.ZodString;
                            },
                            z.core.$strip
                          >
                        >
                      >;
                    },
                    z.core.$strip
                  >
                >
              >;
              dimensions: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodString;
                      icon: z.ZodOptional<z.ZodString>;
                      priority: z.ZodEnum<{
                        HIGH: "HIGH";
                        MEDIUM: "MEDIUM";
                        LOW: "LOW";
                      }>;
                      promptGuidance: z.ZodString;
                      enabled: z.ZodBoolean;
                      isDefault: z.ZodBoolean;
                      isCustom: z.ZodBoolean;
                      expectedFeedbackCount: z.ZodOptional<z.ZodNumber>;
                      weight: z.ZodNumber;
                      scoringScale: z.ZodNumber;
                    },
                    z.core.$strip
                  >
                >
              >;
              holisticGuidance: z.ZodOptional<z.ZodString>;
              holisticMaxScore: z.ZodOptional<z.ZodNumber>;
              passingPercentage: z.ZodOptional<z.ZodNumber>;
              showModelAnswer: z.ZodOptional<z.ZodBoolean>;
              modelAnswer: z.ZodOptional<z.ZodString>;
              evaluatorGuidance: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        status: z.ZodOptional<
          z.ZodEnum<{
            draft: "draft";
            published: "published";
            archived: "archived";
          }>
        >;
        price: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        publishedToStore: z.ZodOptional<z.ZodBoolean>;
        storeDescription: z.ZodOptional<z.ZodString>;
        storeThumbnailUrl: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
export type SaveSpaceRequest = z.infer<typeof SaveSpaceRequestSchema>;
/** v1 successor: api-contract levelup `SaveStoryPointRequestSchema`. */
export declare const SaveStoryPointRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    data: z.ZodObject<
      {
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        orderIndex: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<
          z.ZodEnum<{
            standard: "standard";
            timed_test: "timed_test";
            quiz: "quiz";
            practice: "practice";
            test: "test";
          }>
        >;
        sections: z.ZodOptional<
          z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                title: z.ZodString;
                orderIndex: z.ZodNumber;
                description: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >
        >;
        assessmentConfig: z.ZodOptional<
          z.ZodObject<
            {
              durationMinutes: z.ZodOptional<z.ZodNumber>;
              instructions: z.ZodOptional<z.ZodString>;
              maxAttempts: z.ZodOptional<z.ZodNumber>;
              shuffleQuestions: z.ZodOptional<z.ZodBoolean>;
              shuffleOptions: z.ZodOptional<z.ZodBoolean>;
              showResultsImmediately: z.ZodOptional<z.ZodBoolean>;
            },
            z.core.$loose
          >
        >;
        defaultRubric: z.ZodOptional<
          z.ZodObject<
            {
              scoringMode: z.ZodEnum<{
                criteria_based: "criteria_based";
                dimension_based: "dimension_based";
                holistic: "holistic";
                hybrid: "hybrid";
              }>;
              criteria: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodOptional<z.ZodString>;
                      maxPoints: z.ZodNumber;
                      weight: z.ZodOptional<z.ZodNumber>;
                      levels: z.ZodOptional<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              score: z.ZodNumber;
                              label: z.ZodString;
                              description: z.ZodString;
                            },
                            z.core.$strip
                          >
                        >
                      >;
                    },
                    z.core.$strip
                  >
                >
              >;
              dimensions: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodString;
                      icon: z.ZodOptional<z.ZodString>;
                      priority: z.ZodEnum<{
                        HIGH: "HIGH";
                        MEDIUM: "MEDIUM";
                        LOW: "LOW";
                      }>;
                      promptGuidance: z.ZodString;
                      enabled: z.ZodBoolean;
                      isDefault: z.ZodBoolean;
                      isCustom: z.ZodBoolean;
                      expectedFeedbackCount: z.ZodOptional<z.ZodNumber>;
                      weight: z.ZodNumber;
                      scoringScale: z.ZodNumber;
                    },
                    z.core.$strip
                  >
                >
              >;
              holisticGuidance: z.ZodOptional<z.ZodString>;
              holisticMaxScore: z.ZodOptional<z.ZodNumber>;
              passingPercentage: z.ZodOptional<z.ZodNumber>;
              showModelAnswer: z.ZodOptional<z.ZodBoolean>;
              modelAnswer: z.ZodOptional<z.ZodString>;
              evaluatorGuidance: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        difficulty: z.ZodOptional<
          z.ZodEnum<{
            easy: "easy";
            medium: "medium";
            hard: "hard";
            expert: "expert";
          }>
        >;
        estimatedTimeMinutes: z.ZodOptional<z.ZodNumber>;
        deleted: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
export type SaveStoryPointRequest = z.infer<typeof SaveStoryPointRequestSchema>;
/** v1 successor: api-contract levelup `SaveItemRequestSchema` (two-level payload). */
export declare const SaveItemRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodString;
    data: z.ZodObject<
      {
        sectionId: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<
          z.ZodEnum<{
            interactive: "interactive";
            project: "project";
            question: "question";
            material: "material";
            assessment: "assessment";
            discussion: "discussion";
            checkpoint: "checkpoint";
          }>
        >;
        payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        title: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        difficulty: z.ZodOptional<
          z.ZodEnum<{
            easy: "easy";
            medium: "medium";
            hard: "hard";
          }>
        >;
        topics: z.ZodOptional<z.ZodArray<z.ZodString>>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString>>;
        orderIndex: z.ZodOptional<z.ZodNumber>;
        meta: z.ZodOptional<
          z.ZodObject<
            {
              subject: z.ZodOptional<z.ZodString>;
              topics: z.ZodOptional<z.ZodArray<z.ZodString>>;
              bloomsLevel: z.ZodOptional<z.ZodString>;
              estimatedTime: z.ZodOptional<z.ZodNumber>;
              source: z.ZodOptional<z.ZodString>;
            },
            z.core.$loose
          >
        >;
        analytics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        rubric: z.ZodOptional<
          z.ZodObject<
            {
              scoringMode: z.ZodEnum<{
                criteria_based: "criteria_based";
                dimension_based: "dimension_based";
                holistic: "holistic";
                hybrid: "hybrid";
              }>;
              criteria: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodOptional<z.ZodString>;
                      maxPoints: z.ZodNumber;
                      weight: z.ZodOptional<z.ZodNumber>;
                      levels: z.ZodOptional<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              score: z.ZodNumber;
                              label: z.ZodString;
                              description: z.ZodString;
                            },
                            z.core.$strip
                          >
                        >
                      >;
                    },
                    z.core.$strip
                  >
                >
              >;
              dimensions: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodString;
                      icon: z.ZodOptional<z.ZodString>;
                      priority: z.ZodEnum<{
                        HIGH: "HIGH";
                        MEDIUM: "MEDIUM";
                        LOW: "LOW";
                      }>;
                      promptGuidance: z.ZodString;
                      enabled: z.ZodBoolean;
                      isDefault: z.ZodBoolean;
                      isCustom: z.ZodBoolean;
                      expectedFeedbackCount: z.ZodOptional<z.ZodNumber>;
                      weight: z.ZodNumber;
                      scoringScale: z.ZodNumber;
                    },
                    z.core.$strip
                  >
                >
              >;
              holisticGuidance: z.ZodOptional<z.ZodString>;
              holisticMaxScore: z.ZodOptional<z.ZodNumber>;
              passingPercentage: z.ZodOptional<z.ZodNumber>;
              showModelAnswer: z.ZodOptional<z.ZodBoolean>;
              modelAnswer: z.ZodOptional<z.ZodString>;
              evaluatorGuidance: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        linkedQuestionId: z.ZodOptional<z.ZodString>;
        attachments: z.ZodOptional<
          z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                fileName: z.ZodString;
                url: z.ZodString;
                type: z.ZodEnum<{
                  audio: "audio";
                  image: "image";
                  pdf: "pdf";
                }>;
                size: z.ZodNumber;
                mimeType: z.ZodString;
              },
              z.core.$strip
            >
          >
        >;
        deleted: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
export type SaveItemRequest = z.infer<typeof SaveItemRequestSchema>;
/** v1 successor: api-contract levelup `StartTestSessionRequestSchema`. */
export declare const StartTestSessionRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodString;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `SubmitTestSessionRequestSchema`. */
export declare const SubmitTestSessionRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    sessionId: z.ZodString;
    autoSubmitted: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `EvaluateAnswerRequestSchema`. */
export declare const EvaluateAnswerRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodOptional<z.ZodString>;
    itemId: z.ZodString;
    answer: z.ZodUnknown;
    mediaUrls: z.ZodOptional<z.ZodArray<z.ZodString>>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `SendChatMessageRequestSchema`. */
export declare const SendChatMessageRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodString;
    itemId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `RecordItemAttemptRequestSchema`. */
export declare const RecordItemAttemptRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodString;
    itemId: z.ZodString;
    itemType: z.ZodString;
    score: z.ZodNumber;
    maxScore: z.ZodNumber;
    correct: z.ZodBoolean;
    timeSpent: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    feedback: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    answer: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    evaluationData: z.ZodOptional<
      z.ZodNullable<
        z.ZodObject<
          {
            score: z.ZodNumber;
            maxScore: z.ZodNumber;
            correctness: z.ZodNumber;
            percentage: z.ZodNumber;
            strengths: z.ZodArray<z.ZodString>;
            weaknesses: z.ZodArray<z.ZodString>;
            missingConcepts: z.ZodArray<z.ZodString>;
            summary: z.ZodOptional<
              z.ZodNullable<
                z.ZodObject<
                  {
                    keyTakeaway: z.ZodString;
                    overallComment: z.ZodString;
                  },
                  z.core.$strip
                >
              >
            >;
            mistakeClassification: z.ZodOptional<
              z.ZodNullable<
                z.ZodEnum<{
                  Conceptual: "Conceptual";
                  "Silly Error": "Silly Error";
                  "Knowledge Gap": "Knowledge Gap";
                  None: "None";
                }>
              >
            >;
          },
          z.core.$strip
        >
      >
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `ListStoreSpacesRequestSchema`. */
export declare const ListStoreSpacesRequestSchema: z.ZodObject<
  {
    subject: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    startAfter: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `PurchaseSpaceRequestSchema`. */
export declare const PurchaseSpaceRequestSchema: z.ZodObject<
  {
    spaceId: z.ZodString;
    paymentToken: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `SaveQuestionBankItemRequestSchema`. */
export declare const SaveQuestionBankItemRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        questionType: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        explanation: z.ZodOptional<z.ZodString>;
        basePoints: z.ZodOptional<z.ZodNumber>;
        questionData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        subject: z.ZodOptional<z.ZodString>;
        topics: z.ZodOptional<z.ZodArray<z.ZodString>>;
        difficulty: z.ZodOptional<
          z.ZodEnum<{
            easy: "easy";
            medium: "medium";
            hard: "hard";
          }>
        >;
        bloomsLevel: z.ZodOptional<
          z.ZodEnum<{
            remember: "remember";
            understand: "understand";
            apply: "apply";
            analyze: "analyze";
            evaluate: "evaluate";
            create: "create";
          }>
        >;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deleted: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `ListQuestionBankRequestSchema`. */
export declare const ListQuestionBankRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    topics: z.ZodOptional<z.ZodArray<z.ZodString>>;
    difficulty: z.ZodOptional<
      z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
      }>
    >;
    bloomsLevel: z.ZodOptional<
      z.ZodEnum<{
        remember: "remember";
        understand: "understand";
        apply: "apply";
        analyze: "analyze";
        evaluate: "evaluate";
        create: "create";
      }>
    >;
    questionType: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<
      z.ZodEnum<{
        usageCount: "usageCount";
        averageScore: "averageScore";
        createdAt: "createdAt";
      }>
    >;
    sortDir: z.ZodOptional<
      z.ZodEnum<{
        asc: "asc";
        desc: "desc";
      }>
    >;
    limit: z.ZodOptional<z.ZodNumber>;
    startAfter: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `ImportFromBankRequestSchema`. */
export declare const ImportFromBankRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    storyPointId: z.ZodString;
    sectionId: z.ZodOptional<z.ZodString>;
    questionBankItemIds: z.ZodArray<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `SaveSpaceReviewRequestSchema`. */
export declare const SaveSpaceReviewRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    spaceId: z.ZodString;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract levelup `SaveRubricPresetRequestSchema`. */
export declare const SaveRubricPresetRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        rubric: z.ZodOptional<
          z.ZodObject<
            {
              scoringMode: z.ZodEnum<{
                criteria_based: "criteria_based";
                dimension_based: "dimension_based";
                holistic: "holistic";
                hybrid: "hybrid";
              }>;
              criteria: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodOptional<z.ZodString>;
                      maxPoints: z.ZodNumber;
                      weight: z.ZodOptional<z.ZodNumber>;
                      levels: z.ZodOptional<
                        z.ZodArray<
                          z.ZodObject<
                            {
                              score: z.ZodNumber;
                              label: z.ZodString;
                              description: z.ZodString;
                            },
                            z.core.$strip
                          >
                        >
                      >;
                    },
                    z.core.$strip
                  >
                >
              >;
              dimensions: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      id: z.ZodString;
                      name: z.ZodString;
                      description: z.ZodString;
                      icon: z.ZodOptional<z.ZodString>;
                      priority: z.ZodEnum<{
                        HIGH: "HIGH";
                        MEDIUM: "MEDIUM";
                        LOW: "LOW";
                      }>;
                      promptGuidance: z.ZodString;
                      enabled: z.ZodBoolean;
                      isDefault: z.ZodBoolean;
                      isCustom: z.ZodBoolean;
                      expectedFeedbackCount: z.ZodOptional<z.ZodNumber>;
                      weight: z.ZodNumber;
                      scoringScale: z.ZodNumber;
                    },
                    z.core.$strip
                  >
                >
              >;
              holisticGuidance: z.ZodOptional<z.ZodString>;
              holisticMaxScore: z.ZodOptional<z.ZodNumber>;
              passingPercentage: z.ZodOptional<z.ZodNumber>;
              showModelAnswer: z.ZodOptional<z.ZodBoolean>;
              modelAnswer: z.ZodOptional<z.ZodString>;
              evaluatorGuidance: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        category: z.ZodOptional<
          z.ZodEnum<{
            general: "general";
            coding: "coding";
            essay: "essay";
            math: "math";
            science: "science";
            language: "language";
            custom: "custom";
          }>
        >;
        questionTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deleted: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract notification `ManageNotificationsRequestSchema`. */
export declare const ManageNotificationsRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    action: z.ZodEnum<{
      list: "list";
      markRead: "markRead";
    }>;
    limit: z.ZodOptional<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    notificationId: z.ZodOptional<z.ZodString>;
    markAllRead: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
>;
export type ManageNotificationsRequest = z.infer<typeof ManageNotificationsRequestSchema>;
/**
 * v1 successor: api-contract notification `ListNotificationsResponseSchema`.
 * B8: `createdAt` out over the wire is an ISO string (or null for legacy
 * docs missing it) — same as the pre-migration `toDate().toISOString()` output.
 */
export interface ManageNotificationsResponse {
  notifications?: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string | null;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
  }>;
  nextCursor?: string;
  success?: boolean;
}
