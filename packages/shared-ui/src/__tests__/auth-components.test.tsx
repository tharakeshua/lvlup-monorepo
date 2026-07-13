import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CredentialsStep } from "../components/auth/CredentialsStep";
import { DirectLoginForm } from "../components/auth/DirectLoginForm";
import { SchoolCodeStep } from "../components/auth/SchoolCodeStep";
import { LogoutButton } from "../components/auth/LogoutButton";

describe("Auth Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── CredentialsStep ─────────────────────────────────────────────────

  describe("CredentialsStep", () => {
    const defaultProps = {
      schoolName: "Test School",
      onBack: vi.fn(),
      onSubmit: vi.fn().mockResolvedValue(undefined),
    };

    it("renders email/credential input", () => {
      render(<CredentialsStep {...defaultProps} />);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<CredentialsStep {...defaultProps} />);

      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("calls onSubmit with credential and password", async () => {
      render(<CredentialsStep {...defaultProps} />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith("test@test.com", "secret123");
      });
    });

    it("shows error when onSubmit throws", async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
      render(<CredentialsStep {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "bad@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "wrong" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("toggles password visibility", () => {
      render(<CredentialsStep {...defaultProps} />);

      const passwordInput = screen.getByLabelText("Password");
      expect(passwordInput).toHaveAttribute("type", "password");

      fireEvent.click(screen.getByText("Show"));
      expect(passwordInput).toHaveAttribute("type", "text");

      fireEvent.click(screen.getByText("Hide"));
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("displays school name", () => {
      render(<CredentialsStep {...defaultProps} />);

      expect(screen.getByText("Test School")).toBeInTheDocument();
    });
  });

  // ── DirectLoginForm ─────────────────────────────────────────────────

  describe("DirectLoginForm", () => {
    const defaultProps = {
      title: "Admin Login",
      subtitle: "Enter your credentials",
      login: vi.fn().mockResolvedValue(undefined),
    };

    it("renders title", () => {
      render(<DirectLoginForm {...defaultProps} />);

      expect(screen.getByText("Admin Login")).toBeInTheDocument();
    });

    it("renders email and password inputs", () => {
      render(<DirectLoginForm {...defaultProps} />);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("calls login with email and password on submit", async () => {
      render(<DirectLoginForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "admin@levelup.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(defaultProps.login).toHaveBeenCalledWith("admin@levelup.com", "password123");
      });
    });

    it("shows error state when login fails", async () => {
      const login = vi.fn().mockRejectedValue(new Error("Wrong password"));
      render(<DirectLoginForm {...defaultProps} login={login} />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "admin@test.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "wrong" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(() => {
        expect(screen.getByText("Wrong password")).toBeInTheDocument();
      });
    });
  });

  // ── SchoolCodeStep ──────────────────────────────────────────────────

  describe("SchoolCodeStep", () => {
    const defaultProps = {
      onSchoolResolved: vi.fn(),
      lookupTenantByCode: vi.fn().mockResolvedValue({
        id: "tenant-1",
        name: "Test School",
        status: "active",
        code: "TST001",
      }),
    };

    it("renders school code input", () => {
      render(<SchoolCodeStep {...defaultProps} />);

      expect(screen.getByLabelText("School Code")).toBeInTheDocument();
    });

    it("calls lookupTenantByCode and resolves school on valid code", async () => {
      render(<SchoolCodeStep {...defaultProps} />);

      fireEvent.change(screen.getByLabelText("School Code"), {
        target: { value: "TST001" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(defaultProps.lookupTenantByCode).toHaveBeenCalledWith("TST001");
        expect(defaultProps.onSchoolResolved).toHaveBeenCalledWith({
          id: "tenant-1",
          name: "Test School",
          code: "TST001",
        });
      });
    });

    it("shows error for invalid school code", async () => {
      const lookupTenantByCode = vi.fn().mockResolvedValue(null);
      render(<SchoolCodeStep {...defaultProps} lookupTenantByCode={lookupTenantByCode} />);

      fireEvent.change(screen.getByLabelText("School Code"), {
        target: { value: "INVALID" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid school code. Please try again.")).toBeInTheDocument();
      });
    });
  });

  // ── LogoutButton ────────────────────────────────────────────────────

  describe("LogoutButton", () => {
    const defaultProps = {
      onLogout: vi.fn().mockResolvedValue(undefined),
    };

    it("renders the button with default text", () => {
      render(<LogoutButton {...defaultProps} />);

      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("shows confirmation dialog on click", async () => {
      render(<LogoutButton {...defaultProps} />);

      fireEvent.click(screen.getByText("Sign Out"));

      await waitFor(() => {
        expect(screen.getByText("Sign out?")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Are you sure you want to sign out? You'll need to sign in again to access your account."
          )
        ).toBeInTheDocument();
      });
    });

    it("calls onLogout when confirmed", async () => {
      render(<LogoutButton {...defaultProps} />);

      // Open dialog
      fireEvent.click(screen.getByText("Sign Out"));

      await waitFor(() => {
        expect(screen.getByText("Sign out?")).toBeInTheDocument();
      });

      // Confirm logout - click the "Sign Out" button inside the dialog (AlertDialogAction)
      const signOutButtons = screen.getAllByText("Sign Out");
      // The second "Sign Out" is the confirmation action button
      const confirmButton = signOutButtons[signOutButtons.length - 1];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onLogout).toHaveBeenCalled();
      });
    });
  });
});
