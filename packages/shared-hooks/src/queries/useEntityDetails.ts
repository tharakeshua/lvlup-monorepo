import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type {
  Class,
  Student,
  Teacher,
  Parent,
  UnifiedItem,
  Submission,
} from "@levelup/shared-types";

export function useClass(tenantId: string | null, classId: string | null) {
  return useQuery<Class | null>({
    queryKey: ["tenants", tenantId, "classes", classId],
    queryFn: async () => {
      if (!tenantId || !classId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/classes`, classId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Class;
    },
    enabled: !!tenantId && !!classId,
    staleTime: 30 * 1000,
  });
}

export function useStudent(tenantId: string | null, studentId: string | null) {
  return useQuery<Student | null>({
    queryKey: ["tenants", tenantId, "students", studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/students`, studentId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Student;
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 30 * 1000,
  });
}

export function useTeacher(tenantId: string | null, teacherId: string | null) {
  return useQuery<Teacher | null>({
    queryKey: ["tenants", tenantId, "teachers", teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/teachers`, teacherId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Teacher;
    },
    enabled: !!tenantId && !!teacherId,
    staleTime: 30 * 1000,
  });
}

export function useParent(tenantId: string | null, parentId: string | null) {
  return useQuery<Parent | null>({
    queryKey: ["tenants", tenantId, "parents", parentId],
    queryFn: async () => {
      if (!tenantId || !parentId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/parents`, parentId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Parent;
    },
    enabled: !!tenantId && !!parentId,
    staleTime: 30 * 1000,
  });
}

export function useItem(tenantId: string | null, spaceId: string | null, itemId: string | null) {
  return useQuery<UnifiedItem | null>({
    queryKey: ["tenants", tenantId, "spaces", spaceId, "items", itemId],
    queryFn: async () => {
      if (!tenantId || !spaceId || !itemId) return null;
      const { db } = getFirebaseServices();
      // Items can be under spaces or exams; default to spaces path
      const docRef = doc(db, `tenants/${tenantId}/spaces/${spaceId}/items`, itemId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as UnifiedItem;
    },
    enabled: !!tenantId && !!spaceId && !!itemId,
    staleTime: 30 * 1000,
  });
}

export function useSubmission(tenantId: string | null, submissionId: string | null) {
  return useQuery<Submission | null>({
    queryKey: ["tenants", tenantId, "submissions", submissionId],
    queryFn: async () => {
      if (!tenantId || !submissionId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/submissions`, submissionId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Submission;
    },
    enabled: !!tenantId && !!submissionId,
    staleTime: 30 * 1000,
  });
}
