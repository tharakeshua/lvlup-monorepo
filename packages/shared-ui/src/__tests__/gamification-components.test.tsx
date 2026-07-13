import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LevelBadge } from "../components/gamification/LevelBadge";
import { StreakWidget } from "../components/gamification/StreakWidget";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Flame: (props: any) => <span data-testid="flame-icon" {...props} />,
}));

// Mock shared-types
vi.mock("@levelup/shared-types", () => ({}));

describe("LevelBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders level number", () => {
    render(<LevelBadge level={5} currentXP={200} xpToNextLevel={500} tier="bronze" />);
    expect(screen.getByText("Lv. 5")).toBeDefined();
  });

  it("renders XP progress", () => {
    render(<LevelBadge level={3} currentXP={150} xpToNextLevel={300} tier="silver" />);
    expect(screen.getByText("150 / 300 XP")).toBeDefined();
  });

  it("renders tier name", () => {
    render(<LevelBadge level={1} currentXP={0} xpToNextLevel={100} tier="gold" />);
    expect(screen.getByText("gold")).toBeDefined();
  });

  it("has accessible progressbar", () => {
    render(<LevelBadge level={2} currentXP={50} xpToNextLevel={100} tier="bronze" />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("50");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("caps progress at 100%", () => {
    render(<LevelBadge level={10} currentXP={200} xpToNextLevel={100} tier="diamond" />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("handles zero xpToNextLevel", () => {
    render(<LevelBadge level={1} currentXP={0} xpToNextLevel={0} tier="bronze" />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("applies custom className", () => {
    const { container } = render(
      <LevelBadge
        level={1}
        currentXP={0}
        xpToNextLevel={100}
        tier="bronze"
        className="test-class"
      />
    );
    expect(container.firstElementChild?.classList.contains("test-class")).toBe(true);
  });
});

describe("StreakWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current streak count", () => {
    render(<StreakWidget currentStreak={5} />);
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("day streak")).toBeDefined();
  });

  it('shows "Best" when longestStreak > currentStreak', () => {
    render(<StreakWidget currentStreak={5} longestStreak={10} />);
    expect(screen.getByText("Best: 10 days")).toBeDefined();
  });

  it('hides "Best" when longestStreak <= currentStreak', () => {
    render(<StreakWidget currentStreak={10} longestStreak={10} />);
    expect(screen.queryByText(/Best:/)).toBeNull();
  });

  it('hides "Best" when longestStreak is undefined', () => {
    render(<StreakWidget currentStreak={5} />);
    expect(screen.queryByText(/Best:/)).toBeNull();
  });

  it('has role="status" for accessibility', () => {
    render(<StreakWidget currentStreak={3} />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("has aria-label with streak info", () => {
    render(<StreakWidget currentStreak={7} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toContain("7 day streak");
    expect(status.getAttribute("aria-label")).toContain("hot");
  });

  it('indicates "on fire" for streaks >= 30', () => {
    render(<StreakWidget currentStreak={30} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toContain("on fire");
  });

  it("applies custom className", () => {
    const { container } = render(<StreakWidget currentStreak={1} className="custom" />);
    const wrapper = container.querySelector('[role="status"]');
    expect(wrapper?.classList.contains("custom")).toBe(true);
  });
});
