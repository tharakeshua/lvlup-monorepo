import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, onAuthStateChanged } from "firebase/auth";
import { getFirebaseServices } from "@levelup/shared-services";

/**
 * Hook to manage Firebase authentication state using React Query.
 *
 * Uses queryFn with a Promise that resolves on the first auth state emission,
 * then keeps the cache updated via onAuthStateChanged listener.
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading: loading,
    error,
  } = useQuery<User | null>({
    queryKey: ["auth", "currentUser"],
    queryFn: () =>
      new Promise<User | null>((resolve, reject) => {
        const { auth } = getFirebaseServices();
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            resolve(user);
          },
          (error) => {
            unsubscribe();
            reject(error);
          }
        );
      }),
    staleTime: Infinity, // Auth state is managed by the listener below
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Initialize a persistent listener to keep the cache in sync
    meta: {
      onSettled: () => {
        const { auth } = getFirebaseServices();
        onAuthStateChanged(auth, (user) => {
          queryClient.setQueryData(["auth", "currentUser"], user);
        });
      },
    },
  });

  return {
    user: user ?? null,
    loading,
    error: error as Error | null,
    isAuthenticated: !!user,
  };
}

/**
 * Hook to get current user ID
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.uid ?? null;
}

/**
 * Hook to get current user email
 */
export function useUserEmail(): string | null {
  const { user } = useAuth();
  return user?.email ?? null;
}
