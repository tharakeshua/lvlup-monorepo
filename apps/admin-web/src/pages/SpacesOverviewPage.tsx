import { useState } from "react";
import { useSpaces } from "@levelup/query";
import type { Space } from "@levelup/shared-types";
import {
  Input,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@levelup/shared-ui";
import { Search } from "lucide-react";
import { CardGridSkeleton } from "../components/skeletons/CardGridSkeleton";
import { STATUS_VARIANT, TYPE_VARIANT } from "../lib/constants";

export default function SpacesOverviewPage() {
  const spacesQuery = useSpaces({});
  const spaces = (spacesQuery.data ?? []) as Space[];
  const { isLoading, isError, refetch } = spacesQuery;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statuses = ["all", "draft", "published", "archived"];

  const filtered = spaces?.filter((space) => {
    if (statusFilter !== "all" && space.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return space.title.toLowerCase().includes(q) || space.subject?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Spaces Overview</h1>
        <p className="text-muted-foreground text-sm">All learning spaces across teachers</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "secondary"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="border-destructive/50 rounded-lg border p-12 text-center">
          <h3 className="text-lg font-semibold">Failed to load spaces</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Something went wrong while loading spaces.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : !filtered?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold">No spaces found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Teachers can create spaces from the Teacher Portal
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((space) => (
            <Card key={space.id} className="transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{space.title}</CardTitle>
                  <Badge
                    variant={STATUS_VARIANT[space.status] ?? "secondary"}
                    className="capitalize"
                  >
                    {space.status}
                  </Badge>
                </div>
                {space.description && (
                  <CardDescription className="line-clamp-2">{space.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={TYPE_VARIANT[space.type] ?? "outline"} className="capitalize">
                    {space.type}
                  </Badge>
                  {space.subject && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {space.subject}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground mt-3 flex gap-4 text-xs">
                  <span>{space.classIds?.length ?? 0} classes</span>
                  <span>{space.teacherIds?.length ?? 0} teachers</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
