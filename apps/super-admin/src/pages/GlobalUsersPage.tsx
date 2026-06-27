import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchUsers } from "@levelup/query";
import {
  PageHeader,
  Card,
  CardContent,
  Input,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  StatusBadge,
} from "@levelup/shared-ui";
import { Search, UserCircle2 } from "lucide-react";

interface UserResult {
  uid: string;
  email?: string;
  displayName?: string;
  isSuperAdmin?: boolean;
  lastLoginAt?: unknown;
  memberships: { tenantId: string; tenantCode?: string; role: string }[];
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return "--";
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    const seconds = (ts as { seconds: number }).seconds;
    return new Date(seconds * 1000).toLocaleDateString();
  }
  if (typeof ts === "string") return ts;
  return "--";
}

export default function GlobalUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedQuery = useDebounce(searchInput, 300);
  const navigate = useNavigate();

  const { data, isLoading, isFetching, isError } = useSearchUsers(debouncedQuery);

  const users = (data as { items?: UserResult[] } | undefined)?.items ?? [];
  const showSkeleton = isLoading && debouncedQuery.length >= 1;
  const showEmpty = !isLoading && !isFetching && debouncedQuery.length >= 1 && users.length === 0;
  const showInitial = debouncedQuery.length < 1;

  const handleRowClick = useCallback(
    (user: UserResult) => {
      // Navigate to the first tenant detail if user has memberships
      const firstTenant = user.memberships[0];
      if (firstTenant?.tenantId) {
        navigate(`/tenants/${firstTenant.tenantId}`);
      }
    },
    [navigate]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Search and manage users across all tenants" />

      {/* Search Input */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {showInitial && (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
              <UserCircle2 className="mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm">Type a name or email to search users</p>
            </div>
          )}

          {showSkeleton && (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="text-destructive flex flex-col items-center justify-center py-16">
              <p className="text-sm">Failed to search users. Please try again.</p>
            </div>
          )}

          {showEmpty && (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
              <UserCircle2 className="mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm">No users found for "{debouncedQuery}"</p>
            </div>
          )}

          {!showInitial && !showSkeleton && !showEmpty && !isError && users.length > 0 && (
            <Table>
              <TableCaption className="sr-only">User search results</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles / Tenants</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-center">Super Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.uid}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleRowClick(user)}
                  >
                    <TableCell className="font-medium">{user.displayName ?? "--"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email ?? "--"}</TableCell>
                    <TableCell>
                      {user.memberships.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.memberships.map((m) => (
                            <span
                              key={`${m.tenantId}-${m.role}`}
                              className="text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                            >
                              {m.role}
                              {m.tenantCode ? ` @ ${m.tenantCode}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No memberships</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {formatTimestamp(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isSuperAdmin ? (
                        <StatusBadge status="active" label="Yes" />
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Result count */}
      {!showInitial && !showSkeleton && users.length > 0 && (
        <p className="text-muted-foreground text-center text-xs">
          Showing {users.length} result{users.length !== 1 ? "s" : ""}
          {isFetching ? " (updating...)" : ""}
        </p>
      )}
    </div>
  );
}
