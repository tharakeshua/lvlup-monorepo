export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getStudentDisplayName(
  studentNames: Record<string, string> | undefined,
  student: { uid: string; studentId?: string },
  fallbackIndex?: number
): string {
  return (
    studentNames?.[student.uid] ||
    student.studentId ||
    (fallbackIndex != null ? `Child ${fallbackIndex + 1}` : "Student")
  );
}
