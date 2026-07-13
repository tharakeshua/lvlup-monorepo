import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreCard } from "../components/charts/ScoreCard";
import { AtRiskBadge } from "../components/charts/AtRiskBadge";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  TrendingUp: (props: any) => <span data-testid="trending-up" {...props} />,
  TrendingDown: (props: any) => <span data-testid="trending-down" {...props} />,
  Minus: (props: any) => <span data-testid="minus" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="alert-triangle" {...props} />,
  CheckCircle2: (props: any) => <span data-testid="check-circle" {...props} />,
}));

describe("ScoreCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label and value", () => {
    render(<ScoreCard label="Total Students" value={120} />);
    expect(screen.getByText("Total Students")).toBeDefined();
    expect(screen.getByText("120")).toBeDefined();
  });

  it("renders suffix when provided", () => {
    render(<ScoreCard label="Avg Score" value={85} suffix="%" />);
    expect(screen.getByText("%")).toBeDefined();
  });

  it("renders trend up indicator", () => {
    render(<ScoreCard label="Score" value={90} trend="up" trendValue="+5%" />);
    expect(screen.getByTestId("trending-up")).toBeDefined();
    expect(screen.getByText("+5%")).toBeDefined();
  });

  it("renders trend down indicator", () => {
    render(<ScoreCard label="Score" value={70} trend="down" trendValue="-3%" />);
    expect(screen.getByTestId("trending-down")).toBeDefined();
    expect(screen.getByText("-3%")).toBeDefined();
  });

  it("renders neutral trend", () => {
    render(<ScoreCard label="Score" value={80} trend="neutral" trendValue="0%" />);
    expect(screen.getByTestId("minus")).toBeDefined();
  });

  it("renders icon when provided", () => {
    const MockIcon = (props: any) => <span data-testid="custom-icon" {...props} />;
    render(<ScoreCard label="Users" value={50} icon={MockIcon} />);
    expect(screen.getByTestId("custom-icon")).toBeDefined();
  });

  it("does not render trend when not provided", () => {
    render(<ScoreCard label="Count" value={10} />);
    expect(screen.queryByTestId("trending-up")).toBeNull();
  });

  it("applies custom className", () => {
    const { container } = render(<ScoreCard label="X" value={1} className="custom-class" />);
    expect(container.firstElementChild?.classList.contains("custom-class")).toBe(true);
  });
});

describe("AtRiskBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "On Track" when not at risk', () => {
    render(<AtRiskBadge isAtRisk={false} />);
    expect(screen.getByText("On Track")).toBeDefined();
    expect(screen.getByTestId("check-circle")).toBeDefined();
  });

  it('renders "At Risk" when at risk', () => {
    render(<AtRiskBadge isAtRisk={true} />);
    expect(screen.getByText("At Risk")).toBeDefined();
    expect(screen.getByTestId("alert-triangle")).toBeDefined();
  });

  it('has role="status" for accessibility', () => {
    render(<AtRiskBadge isAtRisk={false} />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("shows reasons in title when at risk", () => {
    render(<AtRiskBadge isAtRisk={true} reasons={["Low score", "Missing exams"]} />);
    const badge = screen.getByRole("status");
    expect(badge.getAttribute("title")).toBe("Low score, Missing exams");
  });

  it("applies custom className", () => {
    const { container } = render(<AtRiskBadge isAtRisk={false} className="my-class" />);
    const badge = container.querySelector('[role="status"]');
    expect(badge?.classList.contains("my-class")).toBe(true);
  });
});
