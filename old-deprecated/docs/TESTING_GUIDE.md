# Testing Guide

Quick reference for testing in the Auto LevelUp monorepo.

## Quick Start

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test --ui

# Run tests in a specific package
cd packages/shared-utils
pnpm test
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should return true when input is valid", () => {
    const result = myFunction("valid-input");
    expect(result).toBe(true);
  });

  it("should throw error when input is invalid", () => {
    expect(() => myFunction("")).toThrow("Invalid input");
  });
});
```

### Testing React Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const { user } = render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### Mocking

```typescript
import { vi, describe, it, expect } from "vitest";
import { fetchData } from "./api";

vi.mock("./api", () => ({
  fetchData: vi.fn(),
}));

describe("fetchData", () => {
  it("should call API with correct params", async () => {
    vi.mocked(fetchData).mockResolvedValue({ data: "test" });

    const result = await fetchData("param");

    expect(fetchData).toHaveBeenCalledWith("param");
    expect(result).toEqual({ data: "test" });
  });
});
```

## Test Organization

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── utils/
│   ├── formatters.ts
│   └── formatters.test.ts
└── test/
    ├── setup.ts        # Test setup file
    └── helpers/        # Test utilities
        └── render.tsx
```

## Coverage

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML coverage report
open coverage/index.html
```

### Coverage Thresholds

- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

### Excluding Files from Coverage

Add to your `vitest.config.ts`:

```typescript
coverage: {
  exclude: [
    ...baseVitestConfig.test?.coverage?.exclude || [],
    '**/my-generated-files/**',
  ],
}
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Tests should not break when refactoring

2. **Use Descriptive Names**
   - Good: `should return error when user is not authenticated`
   - Bad: `test1`

3. **Keep Tests Independent**
   - Each test should be able to run in isolation
   - Don't rely on test execution order

4. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Maximum/minimum values
   - Invalid data types

5. **Mock External Dependencies**
   - API calls
   - Database queries
   - Third-party services

6. **Keep Tests Fast**
   - Avoid real API calls
   - Minimize setup time
   - Use appropriate timeouts

## Common Patterns

### Setup and Teardown

```typescript
import { beforeEach, afterEach, describe, it } from "vitest";

describe("MyComponent", () => {
  let mockData;

  beforeEach(() => {
    mockData = { id: 1, name: "Test" };
  });

  afterEach(() => {
    // Cleanup
  });

  it("should use mock data", () => {
    // Test using mockData
  });
});
```

### Testing Async Code

```typescript
it("should handle async operations", async () => {
  const promise = fetchData();
  await expect(promise).resolves.toEqual({ data: "test" });
});

it("should handle async errors", async () => {
  const promise = fetchDataWithError();
  await expect(promise).rejects.toThrow("Error message");
});
```

### Testing Hooks

```typescript
import { renderHook } from "@testing-library/react";
import { useCounter } from "./useCounter";

it("should increment counter", () => {
  const { result } = renderHook(() => useCounter());

  expect(result.current.count).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

## Troubleshooting

### Tests Running Slowly

- Check for unnecessary `await` statements
- Reduce test timeouts
- Use `vi.useFakeTimers()` for time-dependent tests

### Flaky Tests

- Ensure tests are independent
- Check for race conditions
- Use `waitFor` for async assertions

### Import Errors

- Verify path aliases are configured in `vitest.config.ts`
- Check that modules are properly exported
- Ensure test environment matches code environment (node vs jsdom)

## Resources

- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Library Documentation](https://testing-library.com/)
- [Vitest Examples](https://github.com/vitest-dev/vitest/tree/main/examples)
