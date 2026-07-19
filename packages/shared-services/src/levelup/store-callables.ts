/**
 * LevelUp store callable wrappers.
 * Covers: listStoreSpaces, purchaseSpace
 */

import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface ListStoreSpacesRequest {
  subject?: string;
  search?: string;
  limit?: number;
  startAfter?: string;
}

export interface StoreSpace {
  id: string;
  title: string;
  storeDescription: string;
  storeThumbnailUrl: string | null;
  subject: string | null;
  labels: string[];
  price: number;
  currency: string;
  totalStudents: number;
  totalStoryPoints: number;
}

export interface ListStoreSpacesResponse {
  spaces: StoreSpace[];
  hasMore: boolean;
  lastId: string | null;
}

export interface PurchaseSpaceRequest {
  spaceId: string;
  paymentToken?: string;
}

export interface PurchaseSpaceResponse {
  success: boolean;
  transactionId: string;
}

// ---------------------------------------------------------------------------
// Callable wrappers
// ---------------------------------------------------------------------------

function getCallable<Req, Res>(name: string) {
  const { functions } = getFirebaseServices();
  return httpsCallable<Req, Res>(functions, name);
}

export async function callListStoreSpaces(
  data: ListStoreSpacesRequest
): Promise<ListStoreSpacesResponse> {
  const fn = getCallable<ListStoreSpacesRequest, ListStoreSpacesResponse>("listStoreSpaces");
  const result = await fn(data);
  return result.data;
}

export async function callPurchaseSpace(
  data: PurchaseSpaceRequest
): Promise<PurchaseSpaceResponse> {
  const fn = getCallable<PurchaseSpaceRequest, PurchaseSpaceResponse>("purchaseSpace");
  const result = await fn(data);
  return result.data;
}
