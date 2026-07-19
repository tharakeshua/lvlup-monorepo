import { useEffect, useState } from "react";
import { doc, onSnapshot, FirestoreError } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Exam } from "@levelup/shared-types";

export function useExam(tenantId: string | null, examId: string | null) {
  const [data, setData] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!tenantId && !!examId);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!tenantId || !examId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const { db } = getFirebaseServices();
    const docRef = doc(db, `tenants/${tenantId}/exams`, examId);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() } as Exam);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId, examId]);

  const refetch = () => {};

  return { data, isLoading, error, refetch };
}
