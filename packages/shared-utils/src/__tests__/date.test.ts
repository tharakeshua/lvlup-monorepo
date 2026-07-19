import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDate,
  getRelativeTime,
  isToday,
  isPast,
  addDays,
  startOfDay,
  endOfDay,
} from "../date";

describe("date utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // formatDate
  // ---------------------------------------------------------------------------
  describe("formatDate", () => {
    it("formats a Date object with default options", () => {
      const date = new Date("2024-06-15T00:00:00");
      const result = formatDate(date);
      expect(result).toContain("June");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });

    it("accepts a string date", () => {
      const result = formatDate("2024-01-01");
      expect(result).toContain("2024");
    });

    it("accepts a timestamp number", () => {
      const ts = new Date("2024-03-10").getTime();
      const result = formatDate(ts);
      expect(result).toContain("2024");
    });

    it("respects custom options", () => {
      const result = formatDate(new Date("2024-06-15"), { month: "short" });
      expect(result).toContain("Jun");
    });
  });

  // ---------------------------------------------------------------------------
  // getRelativeTime
  // ---------------------------------------------------------------------------
  describe("getRelativeTime", () => {
    it('returns "just now" for very recent dates', () => {
      const now = new Date();
      expect(getRelativeTime(now)).toBe("just now");
    });

    it("returns minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(getRelativeTime(fiveMinAgo)).toBe("5 minutes ago");
    });

    it("returns hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      expect(getRelativeTime(twoHoursAgo)).toBe("2 hours ago");
    });

    it("returns days ago", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
      expect(getRelativeTime(threeDaysAgo)).toBe("3 days ago");
    });
  });

  // ---------------------------------------------------------------------------
  // isToday
  // ---------------------------------------------------------------------------
  describe("isToday", () => {
    it("returns true for today", () => {
      expect(isToday(new Date())).toBe(true);
    });

    it("returns false for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isPast
  // ---------------------------------------------------------------------------
  describe("isPast", () => {
    it("returns true for a past date", () => {
      expect(isPast(new Date("2020-01-01"))).toBe(true);
    });

    it("returns false for a future date", () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(isPast(future)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // addDays
  // ---------------------------------------------------------------------------
  describe("addDays", () => {
    it("adds positive days", () => {
      const date = new Date("2024-01-01");
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });

    it("subtracts days with negative value", () => {
      const date = new Date("2024-01-10");
      const result = addDays(date, -3);
      expect(result.getDate()).toBe(7);
    });

    it("does not mutate original date", () => {
      const date = new Date("2024-01-01");
      addDays(date, 5);
      expect(date.getDate()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // startOfDay / endOfDay
  // ---------------------------------------------------------------------------
  describe("startOfDay", () => {
    it("sets time to midnight", () => {
      const date = new Date("2024-06-15T14:30:00");
      const result = startOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it("does not mutate original date", () => {
      const date = new Date("2024-06-15T14:30:00");
      startOfDay(date);
      expect(date.getHours()).toBe(14);
    });
  });

  describe("endOfDay", () => {
    it("sets time to 23:59:59.999", () => {
      const date = new Date("2024-06-15T14:30:00");
      const result = endOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });
});
