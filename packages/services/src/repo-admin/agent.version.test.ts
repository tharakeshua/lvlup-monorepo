import { describe, expect, it } from "vitest";
import { createInMemoryRepos } from "./testing/index.js";

const NOW = "2026-07-18T00:00:00.000Z";

describe("agentVersions.save", () => {
  it("creates, no-ops, and increments semantic versions atomically", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });

    const created = await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      actorUid: "teacher_1",
      data: {
        spaceId: "space_1",
        type: "interviewer",
        name: "Interview coach",
        modelPolicyId: "conversation.quality",
        isActive: true,
      },
      expectedVersion: 0,
    });
    expect(created).toMatchObject({
      id: "agent_1",
      created: true,
      semanticChanged: true,
      version: 1,
    });

    const unchanged = await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      expectedVersion: 1,
      actorUid: "teacher_2",
      data: {
        spaceId: "space_1",
        type: "interviewer",
        name: "Interview coach",
        modelPolicyId: "conversation.quality",
        isActive: true,
      },
    });
    expect(unchanged).toMatchObject({ created: false, semanticChanged: false, version: 1 });
    expect(unchanged.agent["updatedBy"]).toBe("teacher_2");

    const changed = await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      expectedVersion: 1,
      actorUid: "teacher_2",
      data: {
        modelPolicyId: "conversation.fast",
      },
    });
    expect(changed).toMatchObject({ created: false, semanticChanged: true, version: 2 });
    expect(changed.agent["modelPolicyId"]).toBe("conversation.fast");
  });

  it("rejects a stale expected version without changing the persisted agent", async () => {
    const repos = createInMemoryRepos({ now: () => NOW });
    await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      actorUid: "teacher_1",
      data: { name: "Original", type: "tutor", isActive: true },
    });
    await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      expectedVersion: 1,
      actorUid: "teacher_1",
      data: { name: "Updated" },
    });

    await expect(
      repos.agentVersions.save("tenant_a", {
        id: "agent_1",
        expectedVersion: 1,
        actorUid: "teacher_2",
        data: { name: "Stale overwrite" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT", expectedVersion: 1, currentVersion: 2 });

    const noOp = await repos.agentVersions.save("tenant_a", {
      id: "agent_1",
      expectedVersion: 2,
      actorUid: "teacher_1",
      data: { name: "Updated" },
    });
    expect(noOp.version).toBe(2);
    expect(noOp.agent["name"]).toBe("Updated");
  });
});
