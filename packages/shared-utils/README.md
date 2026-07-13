# @levelup/shared-utils

Shared utility functions for the LevelUp unified platform.

## Features

- 📄 **CSV Utilities**: Parse and validate CSV files for bulk imports
- 📑 **PDF Utilities**: Convert PDFs to images, file conversions
- ✅ **Validation**: Email, phone, URL, and field validation
- 🎨 **Formatting**: Currency, numbers, percentages, text formatting
- 📅 **Date Utilities**: Date formatting, relative time, date operations

## Installation

```bash
pnpm add @levelup/shared-utils
```

## Usage

### CSV Utilities

```typescript
import { parseStudentCSV } from "@levelup/shared-utils/csv";

const result = await parseStudentCSV(csvContent);
console.log(result.students); // Parsed students
console.log(result.parents); // Parsed parents
console.log(result.errors); // Validation errors
console.log(result.warnings); // Warnings
```

### PDF Utilities

```typescript
import { convertPdfToImages, fileToBase64 } from "@levelup/shared-utils/pdf";

// Convert PDF to images
const images = await convertPdfToImages(pdfFile);

// Convert file to base64
const base64 = await fileToBase64(file);
```

### Validation

```typescript
import {
  isValidEmail,
  isValidPhone,
  isValidURL,
  validateRequiredFields,
} from "@levelup/shared-utils/validation";

// Email validation
isValidEmail("user@example.com"); // true

// Phone validation
isValidPhone("+1-555-123-4567"); // true

// URL validation
isValidURL("https://example.com"); // true

// Required fields validation
const result = validateRequiredFields({ name: "John", email: "" }, [
  "name",
  "email",
  "phone",
]);
console.log(result.valid); // false
console.log(result.missing); // ['email', 'phone']
```

### Formatting

```typescript
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  truncate,
  toTitleCase,
  formatBytes,
  getInitials,
} from "@levelup/shared-utils/formatting";

// Currency
formatCurrency(1234.56); // "$1,234.56"

// Numbers
formatNumber(1234567.89, 2); // "1,234,567.89"

// Percentage
formatPercentage(85.5, 1); // "85.5%"

// Text truncation
truncate("Long text here", 10); // "Long te..."

// Title case
toTitleCase("hello world"); // "Hello World"

// Bytes
formatBytes(1024 * 1024); // "1 MB"

// Initials
getInitials("John Doe"); // "JD"
```

### Date Utilities

```typescript
import {
  formatDate,
  formatTime,
  formatDateTime,
  getRelativeTime,
  isToday,
  isPast,
  addDays,
} from "@levelup/shared-utils/date";

const date = new Date();

// Format date
formatDate(date); // "January 15, 2026"

// Format time
formatTime(date); // "03:30 PM"

// Format date and time
formatDateTime(date); // "Jan 15, 2026, 03:30 PM"

// Relative time
getRelativeTime(date); // "2 hours ago"

// Date checks
isToday(date); // true/false
isPast(date); // true/false

// Date operations
const future = addDays(date, 7); // Add 7 days
```

## API Reference

### Validation

- `isValidEmail(email: string): boolean`
- `isValidPhone(phone: string): boolean`
- `isValidURL(url: string): boolean`
- `isNotEmpty(value: string): boolean`
- `isInRange(value: number, min: number, max: number): boolean`
- `sanitizeString(input: string): string`
- `validateRequiredFields<T>(data: T, requiredFields: (keyof T)[])`

### Formatting

- `formatCurrency(amount: number, currency?: string, locale?: string): string`
- `formatNumber(value: number, decimals?: number, locale?: string): string`
- `formatPercentage(value: number, decimals?: number, locale?: string): string`
- `truncate(text: string, maxLength: number): string`
- `toTitleCase(text: string): string`
- `camelToKebab(text: string): string`
- `snakeToCamel(text: string): string`
- `formatBytes(bytes: number, decimals?: number): string`
- `getInitials(name: string, maxLength?: number): string`

### Date

- `formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string`
- `formatTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string`
- `formatDateTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string`
- `getRelativeTime(date: Date | string | number): string`
- `isToday(date: Date | string | number): boolean`
- `isPast(date: Date | string | number): boolean`
- `addDays(date: Date, days: number): Date`
- `startOfDay(date: Date): Date`
- `endOfDay(date: Date): Date`
