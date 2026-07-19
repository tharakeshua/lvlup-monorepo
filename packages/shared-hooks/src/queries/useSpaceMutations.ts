import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { SaveSpaceRequest, SaveResponse } from "@levelup/shared-types";

export function useCreateSpace() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveSpaceRequest, SaveResponse>(functions, "saveSpace");

  return useMutation({
    mutationFn: async (params: Omit<SaveSpaceRequest, "id">) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "spaces"] });
    },
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveSpaceRequest, SaveResponse>(functions, "saveSpace");

  return useMutation({
    mutationFn: async (params: SaveSpaceRequest & { id: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "spaces"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.id],
      });
    },
  });
}

export function usePublishSpace() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveSpaceRequest, SaveResponse>(functions, "saveSpace");

  return useMutation({
    mutationFn: async (params: { tenantId: string; spaceId: string }) => {
      const result = await callable({
        id: params.spaceId,
        tenantId: params.tenantId,
        data: { status: "published" },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "spaces"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId],
      });
    },
  });
}

export function useArchiveSpace() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveSpaceRequest, SaveResponse>(functions, "saveSpace");

  return useMutation({
    mutationFn: async (params: { tenantId: string; spaceId: string }) => {
      const result = await callable({
        id: params.spaceId,
        tenantId: params.tenantId,
        data: { status: "archived" },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "spaces"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId],
      });
    },
  });
}

export function useDuplicateSpace() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const saveSpace = httpsCallable<SaveSpaceRequest, SaveResponse>(functions, "saveSpace");
  const saveStoryPoint = httpsCallable<
    import("@levelup/shared-types").SaveStoryPointRequest,
    SaveResponse
  >(functions, "saveStoryPoint");
  const saveItem = httpsCallable<import("@levelup/shared-types").SaveItemRequest, SaveResponse>(
    functions,
    "saveItem"
  );

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      sourceSpace: import("@levelup/shared-types").Space;
      storyPoints: import("@levelup/shared-types").StoryPoint[];
      itemsByStoryPoint: Record<string, import("@levelup/shared-types").UnifiedItem[]>;
    }) => {
      const { tenantId, sourceSpace, storyPoints, itemsByStoryPoint } = params;

      // 1. Create new space (draft copy)
      const spaceResult = await saveSpace({
        tenantId,
        data: {
          title: `${sourceSpace.title} (Copy)`,
          description: sourceSpace.description,
          type: sourceSpace.type,
          subject: sourceSpace.subject,
          labels: sourceSpace.labels,
          accessType: sourceSpace.accessType,
          defaultTimeLimitMinutes: sourceSpace.defaultTimeLimitMinutes,
          allowRetakes: sourceSpace.allowRetakes,
          maxRetakes: sourceSpace.maxRetakes,
          showCorrectAnswers: sourceSpace.showCorrectAnswers,
          defaultRubric: sourceSpace.defaultRubric,
        },
      });
      const newSpaceId = spaceResult.data.id;

      // 2. Copy story points
      for (const sp of storyPoints) {
        const spResult = await saveStoryPoint({
          tenantId,
          spaceId: newSpaceId,
          data: {
            title: sp.title,
            description: sp.description,
            orderIndex: sp.orderIndex,
            type: sp.type,
            sections: sp.sections,
            assessmentConfig: sp.assessmentConfig,
            defaultRubric: sp.defaultRubric,
            difficulty: sp.difficulty,
            estimatedTimeMinutes: sp.estimatedTimeMinutes,
          },
        });
        const newSPId = spResult.data.id;

        // 3. Copy items for this story point
        const spItems = itemsByStoryPoint[sp.id] ?? [];
        for (const item of spItems) {
          await saveItem({
            tenantId,
            spaceId: newSpaceId,
            storyPointId: newSPId,
            data: {
              type: item.type,
              payload: item.payload,
              title: item.title,
              content: item.content,
              difficulty: item.difficulty,
              topics: item.topics,
              labels: item.labels,
              orderIndex: item.orderIndex,
              rubric: item.rubric,
              sectionId: item.sectionId,
            },
          });
        }
      }

      return { id: newSpaceId, created: true };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "spaces"] });
    },
  });
}
