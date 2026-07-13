import { useState, useEffect, useRef } from "react";
import { collection, query, onSnapshot, QueryConstraint, DocumentData } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";

/**
 * Hook to subscribe to a Firestore collection
 */
export function useFirestoreCollection<T = DocumentData>(
  orgId: string,
  collectionName: string,
  constraints?: QueryConstraint[],
  options?: { disabled?: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use a ref to store constraints and only update when they actually change
  const constraintsRef = useRef(constraints);
  const serialized = JSON.stringify(constraints);
  const prevSerializedRef = useRef(serialized);

  if (prevSerializedRef.current !== serialized) {
    prevSerializedRef.current = serialized;
    constraintsRef.current = constraints;
  }
  const stableConstraints = constraintsRef.current;

  useEffect(() => {
    if (options?.disabled) {
      setLoading(false);
      return;
    }

    const { db } = getFirebaseServices();
    const path = `tenants/${orgId}/${collectionName}`;
    const collectionRef = collection(db, path);
    const q = stableConstraints ? query(collectionRef, ...stableConstraints) : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(documents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, collectionName, stableConstraints, options?.disabled]);

  return { data, loading, error };
}
