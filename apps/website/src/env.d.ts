/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ADMIN_URL?: string;
  readonly PUBLIC_TEACHER_URL?: string;
  readonly PUBLIC_STUDENT_URL?: string;
  readonly PUBLIC_PARENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
