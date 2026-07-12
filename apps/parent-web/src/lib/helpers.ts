export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (name.slice(0, 2) || "??").toUpperCase();
}

function humanizeStudentId(id: string | undefined): string | null {
  if (!id) return null;
  // stu_greenwood-student-s-aarav_80317ac983 → Aarav
  const m = /student-s-([a-z0-9]+)/i.exec(id) || /stu_[^-]*-([a-z]+)/i.exec(id);
  if (m?.[1]) {
    return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  }
  return null;
}

export function getStudentDisplayName(
  studentNames: Record<string, string> | undefined,
  student: { uid: string; studentId?: string },
  fallbackIndex?: number,
): string {
  const raw = studentNames?.[student.uid];
  if (raw && raw !== "Unknown" && !raw.startsWith("stu_")) return raw;
  const fromId =
    humanizeStudentId(student.studentId) || humanizeStudentId(student.uid);
  if (fromId) return fromId;
  if (student.studentId && !student.studentId.startsWith("stu_")) return student.studentId;
  return fallbackIndex != null ? `Child ${fallbackIndex + 1}` : "Student";
}
