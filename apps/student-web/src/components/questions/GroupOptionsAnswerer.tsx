import type { GroupOptionsData } from "@levelup/shared-types";

interface GroupOptionsAnswererProps {
  data: GroupOptionsData;
  value?: Record<string, string[]>;
  onChange: (value: Record<string, string[]>) => void;
  disabled?: boolean;
}

export default function GroupOptionsAnswerer({
  data,
  value = {},
  onChange,
  disabled,
}: GroupOptionsAnswererProps) {
  // Find which group each item is assigned to
  const itemToGroup = new Map<string, string>();
  for (const [groupId, itemIds] of Object.entries(value)) {
    for (const itemId of itemIds) {
      itemToGroup.set(itemId, groupId);
    }
  }

  const unassigned = data.items.filter((item) => !itemToGroup.has(item.id));

  const assignItem = (itemId: string, groupId: string) => {
    const next = { ...value };
    // Remove from current group
    for (const [gId, items] of Object.entries(next)) {
      next[gId] = items.filter((id) => id !== itemId);
    }
    // Add to new group
    if (!next[groupId]) next[groupId] = [];
    next[groupId].push(itemId);
    onChange(next);
  };

  const removeFromGroup = (itemId: string) => {
    const next = { ...value };
    for (const [gId, items] of Object.entries(next)) {
      next[gId] = items.filter((id) => id !== itemId);
    }
    onChange(next);
  };

  const itemMap = new Map(data.items.map((item) => [item.id, item]));

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Drag items into the correct group, or use the dropdown to assign.
      </p>

      {/* Unassigned items */}
      {unassigned.length > 0 && (
        <div className="border-input rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Unassigned Items</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((item) => (
              <div
                key={item.id}
                className="bg-muted flex items-center gap-1 rounded-full px-3 py-1"
              >
                <span className="text-sm">{item.text}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) assignItem(item.id, e.target.value);
                  }}
                  disabled={disabled}
                  value=""
                  className="border-none bg-transparent text-xs focus:outline-none"
                >
                  <option value="">→</option>
                  {data.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      <div className="grid gap-3 md:grid-cols-2">
        {data.groups.map((group) => {
          const groupItems = (value[group.id] ?? []).map((id) => itemMap.get(id)).filter(Boolean);

          return (
            <div key={group.id} className="bg-muted/50 rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">{group.name}</p>
              <div className="min-h-[2rem] space-y-1">
                {groupItems.map((item) => (
                  <div
                    key={item!.id}
                    className="bg-background flex items-center justify-between rounded border px-2 py-1 text-sm"
                  >
                    <span>{item!.text}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeFromGroup(item!.id)}
                        className="text-destructive hover:text-destructive text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {groupItems.length === 0 && (
                  <p className="text-muted-foreground text-xs italic">No items assigned</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
