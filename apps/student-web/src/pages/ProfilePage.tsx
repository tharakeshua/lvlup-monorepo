import { useState, useRef, useCallback } from "react";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { useStudentSummary, useStudentAchievements, useStudentLevel } from "@levelup/query";
import type { UserId } from "@levelup/domain";
import { LevelBadge, StreakWidget, Card, CardContent, Skeleton, FadeIn } from "@levelup/shared-ui";
import { sonnerToast as toast } from "@levelup/shared-ui";
import { User, Award, Star, School, Camera, IdCard } from "lucide-react";
import { useTenantStore, useAuthStore } from "@levelup/shared-stores";
import { callUploadTenantAsset } from "@levelup/shared-services/auth";
import { updateProfile } from "firebase/auth";

function ProfileSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StudentIDCard({
  displayName,
  email,
  photoURL,
  tenantName,
  tenantCode,
  level,
  tier,
}: {
  displayName: string;
  email: string;
  photoURL?: string | null;
  tenantName?: string;
  tenantCode?: string;
  level?: number;
  tier?: string;
}) {
  return (
    <div className="border-primary/20 from-primary/5 via-background to-primary/10 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br p-6 shadow-md">
      <div className="bg-primary/5 absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full" />
      <div className="mb-4 flex items-center gap-2">
        <IdCard className="text-primary h-5 w-5" />
        <h3 className="text-primary text-sm font-bold uppercase tracking-wider">
          {tenantName ?? "LvlUp"} Student ID
        </h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 text-primary border-primary/20 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2">
          {photoURL ? (
            <img src={photoURL} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="text-xl font-bold">{getInitials(displayName)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{displayName}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
          {tenantCode && (
            <p className="text-muted-foreground mt-1 font-mono text-xs">Code: {tenantCode}</p>
          )}
        </div>
      </div>
      {(level || tier) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {level && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
              Level {level}
            </span>
          )}
          {tier && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium capitalize text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {tier}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const user = useCurrentUser();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const currentMembership = useAuthStore((s) => s.currentMembership);
  const tenantId = useCurrentTenantId();
  const tenantName = useTenantStore((s) => s.tenant?.name);

  const userId = (user?.uid ?? undefined) as UserId | undefined;

  const { data: summaryRaw, isLoading: summaryLoading } = useStudentSummary(
    (user?.uid ?? "") as UserId
  );
  const summary = summaryRaw as
    | { levelup: { streakDays: number; totalPointsEarned: number }; overallScore: number }
    | undefined;

  const { data: achievementsRaw, isLoading: achievementsLoading } = useStudentAchievements({
    userId,
  });
  const achievementsPages =
    (achievementsRaw as { pages?: Array<{ items?: unknown[] }> } | undefined)?.pages ?? [];
  const achievements = achievementsPages.flatMap((p) => p.items ?? []);

  const { data: levelData, isLoading: levelLoading } = useStudentLevel(userId);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
        toast.error("Please select an image under 2MB");
        return;
      }
      if (!tenantId || !firebaseUser) return;

      setUploading(true);
      try {
        const { uploadUrl, publicUrl } = await callUploadTenantAsset({
          tenantId,
          assetType: "profile_photo",
          contentType: file.type,
        });
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener("load", () =>
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"))
          );
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        await updateProfile(firebaseUser, { photoURL: publicUrl });
        toast.success("Profile photo updated");
        // Force a re-render by reloading auth state
        window.location.reload();
      } catch (err) {
        toast.error("Failed to upload photo", {
          description: err instanceof Error ? err.message : "Please try again",
        });
      } finally {
        setUploading(false);
      }
    },
    [tenantId, firebaseUser]
  );

  const isLoading = summaryLoading || achievementsLoading || levelLoading;
  const displayName = user?.displayName ?? user?.email ?? "Student";

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Profile Header */}
      <FadeIn>
        <div className="flex items-center gap-4">
          <div className="group relative">
            <div className="bg-primary/10 text-primary flex h-20 w-20 items-center justify-center overflow-hidden rounded-full">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold">{getInitials(displayName)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
              }}
              className="hidden"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            {uploading && <p className="text-primary mt-1 text-xs">Uploading photo...</p>}
          </div>
        </div>
      </FadeIn>

      {/* Student ID Card */}
      <FadeIn delay={0.05}>
        <StudentIDCard
          displayName={displayName}
          email={user?.email ?? ""}
          photoURL={user?.photoURL}
          tenantName={tenantName}
          tenantCode={currentMembership?.tenantCode}
          level={levelData?.level}
          tier={levelData?.tier}
        />
      </FadeIn>

      {/* Level Badge */}
      {levelData && (
        <FadeIn delay={0.1}>
          <LevelBadge
            level={levelData.level}
            currentXP={levelData.currentXP}
            xpToNextLevel={levelData.xpToNextLevel}
            tier={levelData.tier}
          />
        </FadeIn>
      )}

      {/* Streak Widget */}
      {summary && (
        <FadeIn delay={0.15}>
          <StreakWidget currentStreak={summary.levelup.streakDays} />
        </FadeIn>
      )}

      {/* Stats */}
      <FadeIn delay={0.2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <Award className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{achievements?.length ?? 0}</p>
                <p className="text-muted-foreground text-xs">Achievements Earned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
                aria-hidden="true"
              >
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.levelup.totalPointsEarned ?? 0}</p>
                <p className="text-muted-foreground text-xs">Total Points</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
                aria-hidden="true"
              >
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round((summary?.overallScore ?? 0) * 100)}%
                </p>
                <p className="text-muted-foreground text-xs">Overall Score</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* School Info */}
      {tenantName && (
        <FadeIn delay={0.25}>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className="bg-muted flex h-10 w-10 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <School className="text-muted-foreground h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{tenantName}</p>
                <p className="text-muted-foreground text-xs">School</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
