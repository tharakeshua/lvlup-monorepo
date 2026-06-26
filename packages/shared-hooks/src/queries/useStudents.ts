import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@levelup/shared-services';
import type { Student } from '@levelup/shared-types';

export type { Student } from '@levelup/shared-types';

/**
 * Client-side sort by rollNumber. Done in JS so students missing a rollNumber
 * aren't silently dropped (Firestore orderBy excludes docs where the ordered
 * field is null/absent); those sort last. The Student doc carries no name
 * field, so rollNumber is the only stable key available here.
 */
function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const ar = a.rollNumber ?? '';
    const br = b.rollNumber ?? '';
    if (ar && br && ar !== br) return ar.localeCompare(br);
    if (ar && !br) return -1;
    if (!ar && br) return 1;
    return 0;
  });
}

/** Chunked `in`-query by documentId — Firestore allows up to 30 ids per `in`. */
async function fetchStudentsByIds(
  tenantId: string,
  studentIds: string[],
): Promise<Student[]> {
  if (studentIds.length === 0) return [];
  const { db } = getFirebaseServices();
  const colRef = collection(db, `tenants/${tenantId}/students`);
  const CHUNK = 30;
  const results: Student[] = [];
  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunk = studentIds.slice(i, i + CHUNK);
    const snap = await getDocs(query(colRef, where(documentId(), 'in', chunk)));
    for (const d of snap.docs) results.push({ id: d.id, ...d.data() } as Student);
  }
  return results;
}

export function useStudents(
  tenantId: string | null,
  options?: { classId?: string; status?: string; grade?: string },
) {
  return useQuery<Student[]>({
    queryKey: ['tenants', tenantId, 'students', options ?? {}],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();

      // ── classId path: read class doc → fetch students by ID. This makes the
      // list consistent with `class.studentCount` (same denormalized source)
      // and avoids the `orderBy` exclusion bug when rollNumber is missing.
      if (options?.classId) {
        const classSnap = await getDoc(doc(db, `tenants/${tenantId}/classes/${options.classId}`));
        const classData = classSnap.data();
        const studentIds: string[] = Array.isArray(classData?.['studentIds'])
          ? (classData['studentIds'] as string[])
          : [];

        let students = await fetchStudentsByIds(tenantId, studentIds);

        // Fallback: if class.studentIds is empty/missing but students have
        // classIds pointing here, recover via array-contains.
        if (students.length === 0) {
          const colRef = collection(db, `tenants/${tenantId}/students`);
          const snap = await getDocs(
            query(colRef, where('classIds', 'array-contains', options.classId)),
          );
          students = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student);
        }

        if (options.status) students = students.filter((s) => s.status === options.status);
        if (options.grade) students = students.filter((s) => s.grade === options.grade);
        return sortStudents(students);
      }

      // ── tenant-wide path
      const colRef = collection(db, `tenants/${tenantId}/students`);
      const constraints: QueryConstraint[] = [];
      if (options?.status) constraints.push(where('status', '==', options.status));
      if (options?.grade) constraints.push(where('grade', '==', options.grade));
      const snap = await getDocs(query(colRef, ...constraints));
      const students = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student);
      return sortStudents(students);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { tenantId: string; uid: string; rollNumber?: string; section?: string; classId?: string; grade?: string; admissionNumber?: string; dateOfBirth?: string },
    { studentId: string }
  >(functions, 'createStudent');

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      uid: string;
      rollNumber?: string;
      section?: string;
      classId?: string;
      grade?: string;
      admissionNumber?: string;
      dateOfBirth?: string;
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants', variables.tenantId, 'students'] });
      queryClient.invalidateQueries({ queryKey: ['tenants', variables.tenantId, 'classes'] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { tenantId: string; studentId: string; rollNumber?: string; section?: string; classIds?: string[]; parentIds?: string[]; grade?: string; admissionNumber?: string; dateOfBirth?: string },
    { success: boolean }
  >(functions, 'updateStudent');

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      studentId: string;
      rollNumber?: string;
      section?: string;
      classIds?: string[];
      parentIds?: string[];
      grade?: string;
      admissionNumber?: string;
      dateOfBirth?: string;
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants', variables.tenantId, 'students'] });
      queryClient.invalidateQueries({ queryKey: ['tenants', variables.tenantId, 'classes'] });
    },
  });
}
