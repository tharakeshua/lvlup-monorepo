// CSV Parser Service for Bulk Student/Parent Import

export interface StudentCSVRow {
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  classIds: string[]; // Comma-separated in CSV
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface ParsedStudent {
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  classIds: string[];
  metadata?: {
    dateOfBirth?: string;
    phone?: string;
  };
}

export interface ParsedParent {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  studentEmails: string[]; // Links to students
}

export interface CSVParseResult {
  students: ParsedStudent[];
  parents: ParsedParent[];
  errors: CSVError[];
  warnings: CSVWarning[];
}

export interface CSVError {
  row: number;
  field: string;
  message: string;
}

export interface CSVWarning {
  row: number;
  field: string;
  message: string;
}

/**
 * Generate a CSV template for bulk student import
 */
export function generateCSVTemplate(): string {
  const headers = [
    "rollNumber",
    "firstName",
    "lastName",
    "email",
    "classIds",
    "parentFirstName",
    "parentLastName",
    "parentEmail",
    "parentPhone",
    "dateOfBirth",
    "phone",
  ];

  const exampleRows = [
    [
      "001",
      "John",
      "Doe",
      "john.doe@student.school.com",
      "class1,class2",
      "Jane",
      "Doe",
      "jane.doe@parent.com",
      "+1234567890",
      "2010-01-15",
      "+1234567891",
    ],
    [
      "002",
      "Alice",
      "Smith",
      "alice.smith@student.school.com",
      "class1",
      "Bob",
      "Smith",
      "bob.smith@parent.com",
      "+1234567892",
      "2010-03-20",
      "",
    ],
  ];

  const csvContent = [headers.join(","), ...exampleRows.map((row) => row.join(","))].join("\n");

  return csvContent;
}

/**
 * Download CSV template as file
 */
export function downloadCSVTemplate(): void {
  const content = generateCSVTemplate();
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "student_import_template.csv");
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Parse CSV file content
 */
export async function parseCSVFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const result = parseCSVContent(content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read CSV file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Parse CSV content string
 */
export function parseCSVContent(content: string): CSVParseResult {
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    return {
      students: [],
      parents: [],
      errors: [{ row: 0, field: "file", message: "CSV file is empty or has no data rows" }],
      warnings: [],
    };
  }

  const headers = parseCSVLine(lines[0]!);
  const students: ParsedStudent[] = [];
  const parentsMap = new Map<string, ParsedParent>();
  const errors: CSVError[] = [];
  const warnings: CSVWarning[] = [];

  // Validate headers
  const requiredHeaders = ["rollNumber", "firstName", "lastName", "email", "classIds"];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

  if (missingHeaders.length > 0) {
    errors.push({
      row: 0,
      field: "headers",
      message: `Missing required headers: ${missingHeaders.join(", ")}`,
    });
    return { students, parents: [], errors, warnings };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    // Validate required student fields
    const rowNumber = i + 1;
    let hasError = false;

    if (!row["rollNumber"]?.trim()) {
      errors.push({ row: rowNumber, field: "rollNumber", message: "Roll number is required" });
      hasError = true;
    }

    if (!row["firstName"]?.trim()) {
      errors.push({ row: rowNumber, field: "firstName", message: "First name is required" });
      hasError = true;
    }

    if (!row["lastName"]?.trim()) {
      errors.push({ row: rowNumber, field: "lastName", message: "Last name is required" });
      hasError = true;
    }

    if (!row["email"]?.trim()) {
      errors.push({ row: rowNumber, field: "email", message: "Email is required" });
      hasError = true;
    } else if (!isValidEmail(row["email"]!)) {
      errors.push({ row: rowNumber, field: "email", message: "Invalid email format" });
      hasError = true;
    }

    if (!row["classIds"]?.trim()) {
      warnings.push({
        row: rowNumber,
        field: "classIds",
        message: "No classes assigned to student",
      });
    }

    if (hasError) {
      continue;
    }

    // Parse student
    const student: ParsedStudent = {
      rollNumber: row["rollNumber"]!.trim(),
      firstName: row["firstName"]!.trim(),
      lastName: row["lastName"]!.trim(),
      email: row["email"]!.trim().toLowerCase(),
      classIds: row["classIds"]
        ? row["classIds"]
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
      metadata: {},
    };

    if (row["dateOfBirth"]?.trim()) {
      student.metadata!.dateOfBirth = row["dateOfBirth"].trim();
    }

    if (row["phone"]?.trim()) {
      student.metadata!.phone = row["phone"].trim();
    }

    students.push(student);

    // Parse parent if provided
    if (row["parentEmail"]?.trim()) {
      const parentEmail = row["parentEmail"].trim().toLowerCase();

      if (!isValidEmail(parentEmail)) {
        warnings.push({
          row: rowNumber,
          field: "parentEmail",
          message: "Invalid parent email format",
        });
      } else {
        if (!parentsMap.has(parentEmail)) {
          if (!row["parentFirstName"]?.trim() || !row["parentLastName"]?.trim()) {
            warnings.push({
              row: rowNumber,
              field: "parent",
              message: "Parent first name and last name required when parent email is provided",
            });
          } else {
            parentsMap.set(parentEmail, {
              firstName: row["parentFirstName"].trim(),
              lastName: row["parentLastName"].trim(),
              email: parentEmail,
              phone: row["parentPhone"]?.trim(),
              studentEmails: [student.email],
            });
          }
        } else {
          // Parent already exists, add this student to their children
          const parent = parentsMap.get(parentEmail)!;
          if (!parent.studentEmails.includes(student.email)) {
            parent.studentEmails.push(student.email);
          }
        }
      }
    }
  }

  return {
    students,
    parents: Array.from(parentsMap.values()),
    errors,
    warnings,
  };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate credentials CSV after import
 */
export function generateCredentialsCSV(
  students: Array<{ email: string; tempPassword: string }>,
  parents: Array<{ email: string; tempPassword: string }>
): string {
  const headers = ["Type", "Email", "Temporary Password"];
  const rows = [
    ...students.map((s) => ["Student", s.email, s.tempPassword]),
    ...parents.map((p) => ["Parent", p.email, p.tempPassword]),
  ];

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  return csvContent;
}

/**
 * Download credentials CSV
 */
export function downloadCredentialsCSV(
  students: Array<{ email: string; tempPassword: string }>,
  parents: Array<{ email: string; tempPassword: string }>
): void {
  const content = generateCredentialsCSV(students, parents);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `credentials_${timestamp}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
