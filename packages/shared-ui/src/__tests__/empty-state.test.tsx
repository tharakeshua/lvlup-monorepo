import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Search } from "lucide-react";
import { EmptyState } from "../components/ui/empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters" />);
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={Search} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Add Item", onClick }} />);
    const button = screen.getByRole("button", { name: "Add Item" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has role="status" for accessibility', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("supports custom className", () => {
    render(<EmptyState title="Empty" className="custom-empty" />);
    expect(screen.getByRole("status")).toHaveClass("custom-empty");
  });
});
