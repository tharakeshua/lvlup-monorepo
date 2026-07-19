import { useState, useEffect } from "react";
import { doc, onSnapshot, DocumentData } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";

/**
 * Hook to subscribe to a Firestore document
 */
export function useFirestoreDoc<T = DocumentData>(
  orgId: string,
  collectionName: string,
  docId: string | null,
  options?: { disabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docId || options?.disabled) {
      setLoading(false);
      return;
    }

    const { db } = getFirebaseServices();
    const path = `tenants/${orgId}/${collectionName}`;
    const docRef = doc(db, path, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, collectionName, docId, options?.disabled]);

  return { data, loading, error };
}
