import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../components/ui/badge";

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Default")).toHaveClass("bg-primary");
  });

  it("renders with secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");
  });

  it("renders with destructive variant", () => {
    render(<Badge variant="destructive">Destructive</Badge>);
    expect(screen.getByText("Destructive")).toHaveClass("bg-destructive");
  });

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toHaveClass("text-foreground");
  });

  it("supports custom className", () => {
    render(<Badge className="my-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("my-class");
  });

  it("renders children content", () => {
    render(
      <Badge>
        <span>Inner content</span>
      </Badge>
    );
    expect(screen.getByText("Inner content")).toBeInTheDocument();
  });
});
