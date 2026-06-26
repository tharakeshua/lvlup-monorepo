import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  QueryConstraint,
  FirestoreError,
} from 'firebase/firestore';
import { getFirebaseServices } from '@levelup/shared-services';
import type { Submission } from '@levelup/shared-types';

export type { Submission } from '@levelup/shared-types';

export function useSubmissions(
  tenantId: string | null,
  options?: { examId?: string; studentId?: string; status?: string },
) {
  const examId = options?.examId;
  const studentId = options?.studentId;
  const status = options?.status;

  const [data, setData] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!tenantId);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const { db } = getFirebaseServices();
    const colRef = collection(db, `tenants/${tenantId}/submissions`);
    const constraints: QueryConstraint[] = [];
    if (examId) constraints.push(where('examId', '==', examId));
    if (studentId) constraints.push(where('studentId', '==', studentId));
    if (status) constraints.push(where('status', '==', status));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(colRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission));
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tenantId, examId, studentId, status]);

  const refetch = () => {};

  return { data, isLoading, error, refetch };
}
