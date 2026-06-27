/**
 * Identity — tenant-scoped entity hooks (identity.md "Query hooks"):
 * students / teachers / parents / staff / classes / academic sessions, plus the
 * org-user provisioning + bulk hooks. Every save/create/bulk op is ⚷
 * (claims/membership affecting) — none is optimistic.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { invalidateForCallable } from "../invalidation/invalidate.js";
import {
  studentKeys,
  teacherKeys,
  parentKeys,
  staffKeys,
  classKeys,
  academicSessionKeys,
} from "../keys/registry.js";

/** Loose view of a per-entity repo (list/get/save/archive). */
interface EntityRepo {
  list(filter?: object): Promise<unknown>;
  get?(id: string): Promise<unknown>;
  save(input: unknown): Promise<unknown>;
  archive?(id: string): Promise<unknown>;
}
const repoOf = (repos: Repositories, name: string): EntityRepo =>
  (repos as unknown as Record<string, EntityRepo>)[name];

// ── students ───────────────────────────────────────────────────────────────
export function useStudents(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: studentKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "studentRepo").list(filter),
  });
}
export function useStudent(id: string): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: studentKeys.detail(id),
    queryFn: () => repoOf(repos, "studentRepo").get!(id),
    enabled: Boolean(id),
  });
}
export function useSaveStudent(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "studentRepo").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveStudent", { vars, data }),
  });
}

// ── teachers ───────────────────────────────────────────────────────────────
export function useTeachers(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: teacherKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "teacherRepo").list(filter),
  });
}
export function useTeacher(id: string): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: teacherKeys.detail(id),
    queryFn: () => repoOf(repos, "teacherRepo").get!(id),
    enabled: Boolean(id),
  });
}
export function useSaveTeacher(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "teacherRepo").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveTeacher", { vars, data }),
  });
}

// ── parents (entity repo is `parentRepoEntity` in the bag) ───────────────────
export function useParents(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: parentKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "parentRepoEntity").list(filter),
  });
}
export function useSaveParent(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "parentRepoEntity").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveParent", { vars, data }),
  });
}

// ── staff ──────────────────────────────────────────────────────────────────
export function useStaff(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: staffKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "staffRepo").list(filter),
  });
}
export function useSaveStaff(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "staffRepo").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveStaff", { vars, data }),
  });
}

// ── classes (view repo: list/get/save/archive) ───────────────────────────────
export function useClasses(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: classKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "classRepo").list(filter),
  });
}
export function useClass(classId: string): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: classKeys.detail(classId),
    queryFn: () =>
      (
        repos as unknown as Record<string, { get(i: { classId: string }): Promise<unknown> }>
      ).classRepo.get({ classId }),
    enabled: Boolean(classId),
  });
}
export function useSaveClass(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "classRepo").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveClass", { vars, data }),
  });
}

// ── academic sessions ────────────────────────────────────────────────────────
export function useAcademicSessions(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: academicSessionKeys.list(filter ?? {}),
    queryFn: () => repoOf(repos, "academicSessionRepo").list(filter),
  });
}
export function useSaveAcademicSession(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => repoOf(repos, "academicSessionRepo").save(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.saveAcademicSession", { vars, data }),
  });
}
export function useRolloverSession(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) =>
      (
        repos as unknown as Record<string, { rollover(i: unknown): Promise<unknown> }>
      ).academicSessionRepo.rollover(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.rolloverSession", { vars, data }),
  });
}

// ── org-user provisioning + bulk (idempotent, ⚷) ─────────────────────────────
interface OrgUserRepo {
  create(input: unknown): Promise<unknown>;
  bulkImportStudents(input: unknown): Promise<unknown>;
  bulkImportTeachers(input: unknown): Promise<unknown>;
  bulkUpdateStatus(input: unknown): Promise<unknown>;
}
const org = (repos: Repositories): OrgUserRepo =>
  (repos as unknown as Record<string, OrgUserRepo>).orgUserRepo;

export function useCreateOrgUser(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => org(repos).create(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.createOrgUser", { vars, data }),
  });
}
export function useBulkImportStudents(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => org(repos).bulkImportStudents(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.bulkImportStudents", { vars, data }),
  });
}
export function useBulkImportTeachers(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => org(repos).bulkImportTeachers(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.bulkImportTeachers", { vars, data }),
  });
}
export function useBulkUpdateStatus(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => org(repos).bulkUpdateStatus(input),
    onSettled: (data, _e, vars) =>
      void invalidateForCallable(qc, "v1.identity.bulkUpdateStatus", { vars, data }),
  });
}
