import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseServices } from "@levelup/shared-services";

/**
 * Hook to subscribe to a Realtime Database location
 */
export function useRealtimeDB<T = unknown>(
  orgId: string,
  path: string,
  options?: { disabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (options?.disabled) {
      setLoading(false);
      return;
    }

    const { rtdb } = getFirebaseServices();
    const fullPath = `tenants/${orgId}/${path}`;
    const dbRef = ref(rtdb, fullPath);

    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.val() as T);
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

    return () => {
      unsubscribe();
    };
  }, [orgId, path, options?.disabled]);

  return { data, loading, error };
}
