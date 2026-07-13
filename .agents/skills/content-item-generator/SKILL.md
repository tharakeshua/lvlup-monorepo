---
name: content-item-generator
description:
  Schemas, templates, and AI generation patterns for all Auto-LevelUp content
  item types. Covers 15 question types, 7 material types, 4 story point types,
  and AI-powered content generation from topics.
origin: custom
---

# Content Item Generator

Complete reference for creating content items (questions + materials) for the
Auto-LevelUp learning platform.

## When to Activate

- Creating space/course content with questions and materials
- Generating content items from a topic/subject using AI
- Building story points with different assessment types
- Writing seed data for spaces and their content
- Designing assessment configurations

## Type System Reference

### Item Types (7)

`question` | `material` | `interactive` | `assessment` | `discussion` |
`project` | `checkpoint`

### Question Types (15)

`mcq` | `mcaq` | `true-false` | `numerical` | `text` | `paragraph` | `code` |
`fill-blanks` | `fill-blanks-dd` | `matching` | `jumbled` | `audio` |
`image_evaluation` | `group-options` | `chat_agent_question`

### Material Types (7)

`text` | `video` | `pdf` | `link` | `interactive` | `story` | `rich`

### Story Point Types (4)

`standard` | `practice` | `quiz` | `timed_test`

### Auto-evaluatable (instant grading)

`mcq`, `mcaq`, `true-false`, `numerical`, `fill-blanks`, `fill-blanks-dd`,
`matching`, `jumbled`, `group-options`

### AI-evaluatable (requires LLM)

`text`, `paragraph`, `code`, `audio`, `image_evaluation`, `chat_agent_question`

## Item Payload Templates

### MCQ (Multiple Choice)

```typescript
{
  type: 'question',
  data: {
    questionType: 'mcq',
    content: 'Question text here',
    explanation: 'Why the correct answer is correct',
    basePoints: 10,
    difficulty: 'easy' | 'medium' | 'hard',
    questionData: {
      options: [
        { id: 'a', text: 'Option A', isCorrect: true, explanation: 'Why correct' },
        { id: 'b', text: 'Option B', isCorrect: false },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ],
      shuffleOptions: true,
    },
  },
}
```

### MCAQ (Multiple Correct Answers)

```typescript
{
  type: 'question',
  data: {
    questionType: 'mcaq',
    content: 'Select ALL correct answers:',
    basePoints: 15,
    difficulty: 'medium',
    questionData: {
      options: [
        { id: 'a', text: 'Correct 1', isCorrect: true },
        { id: 'b', text: 'Correct 2', isCorrect: true },
        { id: 'c', text: 'Wrong 1', isCorrect: false },
        { id: 'd', text: 'Wrong 2', isCorrect: false },
      ],
      minSelections: 1,
      maxSelections: 4,
    },
  },
}
```

### True/False

```typescript
{
  type: 'question',
  data: {
    questionType: 'true-false',
    content: 'Statement to evaluate',
    basePoints: 10,
    difficulty: 'easy',
    questionData: {
      correctAnswer: true | false,
      explanation: 'Why this is true/false',
    },
  },
}
```

### Numerical

```typescript
{
  type: 'question',
  data: {
    questionType: 'numerical',
    content: 'Calculate the result...',
    basePoints: 10,
    difficulty: 'medium',
    questionData: {
      correctAnswer: 42,
      tolerance: 0.5,
      unit: 'kg',
      decimalPlaces: 2,
    },
  },
}
```

### Text (Short Answer)

```typescript
{
  type: 'question',
  data: {
    questionType: 'text',
    content: 'What is...?',
    basePoints: 15,
    difficulty: 'medium',
    questionData: {
      correctAnswer: 'Expected answer',
      caseSensitive: false,
      acceptableAnswers: ['alt1', 'alt2'],
      maxLength: 200,
    },
  },
}
```

### Paragraph (Long Answer)

```typescript
{
  type: 'question',
  data: {
    questionType: 'paragraph',
    content: 'Explain in detail...',
    basePoints: 25,
    difficulty: 'hard',
    questionData: {
      maxLength: 2000,
      minLength: 100,
      modelAnswer: 'Detailed model answer...',
      evaluationGuidance: 'Look for: key concept 1, example usage, trade-offs',
    },
  },
}
```

### Fill-in-the-Blanks

```typescript
{
  type: 'question',
  data: {
    questionType: 'fill-blanks',
    content: 'The ___BLANK_1___ theorem states...',
    basePoints: 10,
    difficulty: 'medium',
    questionData: {
      textWithBlanks: 'The ___BLANK_1___ theorem states that...',
      blanks: [
        { id: 'BLANK_1', correctAnswer: 'CAP', acceptableAnswers: ['cap'], caseSensitive: false },
      ],
    },
  },
}
```

### Matching

```typescript
{
  type: 'question',
  data: {
    questionType: 'matching',
    content: 'Match each item on the left with its pair on the right',
    basePoints: 20,
    difficulty: 'medium',
    questionData: {
      pairs: [
        { id: 'p1', left: 'Redis', right: 'Caching' },
        { id: 'p2', left: 'PostgreSQL', right: 'Relational Data' },
        { id: 'p3', left: 'MongoDB', right: 'Document Storage' },
      ],
      shufflePairs: true,
    },
  },
}
```

### Jumbled (Ordering/Sequencing)

```typescript
{
  type: 'question',
  data: {
    questionType: 'jumbled',
    content: 'Arrange in the correct order',
    basePoints: 15,
    difficulty: 'medium',
    questionData: {
      correctOrder: ['item_1', 'item_2', 'item_3', 'item_4'],
      items: [
        { id: 'item_1', text: 'First step' },
        { id: 'item_2', text: 'Second step' },
        { id: 'item_3', text: 'Third step' },
        { id: 'item_4', text: 'Fourth step' },
      ],
    },
  },
}
```

### Rich Material

```typescript
{
  type: 'material',
  data: {
    materialType: 'rich',
    richContent: {
      title: 'Material Title',
      subtitle: 'Optional subtitle',
      blocks: [
        { id: 'b1', type: 'heading', content: 'Section Title', metadata: { level: 2 } },
        { id: 'b2', type: 'paragraph', content: 'Body text...' },
        { id: 'b3', type: 'list', content: '', metadata: { listType: 'unordered', items: ['Item 1', 'Item 2'] } },
        { id: 'b4', type: 'code', content: 'const x = 42;', metadata: { language: 'typescript' } },
        { id: 'b5', type: 'quote', content: 'Important quote...' },
        { id: 'b6', type: 'divider', content: '' },
        { id: 'b7', type: 'image', content: 'https://example.com/image.png', metadata: { alt: 'Description', caption: 'Caption text' } },
      ],
      readingTime: 5,
      tags: ['topic1', 'topic2'],
    },
  },
}
```

### Video Material

```typescript
{
  type: 'material',
  data: {
    materialType: 'video',
    url: 'https://youtube.com/watch?v=...',
    duration: 600, // seconds
    downloadable: false,
    content: 'Video description text',
  },
}
```

## Story Point Configurations

### Standard (Learning)

```typescript
{
  type: 'standard',
  sections: [
    { id: 'sec_theory', title: 'Theory & Concepts', orderIndex: 0 },
    { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
  ],
  // No assessmentConfig needed
}
```

### Practice

```typescript
{
  type: 'practice',
  sections: [
    { id: 'sec_concepts', title: 'Key Concepts', orderIndex: 0 },
    { id: 'sec_exercises', title: 'Exercises', orderIndex: 1 },
  ],
  // Optional assessmentConfig
}
```

### Quiz

```typescript
{
  type: 'quiz',
  assessmentConfig: {
    maxAttempts: 3,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResultsImmediately: true,
    passingPercentage: 60,
  },
}
```

### Timed Test

```typescript
{
  type: 'timed_test',
  assessmentConfig: {
    durationMinutes: 30,
    maxAttempts: 1,
    shuffleQuestions: true,
    showResultsImmediately: false,
    passingPercentage: 50,
  },
}
```

## AI Content Generation Prompt Template

When generating content from a topic, use this pattern:

```
Generate {N} content items for the topic "{TOPIC}" in subject "{SUBJECT}".

Requirements:
- Mix of question types: {types list}
- Difficulty distribution: {easy/medium/hard ratio}
- Include {N_materials} rich material items for theory
- Each question must have: content, explanation, basePoints, difficulty
- MCQ/MCAQ must have 4 options with exactly the correct ones marked
- Numerical must have correct answer and tolerance
- Fill-blanks must have proper blank markers
- Paragraph questions need modelAnswer and evaluationGuidance

Output as TypeScript ItemSeed[] array matching the payload templates above.
```

## Seed Data Structure

```typescript
interface SpaceConfig {
  title: string;
  description: string;
  subject: string;
  type: "learning" | "practice" | "assessment" | "hybrid";
  classIds: string[];
  teacherIds: string[];
  accessType: "class_assigned" | "tenant_wide" | "public_store";
  storyPoints: StoryPointConfig[];
}

interface StoryPointConfig {
  title: string;
  description: string;
  type: "standard" | "practice" | "quiz" | "timed_test";
  sections: { id: string; title: string; orderIndex: number }[];
  assessmentConfig?: AssessmentConfig;
  items: ItemConfig[];
}

interface ItemConfig {
  title: string;
  type: "question" | "material";
  sectionId?: string;
  difficulty?: "easy" | "medium" | "hard";
  payload: QuestionPayload | MaterialPayload;
}
```

## Points Allocation Guidelines

| Difficulty | MCQ/TF | MCAQ/Matching | Numerical/Fill | Text | Paragraph/Code |
| ---------- | ------ | ------------- | -------------- | ---- | -------------- |
| Easy       | 10     | 15            | 10             | 10   | 15             |
| Medium     | 10     | 15            | 15             | 15   | 25             |
| Hard       | 15     | 20            | 20             | 20   | 30             |
