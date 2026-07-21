import { SpaceCover as LyceumSpaceCover } from "../common/lyceum";

/** Lightweight space card cover — deterministic gradient frame, no decorative thumbnails. */
export default function SpaceCover({
  title,
  subject,
}: {
  title: string;
  subject?: string | null;
}) {
  const seed = `${subject ?? ""}:${title}`;
  return <LyceumSpaceCover seed={seed} title={title} className="mb-3 h-28 rounded-lg" />;
}
