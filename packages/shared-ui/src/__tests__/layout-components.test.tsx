import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock shared-hooks
vi.mock("@levelup/shared-hooks", () => ({
  useOnlineStatus: vi.fn(() => ({ isOnline: true })),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  WifiOff: (props: any) => <span data-testid="wifi-off" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Bell: (props: any) => <span data-testid="bell-icon" {...props} />,
}));

// Mock Popover components
vi.mock("../components/ui/popover", () => ({
  Popover: ({ children, ...props }: any) => (
    <div data-testid="popover" {...props}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock("../components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("../components/layout/NotificationDropdown", () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));

import { OfflineBanner } from "../components/layout/OfflineBanner";
import { NotificationBell } from "../components/layout/NotificationBell";
import { useOnlineStatus } from "@levelup/shared-hooks";

const mockUseOnlineStatus = vi.mocked(useOnlineStatus);

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true } as any);
  });

  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.childElementCount).toBe(0);
  });

  it("renders banner when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false } as any);
    render(<OfflineBanner />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/You're offline/)).toBeDefined();
  });

  it('has role="alert" for accessibility', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false } as any);
    render(<OfflineBanner />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("can be dismissed", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false } as any);
    render(<OfflineBanner />);
    const dismissBtn = screen.getByLabelText("Dismiss offline notification");
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("applies custom className", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false } as any);
    render(<OfflineBanner className="my-class" />);
    const alert = screen.getByRole("alert");
    expect(alert.classList.contains("my-class")).toBe(true);
  });
});

describe("NotificationBell", () => {
  const defaultProps = {
    notifications: [],
    unreadCount: 0,
    onNotificationClick: vi.fn(),
    onMarkAllRead: vi.fn(),
    onViewAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell icon", () => {
    render(<NotificationBell {...defaultProps} />);
    expect(screen.getByTestId("bell-icon")).toBeDefined();
  });

  it("shows unread count badge when > 0", () => {
    render(<NotificationBell {...defaultProps} unreadCount={5} />);
    expect(screen.getByText("5")).toBeDefined();
  });

  it("shows 99+ for large unread counts", () => {
    render(<NotificationBell {...defaultProps} unreadCount={150} />);
    expect(screen.getByText("99+")).toBeDefined();
  });

  it("hides badge when unread count is 0", () => {
    render(<NotificationBell {...defaultProps} unreadCount={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("has accessible label with unread count", () => {
    render(<NotificationBell {...defaultProps} unreadCount={3} />);
    expect(screen.getByText("Notifications, 3 unread")).toBeDefined();
  });

  it("has aria-live region for unread count", () => {
    render(<NotificationBell {...defaultProps} unreadCount={2} />);
    expect(screen.getByText("2 unread notifications")).toBeDefined();
  });
});
