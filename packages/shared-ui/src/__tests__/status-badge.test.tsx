import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "../components/ui/status-badge";

describe("StatusBadge", () => {
  it("renders with active status", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders status text with underscores replaced by spaces", () => {
    render(<StatusBadge status="results_released" />);
    expect(screen.getByText("results released")).toBeInTheDocument();
  });

  it("renders custom children instead of status text", () => {
    render(<StatusBadge status="active">Online</StatusBadge>);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("includes screen reader text for accessibility", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("Status:")).toHaveClass("sr-only");
  });

  it("supports custom className", () => {
    const { container } = render(<StatusBadge status="active" className="my-badge" />);
    expect(container.firstChild).toHaveClass("my-badge");
  });

  it("renders all status variants without errors", () => {
    const statuses = [
      "active",
      "inactive",
      "trial",
      "suspended",
      "expired",
      "operational",
      "degraded",
      "down",
      "draft",
      "published",
      "archived",
      "grading",
      "completed",
      "pending",
      "deleted",
    ] as const;

    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status.replace(/_/g, " "))).toBeInTheDocument();
      unmount();
    });
  });
});
