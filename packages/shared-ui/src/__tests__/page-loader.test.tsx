import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageLoader } from "../components/ui/PageLoader";

describe("PageLoader", () => {
  it("renders a loading spinner", () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("is centered with min height", () => {
    const { container } = render(<PageLoader />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex", "items-center", "justify-center");
    expect(wrapper).toHaveClass("min-h-[50vh]");
  });
});
