# Scanner App - Requirements Document

**App:** AutoGrade Scanner Portal v1.0 **Stack:** Vite + React 18 + Firebase +
Tailwind CSS + Zustand **Platform:** Mobile-first web app (PWA-ready) **Port:**
4574

---

## 1. Overview

The Scanner App is a standalone, mobile-friendly web application that enables
school staff (scanners) to photograph or upload physical exam answer sheets and
submit them into the AutoGrade pipeline for OCR processing and AI-powered
grading. The workflow is: Login → Select Exam → Select Student → Capture/Upload
Images → Submit.

---

## 2. Functional Requirements

### 2.1 Authentication

| ID     | Requirement                                                                                                                 | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-001 | The system shall authenticate scanners using three credentials: School Code, Username, and Password.                        | P0       |
| FR-002 | The system shall validate the school code against the `clients` collection in Firestore before authenticating.              | P0       |
| FR-003 | The system shall verify the user has an active membership (`status: 'active'`) in the matched tenant.                       | P0       |
| FR-004 | The system shall fetch the scanner profile from `clients/{clientId}/scanners` after successful auth.                        | P0       |
| FR-005 | The system shall persist the scanner session (uid, scanner profile, client info) to localStorage for session restoration.   | P1       |
| FR-006 | The system shall restore the session from localStorage on page reload, showing a loading spinner while checking auth state. | P1       |
| FR-007 | The system shall update `lastLoginAt` timestamp on the scanner profile upon successful login.                               | P2       |
| FR-008 | The system shall provide a sign-out button on the dashboard that clears the session and redirects to the login page.        | P0       |
| FR-009 | The system shall redirect unauthenticated users to the login page when they attempt to access protected routes.             | P0       |
| FR-010 | The system shall display inline validation errors on the login form (e.g., "School code not found", "Invalid credentials"). | P1       |

### 2.2 Dashboard

| ID     | Requirement                                                                                           | Priority |
| ------ | ----------------------------------------------------------------------------------------------------- | -------- |
| FR-011 | The dashboard shall display the scanner's name, avatar (initials-based), and school code.             | P1       |
| FR-012 | The dashboard shall display a "Start Scanning" action card that navigates to the exam selection page. | P0       |
| FR-013 | The dashboard shall display a quick-start guide showing the 4-step scanning workflow.                 | P2       |

### 2.3 Exam Selection

| ID     | Requirement                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-014 | The system shall list all exams with status `ready` or `question_paper_uploaded` from the tenant's exams collection. | P0       |
| FR-015 | The exam list shall be ordered by `examDate` descending (most recent first).                                         | P1       |
| FR-016 | Each exam card shall display: title, subject, exam date, total marks, and question count.                            | P1       |
| FR-017 | The system shall provide a search/filter input to filter exams by title or subject.                                  | P1       |
| FR-018 | Selecting an exam shall navigate to the student selection page with the exam ID as a route parameter.                | P0       |
| FR-019 | The page shall include a back button to return to the dashboard.                                                     | P1       |

### 2.4 Student Selection

| ID     | Requirement                                                                                                 | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| FR-020 | The system shall list students who belong to the classes assigned to the selected exam.                     | P0       |
| FR-021 | The system shall only display active students (`status: 'active'`).                                         | P0       |
| FR-022 | Each student entry shall display: avatar (initials-based), full name, and roll number.                      | P1       |
| FR-023 | The system shall provide a search input to filter students by name or roll number.                          | P1       |
| FR-024 | Selecting a student shall navigate to the upload page with both exam ID and student ID as route parameters. | P0       |
| FR-025 | The page shall include a back button to return to exam selection.                                           | P1       |

### 2.5 Scanning & Upload

#### 2.5.1 Image Capture

| ID     | Requirement                                                                                                    | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------- | -------- |
| FR-026 | The upload page shall provide a toggle to switch between "File Upload" and "Camera Capture" modes.             | P0       |
| FR-027 | The Camera Capture component shall access the device camera and display a live viewfinder with overlay guides. | P0       |
| FR-028 | The camera shall capture images when the user taps the capture button.                                         | P0       |
| FR-029 | Captured images shall be added to the image preview grid.                                                      | P0       |

#### 2.5.2 File Upload

| ID     | Requirement                                                                                    | Priority |
| ------ | ---------------------------------------------------------------------------------------------- | -------- |
| FR-030 | The File Upload component shall accept images and PDF files via drag-and-drop or file browser. | P0       |
| FR-031 | Uploaded files shall be validated for supported formats (JPEG, PNG, PDF).                      | P1       |
| FR-032 | Uploaded images shall be added to the image preview grid.                                      | P0       |

#### 2.5.3 Image Management

| ID     | Requirement                                                                                                                                                        | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-033 | The system shall display uploaded/captured images in a responsive grid (3-4 columns).                                                                              | P1       |
| FR-034 | Each image in the grid shall have a remove button to delete it before submission.                                                                                  | P1       |
| FR-035 | The system shall provide a full-screen image viewer (ImageViewer) with thumbnail strip, left/right navigation, and keyboard support (arrow keys, Escape to close). | P1       |

#### 2.5.4 Submission

| ID     | Requirement                                                                                                                                                    | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-036 | The system shall compress all images before upload (max 1920px dimension, 85% JPEG quality).                                                                   | P0       |
| FR-037 | The system shall upload compressed images to Firebase Cloud Storage.                                                                                           | P0       |
| FR-038 | The system shall create a submission document in Firestore with denormalized data including: student info, exam info, scanner info, image URLs, and timestamp. | P0       |
| FR-039 | The system shall display progress toasts for each submission step: compressing, uploading, creating submission record.                                         | P1       |
| FR-040 | The submit button shall be displayed in a fixed bottom bar for easy access on mobile devices.                                                                  | P1       |
| FR-041 | The system shall prevent submission if no images have been captured/uploaded.                                                                                  | P0       |
| FR-042 | The system shall generate unique IDs for submissions using timestamp + random string pattern.                                                                  | P2       |

### 2.6 AutoGrade Integration

| ID     | Requirement                                                                                                                                                    | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-043 | Submissions shall be written to the Firestore path expected by the AutoGrade pipeline (with status field for pipeline pickup).                                 | P0       |
| FR-044 | Images shall be uploaded to Cloud Storage paths following the AutoGrade convention for downstream OCR processing.                                              | P0       |
| FR-045 | The submission document shall include all fields required by the grading pipeline: examId, studentId, imageUrls, submittedBy, submittedAt, and grading status. | P0       |
| FR-046 | The system shall call Cloud Functions (us-central1 region) for any server-side operations.                                                                     | P1       |

### 2.7 Navigation & Routing

| ID     | Requirement                                                                                                                                                                                                                                 | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-047 | The app shall use React Router with the following route structure: `/login` (public), `/` (dashboard), `/exams` (exam selection), `/exams/:examId/students` (student selection), `/exams/:examId/students/:studentId/upload` (upload page). | P0       |
| FR-048 | All routes except `/login` shall be protected by the RequireAuth guard.                                                                                                                                                                     | P0       |
| FR-049 | Each page in the scanning workflow shall provide back navigation to the previous step.                                                                                                                                                      | P1       |

---

## 3. Non-Functional Requirements

### 3.1 Mobile Usability

| ID      | Requirement                                                                                       | Priority |
| ------- | ------------------------------------------------------------------------------------------------- | -------- |
| NFR-001 | The app shall be fully responsive and optimized for mobile-first usage (phones and tablets).      | P0       |
| NFR-002 | Touch targets (buttons, cards, list items) shall be at least 44x44px per WCAG guidelines.         | P1       |
| NFR-003 | The submit button shall remain visible and accessible via a fixed bottom bar on mobile viewports. | P0       |
| NFR-004 | The image preview grid shall adapt from 3 columns on mobile to 4 columns on larger screens.       | P1       |
| NFR-005 | Form inputs shall use appropriate mobile keyboard types (e.g., text for school code).             | P2       |

### 3.2 Camera & Permissions

| ID      | Requirement                                                                                             | Priority |
| ------- | ------------------------------------------------------------------------------------------------------- | -------- |
| NFR-006 | The app shall request camera permissions only when the user activates camera capture mode.              | P0       |
| NFR-007 | The app shall display a clear error message if camera access is denied or unavailable.                  | P1       |
| NFR-008 | The camera viewfinder shall include overlay guides to help users align answer sheets.                   | P1       |
| NFR-009 | The app shall support both front and rear cameras, defaulting to the rear camera for document scanning. | P2       |

### 3.3 Performance

| ID      | Requirement                                                                                               | Priority |
| ------- | --------------------------------------------------------------------------------------------------------- | -------- |
| NFR-010 | Image compression shall reduce file size while maintaining readability for OCR (max 1920px, 85% quality). | P0       |
| NFR-011 | The app shall provide visual feedback (loading spinners, progress toasts) during all async operations.    | P1       |
| NFR-012 | The initial page load shall complete within 3 seconds on a 3G connection.                                 | P1       |
| NFR-013 | The app shall use Vite for fast development builds and optimized production bundles.                      | P2       |

### 3.4 Offline Resilience

| ID      | Requirement                                                                                                                          | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-014 | The app shall persist the user session to localStorage so that a page refresh does not require re-authentication.                    | P0       |
| NFR-015 | The app shall display a clear error state when network connectivity is lost during upload.                                           | P1       |
| NFR-016 | The app should gracefully handle Firebase connection failures with user-friendly error messages.                                     | P1       |
| NFR-017 | Captured images shall be held in local state (memory) until explicit submission, preventing data loss from transient network issues. | P1       |

### 3.5 Security

| ID      | Requirement                                                                                          | Priority |
| ------- | ---------------------------------------------------------------------------------------------------- | -------- |
| NFR-018 | All Firebase credentials shall be stored in environment variables (VITE*FIREBASE*\*), not hardcoded. | P0       |
| NFR-019 | The app shall verify tenant membership and active status before granting access.                     | P0       |
| NFR-020 | Protected routes shall redirect to login if the auth state is missing or expired.                    | P0       |
| NFR-021 | Cloud Storage uploads shall be restricted to authenticated scanners via Firebase Security Rules.     | P0       |

### 3.6 UI & Design

| ID      | Requirement                                                                                    | Priority |
| ------- | ---------------------------------------------------------------------------------------------- | -------- |
| NFR-022 | The app shall use a consistent purple primary color palette (#7c3aed base) with Tailwind CSS.  | P2       |
| NFR-023 | The app shall use react-hot-toast for non-blocking notifications and progress feedback.        | P2       |
| NFR-024 | The app shall render mathematical content in exam data using KaTeX via react-markdown.         | P1       |
| NFR-025 | The UI shall use Headless UI components (Dropdown, Modal) for accessible interactive elements. | P2       |

---

## 4. Data Model Summary

| Entity     | Firestore Path                                  | Key Fields                                                       |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Client     | `clients/{clientId}`                            | name, code, status                                               |
| Scanner    | `clients/{clientId}/scanners/{scannerId}`       | name, userId, lastLoginAt                                        |
| Exam       | `clients/{clientId}/exams/{examId}`             | title, subject, examDate, totalMarks, status, classes[]          |
| Student    | `clients/{clientId}/students/{studentId}`       | name, rollNumber, classes[], status                              |
| Submission | `clients/{clientId}/submissions/{submissionId}` | examId, studentId, imageUrls[], submittedBy, submittedAt, status |
| Membership | `userMemberships/{uid}`                         | clientId, role, status                                           |

---

## 5. Tech Stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Framework      | React 18 + Vite 6                                    |
| Language       | TypeScript 5.6 (strict)                              |
| Styling        | Tailwind CSS 3.4                                     |
| State          | Zustand 5                                            |
| Forms          | React Hook Form 7 + Zod 4                            |
| Routing        | React Router DOM 6                                   |
| Backend        | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Notifications  | react-hot-toast                                      |
| Math Rendering | KaTeX + react-markdown + remark-math + rehype-katex  |
