# @levelup/shared-types

Shared TypeScript types and interfaces for the Auto LevelUp monorepo.

## Overview

This package provides unified type definitions used across all applications and
services in the LevelUp platform.

## Installation

This is an internal package. In other workspace packages, add it as a
dependency:

```json
{
  "dependencies": {
    "@levelup/shared-types": "workspace:*"
  }
}
```

## Usage

```typescript
import { User, Course, Progress, Assessment } from "@levelup/shared-types";

const user: User = {
  id: "123",
  email: "student@example.com",
  name: "John Doe",
  role: UserRole.STUDENT,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## Type Categories

- **User Types**: User, Student, Teacher, UserRole
- **Course Types**: Course, Module, Lesson, CourseDifficulty
- **Progress Types**: Progress, LessonProgress, ProgressStatus
- **Assessment Types**: Assessment, Question, Submission, QuestionType,
  AssessmentType

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Build Configuration

This package uses [tsup](https://tsup.egoist.dev/) for building:

- Outputs both CommonJS and ESM formats
- Generates TypeScript declaration files
- Includes source maps
- Tree-shaking enabled
