import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  DocumentData,
  QueryConstraint,
  DocumentSnapshot,
  QuerySnapshot,
  WriteBatch,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseServices } from "../firebase";

/**
 * Firestore Service
 * Provides org-scoped data access and common Firestore operations
 */
export class FirestoreService {
  private _db: Firestore | null;

  constructor(db?: Firestore) {
    this._db = db ?? null;
  }

  private get db(): Firestore {
    if (!this._db) {
      this._db = getFirebaseServices().db;
    }
    return this._db;
  }

  /**
   * Get organization-scoped collection path
   * Implements multi-tenancy by prefixing with orgId
   */
  getOrgPath(orgId: string, collectionName: string): string {
    return `organizations/${orgId}/${collectionName}`;
  }

  /**
   * Get a document by ID from an org-scoped collection
   */
  async getDoc<T = DocumentData>(
    orgId: string,
    collectionName: string,
    docId: string
  ): Promise<DocumentSnapshot<T>> {
    const docRef = doc(this.db, this.getOrgPath(orgId, collectionName), docId);
    return getDoc(docRef) as Promise<DocumentSnapshot<T>>;
  }

  /**
   * Get all documents from an org-scoped collection
   */
  async getAllDocs<T = DocumentData>(
    orgId: string,
    collectionName: string,
    constraints?: QueryConstraint[]
  ): Promise<QuerySnapshot<T>> {
    const collectionRef = collection(this.db, this.getOrgPath(orgId, collectionName));
    const q = constraints ? query(collectionRef, ...constraints) : collectionRef;
    return getDocs(q) as Promise<QuerySnapshot<T>>;
  }

  /**
   * Set a document in an org-scoped collection
   */
  async setDoc<T = DocumentData>(
    orgId: string,
    collectionName: string,
    docId: string,
    data: T,
    merge = false
  ): Promise<void> {
    const docRef = doc(this.db, this.getOrgPath(orgId, collectionName), docId);
    return setDoc(docRef, data as DocumentData, { merge });
  }

  /**
   * Update a document in an org-scoped collection
   */
  async updateDoc(
    orgId: string,
    collectionName: string,
    docId: string,
    data: Partial<DocumentData>
  ): Promise<void> {
    const docRef = doc(this.db, this.getOrgPath(orgId, collectionName), docId);
    return updateDoc(docRef, data);
  }

  /**
   * Delete a document from an org-scoped collection
   */
  async deleteDoc(orgId: string, collectionName: string, docId: string): Promise<void> {
    const docRef = doc(this.db, this.getOrgPath(orgId, collectionName), docId);
    return deleteDoc(docRef);
  }

  /**
   * Create a batch for atomic writes
   */
  batch(): WriteBatch {
    return writeBatch(this.db);
  }

  /**
   * Get Firestore instance for advanced usage
   */
  getFirestoreInstance(): Firestore {
    return this.db;
  }

  /**
   * Get server timestamp
   */
  getServerTimestamp() {
    return serverTimestamp();
  }

  /**
   * Create Timestamp from Date
   */
  createTimestamp(date: Date): Timestamp {
    return Timestamp.fromDate(date);
  }
}

// Export singleton instance
export const firestoreService = new FirestoreService();

// Re-export Firestore utilities
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot,
};
