import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../ui/useDebounce";
import { useLocalStorage } from "../ui/useLocalStorage";
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersDarkMode,
} from "../ui/useMediaQuery";
import { useClickOutside } from "../ui/useClickOutside";
import { createRef } from "react";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));

    expect(result.current).toBe("hello");
  });

  it("should debounce value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 500 } }
    );

    rerender({ value: "world", delay: 500 });

    // Should still be old value before timeout
    expect(result.current).toBe("hello");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("world");
  });

  it("should reset timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: "c" });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: "d" });

    // None of the intermediate values should have been set
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe("d");
  });

  it("should use default delay of 500ms", () => {
    const { result, rerender } = renderHook(({ value }: { value: string }) => useDebounce(value), {
      initialProps: { value: "init" },
    });

    rerender({ value: "updated" });

    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe("init");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("updated");
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it("should return initial value when no stored value", () => {
    const { result } = renderHook(() => useLocalStorage("key", "default"));

    expect(result.current[0]).toBe("default");
  });

  it("should read stored value from localStorage", () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('"stored"');

    const { result } = renderHook(() => useLocalStorage("key", "default"));

    expect(result.current[0]).toBe("stored");
  });

  it("should update stored value", () => {
    const { result } = renderHook(() => useLocalStorage("key", "default"));

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(window.localStorage.setItem).toHaveBeenCalledWith("key", '"new-value"');
  });

  it("should support functional updates", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it("should remove value from localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("key", "default"));

    act(() => {
      result.current[1]("something");
    });

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe("default");
    expect(window.localStorage.removeItem).toHaveBeenCalledWith("key");
  });

  it("should handle JSON parse errors gracefully", () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue("invalid-json");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage("key", "fallback"));

    expect(result.current[0]).toBe("fallback");
    consoleSpy.mockRestore();
  });
});

describe("useMediaQuery", () => {
  let changeHandler: ((event: { matches: boolean }) => void) | null = null;

  beforeEach(() => {
    changeHandler = null;
    vi.mocked(window.matchMedia).mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: unknown) => {
        changeHandler = handler as (event: { matches: boolean }) => void;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("should return false initially when no match", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(false);
  });

  it("should return true when media query matches", () => {
    vi.mocked(window.matchMedia).mockImplementation((q: string) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(true);
  });

  it("should update when media query changes", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(false);

    act(() => {
      changeHandler?.({ matches: true });
    });

    expect(result.current).toBe(true);
  });
});

describe("useIsMobile", () => {
  it("should use 767px max-width by default", () => {
    renderHook(() => useIsMobile());

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("should accept custom breakpoint", () => {
    renderHook(() => useIsMobile(640));

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 639px)");
  });
});

describe("useIsTablet", () => {
  it("should use correct range by default", () => {
    renderHook(() => useIsTablet());

    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 768px) and (max-width: 1023px)");
  });
});

describe("useIsDesktop", () => {
  it("should use 1024px min-width by default", () => {
    renderHook(() => useIsDesktop());

    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
  });
});

describe("usePrefersDarkMode", () => {
  it("should query prefers-color-scheme: dark", () => {
    renderHook(() => usePrefersDarkMode());

    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });
});

describe("useClickOutside", () => {
  it("should call handler when clicking outside element", () => {
    const handler = vi.fn();
    const ref = createRef<HTMLDivElement>();

    // Create a real element to attach to the ref
    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    renderHook(() => useClickOutside(ref, handler));

    // Simulate click outside
    const outsideEvent = new MouseEvent("mousedown", { bubbles: true });
    act(() => {
      document.dispatchEvent(outsideEvent);
    });

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it("should NOT call handler when clicking inside element", () => {
    const handler = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const div = document.createElement("div");
    const child = document.createElement("span");
    div.appendChild(child);
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    renderHook(() => useClickOutside(ref, handler));

    // Simulate click inside
    const insideEvent = new MouseEvent("mousedown", { bubbles: true });
    act(() => {
      child.dispatchEvent(insideEvent);
    });

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("should not attach listeners when disabled", () => {
    const handler = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    renderHook(() => useClickOutside(ref, handler, false));

    const event = new MouseEvent("mousedown", { bubbles: true });
    act(() => {
      document.dispatchEvent(event);
    });

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});
