import {
  Database,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
  push,
  DatabaseReference,
  DataSnapshot,
  Unsubscribe,
} from "firebase/database";
import { getFirebaseServices } from "../firebase";

/**
 * Realtime Database Service
 * Provides org-scoped realtime data operations
 */
export class RealtimeDBService {
  private _rtdb: Database | null;

  constructor(rtdb?: Database) {
    this._rtdb = rtdb ?? null;
  }

  private get rtdb(): Database {
    if (!this._rtdb) {
      this._rtdb = getFirebaseServices().rtdb;
    }
    return this._rtdb;
  }

  /**
   * Get organization-scoped database path
   */
  getOrgPath(orgId: string, path: string): string {
    return `organizations/${orgId}/${path}`;
  }

  /**
   * Get a reference to a database location
   */
  getRef(orgId: string, path: string): DatabaseReference {
    return ref(this.rtdb, this.getOrgPath(orgId, path));
  }

  /**
   * Read data once from a location
   */
  async getData<T = unknown>(orgId: string, path: string): Promise<T | null> {
    const dbRef = this.getRef(orgId, path);
    const snapshot = await get(dbRef);
    return snapshot.exists() ? (snapshot.val() as T) : null;
  }

  /**
   * Write data to a location
   */
  async setData<T = unknown>(orgId: string, path: string, data: T): Promise<void> {
    const dbRef = this.getRef(orgId, path);
    return set(dbRef, data);
  }

  /**
   * Update specific fields at a location
   */
  async updateData(orgId: string, path: string, updates: Record<string, unknown>): Promise<void> {
    const dbRef = this.getRef(orgId, path);
    return update(dbRef, updates);
  }

  /**
   * Delete data at a location
   */
  async deleteData(orgId: string, path: string): Promise<void> {
    const dbRef = this.getRef(orgId, path);
    return remove(dbRef);
  }

  /**
   * Push a new child to a list location
   */
  async pushData<T = unknown>(orgId: string, path: string, data: T): Promise<string> {
    const dbRef = this.getRef(orgId, path);
    const newRef = push(dbRef);
    await set(newRef, data);
    return newRef.key!;
  }

  /**
   * Subscribe to real-time updates at a location
   */
  subscribe<T = unknown>(
    orgId: string,
    path: string,
    callback: (data: T | null) => void
  ): Unsubscribe {
    const dbRef = this.getRef(orgId, path);
    const unsubscribe = onValue(dbRef, (snapshot: DataSnapshot) => {
      const data = snapshot.exists() ? (snapshot.val() as T) : null;
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe from a location
   */
  unsubscribe(orgId: string, path: string): void {
    const dbRef = this.getRef(orgId, path);
    off(dbRef);
  }

  /**
   * Get database instance for advanced usage
   */
  getDatabaseInstance(): Database {
    return this.rtdb;
  }
}

// Export singleton instance
export const realtimeDBService = new RealtimeDBService();

// Re-export RTDB utilities
export { ref as dbRef, type DatabaseReference, type DataSnapshot, type Unsubscribe };
