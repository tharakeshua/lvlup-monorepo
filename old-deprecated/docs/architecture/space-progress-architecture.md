# Space Progress Architecture — Complete Reference

> Auto-LevelUp EdTech Platform — Progress Data Model & Flow

---

## 1. Firestore Data Model (Entity-Relationship)

```mermaid
erDiagram
    TENANT ||--o{ SPACE : "has many"
    SPACE ||--o{ STORY_POINT : "contains"
    STORY_POINT ||--o{ UNIFIED_ITEM : "contains"
    STORY_POINT ||--o{ SECTION : "has embedded"
    UNIFIED_ITEM ||--o| ANSWER_KEY : "has (server-only)"
    TENANT ||--o{ SPACE_PROGRESS : "tracks"
    TENANT ||--o{ DIGITAL_TEST_SESSION : "tracks"

    TENANT {
        string id PK
        string code
        string name
    }

    SPACE {
        string id PK "Collection: tenants/{tid}/spaces/{sid}"
        string tenantId FK
        string title
        string description
        SpaceType type "learning|practice|assessment|resource|hybrid"
        SpaceStatus status "draft|published|archived"
        SpaceAccessType accessType "class_assigned|tenant_wide|public_store"
        string[] classIds
        string[] teacherIds
        string defaultEvaluatorAgentId "AI evaluator config"
        string defaultTutorAgentId "AI tutor config"
        SpaceStats stats "totalStoryPoints, totalItems, totalStudents"
        Timestamp createdAt
        Timestamp updatedAt
    }

    STORY_POINT {
        string id PK "Collection: tenants/{tid}/spaces/{sid}/storyPoints/{spid}"
        string spaceId FK
        string tenantId FK
        string title
        int orderIndex
        StoryPointType type "standard|timed_test|quiz|practice|test"
        Section[] sections "embedded array"
        AssessmentConfig assessmentConfig "duration, maxAttempts, shuffle, etc."
        StoryPointStats stats "totalItems, totalQuestions, totalMaterials, totalPoints"
        Timestamp createdAt
    }

    SECTION {
        string id PK "Embedded in StoryPoint.sections[]"
        string title
        int orderIndex
        string description
    }

    UNIFIED_ITEM {
        string id PK "Collection: tenants/{tid}/spaces/{sid}/storyPoints/{spid}/items/{iid}"
        string spaceId FK
        string storyPointId FK
        string sectionId FK "nullable — links to Section.id"
        string tenantId FK
        ItemType type "question|material|interactive|assessment|discussion|project|checkpoint"
        ItemPayload payload "QuestionPayload OR MaterialPayload OR ..."
        string difficulty "easy|medium|hard"
        string[] topics
        int orderIndex
        ItemMetadata meta "totalPoints, maxMarks"
        UnifiedRubric rubric "item-level override"
        ItemAttachment[] attachments "images, PDFs, audio"
        Timestamp createdAt
    }

    ANSWER_KEY {
        string id PK "Collection: .../items/{iid}/answerKeys/{akid}"
        string answerData "Server-only, never sent to client"
    }

    SPACE_PROGRESS {
        string id PK "Collection: tenants/{tid}/spaceProgress/{uid}_{sid}"
        string userId FK
        string tenantId FK
        string spaceId FK
        ProgressStatus status "not_started|in_progress|completed"
        float pointsEarned "aggregate best scores"
        float totalPoints "aggregate max scores"
        float marksEarned "optional marks"
        float totalMarks "optional marks"
        float percentage "0-100"
        Record_StoryPointProgress storyPoints "map[storyPointId] → StoryPointProgress"
        Record_ItemProgressEntry items "map[itemId] → ItemProgressEntry"
        Timestamp startedAt
        Timestamp completedAt
        Timestamp updatedAt
    }

    DIGITAL_TEST_SESSION {
        string id PK "Collection: tenants/{tid}/digitalTestSessions/{sessId}"
        string tenantId FK
        string userId FK
        string spaceId FK
        string storyPointId FK
        TestSessionType sessionType "timed_test|quiz|practice"
        TestSessionStatus status "in_progress|completed|expired|abandoned"
        int attemptNumber
        int totalQuestions
        string[] questionOrder
        Record_TestSubmission submissions "map[itemId] → TestSubmission"
        float pointsEarned
        float totalPoints
        float percentage
        TestAnalytics analytics
        Timestamp serverDeadline
        Timestamp startedAt
        Timestamp submittedAt
    }
```

---

## 2. Progress Data Structures (Type Hierarchy)

```mermaid
classDiagram
    class SpaceProgress {
        +string id "userId_spaceId"
        +string userId
        +string tenantId
        +string spaceId
        +ProgressStatus status
        +number pointsEarned
        +number totalPoints
        +number percentage
        +Record~string,StoryPointProgress~ storyPoints
        +Record~string,ItemProgressEntry~ items
        +Timestamp startedAt
        +Timestamp completedAt
        +Timestamp updatedAt
    }

    class StoryPointProgress {
        +string storyPointId
        +ProgressStatus status
        +number pointsEarned
        +number totalPoints
        +number percentage
        +number completedAt
    }

    class ItemProgressEntry {
        +string itemId
        +ItemType itemType
        +boolean completed
        +number completedAt
        +number timeSpent
        +number interactions
        +number lastUpdatedAt
        +QuestionProgressData questionData
        +number progress
        +number score
        +string feedback
    }

    class QuestionProgressData {
        +QuestionProgressStatus status
        +number attemptsCount
        +number bestScore
        +number pointsEarned
        +number totalPoints
        +number percentage
        +boolean solved
    }

    class StoredItemProgressEntry {
        +string storyPointId
    }

    class ProgressStatus {
        <<enumeration>>
        not_started
        in_progress
        completed
    }

    class QuestionProgressStatus {
        <<enumeration>>
        pending
        correct
        incorrect
        partial
    }

    SpaceProgress *-- "0..*" StoryPointProgress : storyPoints map
    SpaceProgress *-- "0..*" ItemProgressEntry : items map
    ItemProgressEntry *-- "0..1" QuestionProgressData : questionData
    StoredItemProgressEntry --|> ItemProgressEntry : extends
    SpaceProgress ..> ProgressStatus : status
    StoryPointProgress ..> ProgressStatus : status
    QuestionProgressData ..> QuestionProgressStatus : status
```

---

## 3. Content Hierarchy (Space → StoryPoint → Item)

```mermaid
graph TB
    subgraph "Content Hierarchy"
        T[("Tenant<br/>tenants/{tid}")]
        S1["Space<br/>type: learning<br/>status: published<br/>stats.totalStoryPoints: 4"]
        S2["Space<br/>type: assessment"]

        SP1["StoryPoint<br/>type: standard<br/>sections: [A, B]<br/>stats.totalItems: 6"]
        SP2["StoryPoint<br/>type: timed_test<br/>assessmentConfig.duration: 30<br/>stats.totalItems: 10"]
        SP3["StoryPoint<br/>type: practice<br/>stats.totalItems: 5"]

        SEC_A["Section A<br/>orderIndex: 0"]
        SEC_B["Section B<br/>orderIndex: 1"]

        subgraph "Items in SP1 (standard)"
            I1["Material (text)<br/>sectionId: A<br/>orderIndex: 0"]
            I2["Question (mcq)<br/>sectionId: A<br/>orderIndex: 1<br/>basePoints: 2"]
            I3["Question (paragraph)<br/>sectionId: B<br/>orderIndex: 0<br/>basePoints: 5"]
            I4["Material (video)<br/>sectionId: B<br/>orderIndex: 1"]
        end

        subgraph "Items in SP2 (test)"
            I5["Question (mcq)"]
            I6["Question (code)"]
            I7["Question (fill-blanks)"]
            AK5["AnswerKey<br/>(server-only)"]
            AK6["AnswerKey<br/>(server-only)"]
            AK7["AnswerKey<br/>(server-only)"]
        end

        T --> S1
        T --> S2
        S1 --> SP1
        S1 --> SP2
        S1 --> SP3
        SP1 --> SEC_A
        SP1 --> SEC_B
        SEC_A -.-> I1
        SEC_A -.-> I2
        SEC_B -.-> I3
        SEC_B -.-> I4
        SP2 --> I5
        SP2 --> I6
        SP2 --> I7
        I5 --> AK5
        I6 --> AK6
        I7 --> AK7
    end

    subgraph "Item Type Breakdown"
        direction LR
        QT["15 Question Types"]
        MT["7 Material Types"]
        QT_AUTO["Auto-Evaluatable (9):<br/>mcq, mcaq, true-false,<br/>numerical, fill-blanks,<br/>fill-blanks-dd, matching,<br/>jumbled, group-options"]
        QT_AI["AI-Evaluatable (6):<br/>text, paragraph, code,<br/>audio, image_evaluation,<br/>chat_agent_question"]
        MT_LIST["text, video, pdf,<br/>link, interactive,<br/>story, rich"]
        QT --> QT_AUTO
        QT --> QT_AI
        MT --> MT_LIST
    end

    style T fill:#f0f9ff,stroke:#0369a1,stroke-width:2px
    style S1 fill:#ecfdf5,stroke:#059669,stroke-width:2px
    style S2 fill:#ecfdf5,stroke:#059669,stroke-width:2px
    style SP1 fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style SP2 fill:#fce7f3,stroke:#db2777,stroke-width:2px
    style SP3 fill:#ede9fe,stroke:#7c3aed,stroke-width:2px
    style AK5 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style AK6 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style AK7 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
```

---

## 4. Firestore Document Structure (Actual Paths)

```mermaid
graph LR
    subgraph "Firestore Collections"
        direction TB

        subgraph "Content (Read-Only for Students)"
            P1["tenants/{tid}/spaces/{sid}"]
            P2["tenants/{tid}/spaces/{sid}/storyPoints/{spid}"]
            P3["tenants/{tid}/spaces/{sid}/storyPoints/{spid}/items/{iid}"]
            P3F["tenants/{tid}/spaces/{sid}/items/{iid}<br/>(legacy flat path — fallback)"]
            P4["tenants/{tid}/spaces/{sid}/storyPoints/{spid}/items/{iid}/answerKeys/{akid}<br/>(server-only, never read by client)"]
        end

        subgraph "Progress (Read/Write per Student)"
            P5["tenants/{tid}/spaceProgress/{uid}_{sid}<br/>ONE doc per user per space"]
            P6["tenants/{tid}/digitalTestSessions/{sessId}<br/>ONE doc per test attempt"]
        end

        subgraph "Realtime Database"
            P7["leaderboards/{tid}/{sid}/{uid}<br/>points, displayName, completionPercent"]
        end

        subgraph "Practice Mode (RTDB)"
            P8["practice/{uid}/{sid}<br/>ephemeral practice state"]
        end
    end

    style P4 fill:#fef2f2,stroke:#dc2626
    style P5 fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style P6 fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style P7 fill:#fef9c3,stroke:#ca8a04
    style P8 fill:#fef9c3,stroke:#ca8a04
```

---

## 5. SpaceProgress Document Example

```mermaid
graph TB
    subgraph "SpaceProgress Document"
        direction TB
        DOC["<b>tenants/tenant_subhang/spaceProgress/uid123_spaceABC</b>"]

        subgraph "Top-Level Fields"
            F1["id: 'uid123_spaceABC'"]
            F2["userId: 'uid123'"]
            F3["spaceId: 'spaceABC'"]
            F4["status: 'in_progress'"]
            F5["pointsEarned: 15"]
            F6["totalPoints: 25"]
            F7["percentage: 60.0"]
        end

        subgraph "storyPoints: Record<string, StoryPointProgress>"
            SP_A["'sp1': {<br/>  storyPointId: 'sp1'<br/>  status: 'completed'<br/>  pointsEarned: 10<br/>  totalPoints: 10<br/>  percentage: 100<br/>  completedAt: 1711234567890<br/>}"]
            SP_B["'sp2': {<br/>  storyPointId: 'sp2'<br/>  status: 'in_progress'<br/>  pointsEarned: 5<br/>  totalPoints: 15<br/>  percentage: 33.3<br/>}"]
        end

        subgraph "items: Record<string, ItemProgressEntry>"
            IT_1["'item1': {<br/>  itemId: 'item1'<br/>  storyPointId: 'sp1'<br/>  itemType: 'material'<br/>  completed: true<br/>  progress: 100<br/>  score: 1<br/>}"]
            IT_2["'item2': {<br/>  itemId: 'item2'<br/>  storyPointId: 'sp1'<br/>  itemType: 'question'<br/>  completed: true<br/>  questionData: {<br/>    status: 'correct'<br/>    attemptsCount: 2<br/>    bestScore: 5<br/>    pointsEarned: 5<br/>    totalPoints: 5<br/>    percentage: 100<br/>    solved: true<br/>  }<br/>}"]
            IT_3["'item3': {<br/>  itemId: 'item3'<br/>  storyPointId: 'sp2'<br/>  itemType: 'question'<br/>  completed: false<br/>  questionData: {<br/>    status: 'partial'<br/>    attemptsCount: 1<br/>    bestScore: 3<br/>    pointsEarned: 3<br/>    totalPoints: 10<br/>    percentage: 30<br/>    solved: false<br/>  }<br/>}"]
        end
    end

    DOC --> F1
    DOC --> SP_A
    DOC --> SP_B
    DOC --> IT_1
    DOC --> IT_2
    DOC --> IT_3

    style DOC fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style IT_1 fill:#d1fae5,stroke:#10b981
    style IT_2 fill:#d1fae5,stroke:#10b981
    style IT_3 fill:#fef3c7,stroke:#f59e0b
```

---

## 6. Answer Submission Flow (Standard StoryPoint)

```mermaid
sequenceDiagram
    participant S as Student Browser
    participant SP as StoryPointViewerPage
    participant QA as QuestionAnswerer
    participant AE as autoEvaluateClient
    participant CF as evaluateAnswer<br/>(Cloud Function)
    participant RQ as React Query Cache
    participant RA as recordItemAttempt<br/>(Cloud Function)
    participant PU as progress-updater<br/>(Firestore Transaction)
    participant FS as Firestore<br/>spaceProgress doc
    participant RTDB as Realtime DB<br/>leaderboard

    S->>QA: Clicks "Submit Answer"
    QA->>SP: onSubmit(answer)
    SP->>AE: autoEvaluateClient(item, answer)

    alt Auto-Evaluatable (9 types: mcq, mcaq, etc.)
        AE-->>SP: EvaluationResult {score, maxScore, correctness}
    else AI-Evaluatable (6 types: text, paragraph, etc.)
        AE-->>SP: null
        SP->>CF: evaluateAnswer({tenantId, spaceId, itemId, answer})
        CF-->>SP: EvaluationResult
    end

    Note over SP: setEvaluations(prev => ({...prev, [itemId]: result}))
    Note over SP: ⚠️ EPHEMERAL STATE — lost on navigation

    SP->>RQ: recordAttempt.mutate({score, maxScore, correct, ...})

    Note over RQ: onMutate → Optimistic Update
    RQ->>RQ: applyOptimisticUpdate(progress, variables)
    Note over RQ: Updates items[itemId].questionData<br/>Updates storyPoints[spId].pointsEarned<br/>Updates space pointsEarned & percentage

    RQ->>RA: callRecordItemAttempt (HTTP)

    Note over RA: ⚠️ Reads progress doc OUTSIDE transaction
    RA->>FS: progressRef.get() [redundant read]
    FS-->>RA: existing items

    Note over RA: Computes bestScore, attemptsCount,<br/>builds StoredItemProgressEntry

    RA->>PU: recalculateAndWriteProgress({newItemEntries})

    Note over PU: Firestore Transaction begins
    PU->>FS: transaction.get(progressRef) [authoritative read]
    FS-->>PU: existing progress doc

    Note over PU: 1. Merge items (best-score retention)
    Note over PU: 2. Group items by storyPointId
    Note over PU: 3. Aggregate per-storyPoint totals
    Note over PU: 4. Aggregate space-level totals
    Note over PU: 5. Check storyPoint completion
    PU->>FS: transaction.get(storyPointDoc)
    FS-->>PU: stats.totalItems
    Note over PU: completedItems >= totalItems → completed
    Note over PU: 6. Check space completion
    PU->>FS: transaction.get(spaceDoc)
    FS-->>PU: stats.totalStoryPoints
    Note over PU: allSPs completed → space completed

    PU->>FS: transaction.set(progressRef, merged, {merge: true})
    Note over PU: Transaction commits

    PU->>RTDB: leaderboards/{tid}/{sid}/{uid}.set({points, %})

    PU-->>RA: {totalPointsEarned, overallPercentage}
    RA-->>RQ: {success, bestScore, attemptsCount}

    Note over RQ: onSettled → invalidateQueries
    RQ->>FS: Re-fetch progress (useProgress)
    FS-->>RQ: Latest SpaceProgress
    RQ-->>SP: progress data updated
    SP-->>S: UI reflects new scores
```

---

## 7. Test Submission Flow

```mermaid
sequenceDiagram
    participant S as Student Browser
    participant TTP as TimedTestPage
    participant RQ as React Query Cache
    participant STS as submitTestSession<br/>(Cloud Function)
    participant AE as autoEvaluateSubmission
    participant PU as progress-updater
    participant FS as Firestore

    S->>TTP: Clicks "Submit Test" (or auto-submit on timeout)
    TTP->>RQ: submitTest.mutate({tenantId, sessionId})

    RQ->>STS: callSubmitTestSession (HTTP)

    STS->>FS: Get session doc
    FS-->>STS: DigitalTestSession

    Note over STS: Validate: ownership, status=in_progress, timing

    STS->>FS: loadItems(tenantId, spaceId, storyPointId)
    FS-->>STS: UnifiedItem[]

    STS->>FS: Load answerKeys (parallel, nested path → flat fallback)
    FS-->>STS: Map<itemId, AnswerKey>

    loop For each submission
        STS->>AE: autoEvaluateSubmission(item, submission, answerKey)
        alt Auto-evaluatable
            AE-->>STS: EvaluationResult
            Note over STS: Add to pointsEarned
        else AI-evaluatable
            AE-->>STS: null
            Note over STS: Mark as pendingAI<br/>Exclude from % calculation
        end
    end

    Note over STS: Count unanswered questions in totalPoints
    Note over STS: Compute analytics (topic, difficulty, Bloom's, section)

    STS->>FS: sessionRef.update({status: completed, submissions, analytics, ...})

    Note over STS: Build StoredItemProgressEntry for each graded item

    STS->>PU: recalculateAndWriteProgress({<br/>  newItemEntries,<br/>  forceStoryPointComplete: true<br/>})

    Note over PU: Same transaction flow as standard:<br/>merge items, aggregate, detect completion
    Note over PU: forceStoryPointComplete=true<br/>→ storyPoint.status = 'completed'

    PU->>FS: transaction.set(progressRef)
    PU-->>STS: {totalPointsEarned, overallPercentage}

    STS-->>RQ: {success, pointsEarned, totalPoints, percentage}
    RQ-->>TTP: Navigate to results view
    TTP-->>S: Show test results + analytics
```

---

## 8. Progress Aggregation Pipeline (Inside Transaction)

```mermaid
graph TB
    subgraph "INPUT"
        NE["newItemEntries<br/>{itemId → StoredItemProgressEntry}"]
        EX["Existing Progress Doc<br/>(from transaction.get)"]
    end

    subgraph "STEP 1: Merge Items"
        M1["For each new item:"]
        M2{"Existing item<br/>has questionData?"}
        M3["Best-score retention:<br/>bestScore = max(new, existing)<br/>attemptsCount = existing + 1<br/>solved = new.solved || existing.solved<br/>completed = solved || bestScore/max >= 50%"]
        M4["Direct set<br/>(new entry or material)"]
        M5["mergedItems = {...existing, ...merged}"]
    end

    subgraph "STEP 2: Per-StoryPoint Aggregation"
        A1["Group mergedItems by storyPointId"]
        A2["For each storyPoint group:"]
        A3["Questions: sum bestScore, sum totalPoints"]
        A4["Materials: completed=1/1, incomplete=0/1"]
        A5["storyPointAgg = {<br/>  pointsEarned, totalPoints,<br/>  percentage, completedItems<br/>}"]
    end

    subgraph "STEP 3: Space-Level Aggregation"
        B1["Sum across ALL mergedItems:"]
        B2["totalPointsEarned (all questions bestScore)"]
        B3["totalPointsAvailable (all questions totalPoints)"]
        B4["+ completed materials (1) + incomplete materials (1)"]
        B5["overallPercentage = earned / available * 100"]
    end

    subgraph "STEP 4: Completion Detection"
        C1{"forceComplete?"}
        C2["storyPoint status = completed"]
        C3["Read storyPoint doc:<br/>stats.totalItems"]
        C4{"completedItems >=<br/>totalItems?"}
        C5["storyPoint status = completed"]
        C6["storyPoint status = in_progress"]
        C7{"storyPoint just<br/>completed?"}
        C8["Read space doc:<br/>stats.totalStoryPoints"]
        C9{"All storyPoints<br/>completed?"}
        C10["space status = completed"]
        C11["space status = in_progress"]
    end

    subgraph "STEP 5: Write"
        W1["transaction.set(progressRef, {<br/>  items: mergedItems,<br/>  storyPoints: mergedSPs,<br/>  pointsEarned, totalPoints, %,<br/>  status<br/>}, {merge: true})"]
    end

    subgraph "STEP 6: Leaderboard (outside txn)"
        L1["RTDB: leaderboards/{tid}/{sid}/{uid}<br/>{points, displayName, completionPercent}"]
    end

    NE --> M1
    EX --> M1
    M1 --> M2
    M2 -->|Yes| M3
    M2 -->|No| M4
    M3 --> M5
    M4 --> M5

    M5 --> A1
    A1 --> A2
    A2 --> A3
    A2 --> A4
    A3 --> A5
    A4 --> A5

    M5 --> B1
    B1 --> B2
    B1 --> B3
    B2 --> B4
    B3 --> B4
    B4 --> B5

    A5 --> C1
    C1 -->|Yes| C2
    C1 -->|No| C3
    C3 --> C4
    C4 -->|Yes| C5
    C4 -->|No| C6
    C2 --> C7
    C5 --> C7
    C7 -->|Yes| C8
    C7 -->|No| C11
    C8 --> C9
    C9 -->|Yes| C10
    C9 -->|No| C11

    B5 --> W1
    C10 --> W1
    C11 --> W1
    W1 --> L1

    style NE fill:#dbeafe,stroke:#2563eb
    style EX fill:#dbeafe,stroke:#2563eb
    style M3 fill:#d1fae5,stroke:#10b981
    style W1 fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style L1 fill:#fef9c3,stroke:#ca8a04
```

---

## 9. Frontend Data Flow (Hooks → Cache → UI)

```mermaid
graph TB
    subgraph "React Components"
        SVP["SpaceViewerPage<br/>useProgress(tid, uid, sid)<br/>useAllSpaceProgress(tid, uid)"]
        SPVP["StoryPointViewerPage<br/>useProgress(tid, uid, sid)<br/>useState: evaluations ⚠️ EPHEMERAL"]
        TTP["TimedTestPage<br/>useTestSession<br/>useStartTest / useSubmitTest"]
        PMP["PracticeModePage<br/>useProgress(tid, uid, sid)<br/>RTDB persistence"]
        NAV["SpaceNavSidebar<br/>useProgress(tid, uid, sid)"]
    end

    subgraph "React Query Cache"
        QK1["['tenants', tid, 'progress', uid, sid]<br/>→ SpaceProgress | null<br/>staleTime: 30s"]
        QK2["['tenants', tid, 'progress', uid, 'all']<br/>→ Record<spaceId, SpaceProgress><br/>staleTime: 30s"]
        QK3["['tenants', tid, 'progress', uid, 'overall']<br/>→ SpaceProgress (aggregated)<br/>staleTime: 30s"]
    end

    subgraph "Mutation: useRecordItemAttempt"
        MUT["recordAttempt.mutate()"]
        OM["onMutate: Optimistic Update<br/>applyOptimisticUpdate()"]
        OE["onError: Rollback to snapshot"]
        OS["onSettled: invalidateQueries<br/>[tid, 'progress', uid, sid]<br/>[tid, 'progress', uid, 'all']<br/>[tid, 'progress', uid, 'overall']"]
    end

    subgraph "Firestore (Source of Truth)"
        FS["spaceProgress/{uid}_{sid}<br/>⚠️ useProgress uses WHERE query<br/>instead of direct doc get"]
    end

    subgraph "UI Rendering (ItemNavigator)"
        IN["Item Button Colors:"]
        GR["🔘 Gray: no evaluation AND not completed"]
        GN["🟢 Green: eval.correctness >= 1 OR (material && completed)"]
        RD["🔴 Red: eval.correctness === 0"]
        BUG["⚠️ BUG: On revisit, evaluations={},<br/>so questions always show GRAY<br/>even if progress.items[id].completed=true"]
    end

    SVP --> QK1
    SVP --> QK2
    SPVP --> QK1
    TTP --> QK1
    PMP --> QK1
    NAV --> QK1

    MUT --> OM
    OM --> QK1
    OM --> QK2
    MUT --> OE
    OE --> QK1
    OE --> QK2
    MUT --> OS
    OS --> FS

    FS --> QK1
    FS --> QK2
    FS --> QK3

    QK1 --> IN
    IN --> GR
    IN --> GN
    IN --> RD
    IN --> BUG

    style BUG fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style FS fill:#dbeafe,stroke:#2563eb
    style OM fill:#d1fae5,stroke:#10b981
    style OE fill:#fef2f2,stroke:#dc2626
```

---

## 10. Optimistic Update vs Server Logic (Mismatch Diagram)

```mermaid
graph LR
    subgraph "Client: applyOptimisticUpdate()"
        C1["completed = variables.correct<br/>⚠️ Ignores ≥50% partial credit"]
        C2["scoreDelta = newScore - prevScore<br/>⚠️ Can go NEGATIVE on retry<br/>(server uses best-score, delta≥0)"]
        C3["status = correct|incorrect<br/>⚠️ Missing 'partial' status"]
    end

    subgraph "Server: progress-updater"
        S1["completed = solved ||<br/>(bestScore/maxScore >= 0.5)<br/>✅ Includes partial credit"]
        S2["bestScore = max(new, existing)<br/>scoreDelta always ≥ 0<br/>✅ Best-score retention"]
        S3["status = correct|partial|incorrect<br/>✅ Three-way status"]
    end

    C1 -.->|"MISMATCH"| S1
    C2 -.->|"MISMATCH"| S2
    C3 -.->|"MISMATCH"| S3

    style C1 fill:#fef2f2,stroke:#dc2626
    style C2 fill:#fef2f2,stroke:#dc2626
    style C3 fill:#fef2f2,stroke:#dc2626
    style S1 fill:#d1fae5,stroke:#10b981
    style S2 fill:#d1fae5,stroke:#10b981
    style S3 fill:#d1fae5,stroke:#10b981
```

---

## 11. Dual-Path Data Processing (record-item-attempt + progress-updater)

```mermaid
graph TB
    subgraph "record-item-attempt.ts (OUTSIDE transaction)"
        R1["progressDoc = await progressRef.get()<br/>⚠️ Redundant read — stale under concurrency"]
        R2["previousBest = existing?.questionData?.bestScore ?? 0"]
        R3["bestScore = max(data.score, previousBest)"]
        R4["attemptsCount = existing.attemptsCount + 1<br/>⚠️ Computed but IGNORED by merger"]
        R5["timeSpent = existing.timeSpent + data.timeSpent<br/>⚠️ Pre-accumulates existing time"]
        R6["Build itemEntry with pre-computed values"]
    end

    subgraph "progress-updater.ts (INSIDE transaction)"
        P1["progressDoc = transaction.get(progressRef)<br/>✅ Authoritative read"]
        P2["existing = mergedItems[itemId]"]
        P3["bestScore = max(entry.bestScore, existing.bestScore)<br/>✅ Re-computed from authoritative data"]
        P4["attemptsCount = existing.attemptsCount + 1<br/>✅ Computed from authoritative data"]
        P5["timeSpent = existing.timeSpent + entry.timeSpent<br/>⚠️ BUG: entry.timeSpent already includes existing!<br/>Result: DOUBLE-COUNTED"]
        P6["Write merged document"]
    end

    R1 --> R2 --> R3 --> R4 --> R5 --> R6
    R6 -->|"newItemEntries"| P1
    P1 --> P2 --> P3 --> P4 --> P5 --> P6

    style R1 fill:#fef3c7,stroke:#d97706
    style R4 fill:#fef3c7,stroke:#d97706
    style R5 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style P5 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style P1 fill:#d1fae5,stroke:#10b981
    style P3 fill:#d1fae5,stroke:#10b981
    style P4 fill:#d1fae5,stroke:#10b981
```

---

## 12. Known Issues Summary

```mermaid
graph TB
    subgraph "CRITICAL — Progress Not Visible on Revisit"
        BUG1["#1 Evaluations in ephemeral useState<br/>StoryPointViewerPage:173<br/>Lost on navigation, items show gray"]
        BUG2["#2 savedAnswer prop never passed<br/>StoryPointViewerPage:116<br/>Form appears blank on revisit"]
        BUG3["#3 submitted state resets<br/>QuestionAnswerer:69<br/>Submit button reappears"]
    end

    subgraph "HIGH — Data Integrity"
        BUG4["#4 timeSpent double-counted<br/>record-item-attempt:70 + progress-updater:74<br/>Inflates on every attempt"]
    end

    subgraph "MEDIUM — Optimistic Update Drift"
        BUG5["#5 completed ignores ≥50% partial credit<br/>useRecordItemAttempt:115"]
        BUG6["#6 scoreDelta can go negative on retry<br/>useRecordItemAttempt:103-104"]
    end

    subgraph "LOW — Efficiency"
        BUG7["#7 Redundant read outside transaction<br/>record-item-attempt:49-52"]
        BUG8["#8 attemptsCount pre-computed then ignored<br/>record-item-attempt:56"]
        BUG9["#9 useProgress uses WHERE query<br/>instead of getDoc by known ID<br/>useProgress:20-30"]
    end

    style BUG1 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style BUG2 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style BUG3 fill:#fef2f2,stroke:#dc2626,stroke-width:2px
    style BUG4 fill:#fff7ed,stroke:#ea580c,stroke-width:2px
    style BUG5 fill:#fef9c3,stroke:#ca8a04
    style BUG6 fill:#fef9c3,stroke:#ca8a04
    style BUG7 fill:#f0f9ff,stroke:#0369a1
    style BUG8 fill:#f0f9ff,stroke:#0369a1
    style BUG9 fill:#f0f9ff,stroke:#0369a1
```

---

## 13. Scoring Rules Summary

| Item Type                       | Scoring Source                    | Completion Rule                         | Points Contribution                |
| ------------------------------- | --------------------------------- | --------------------------------------- | ---------------------------------- |
| **Question (auto-evaluatable)** | Client `autoEvaluateClient()`     | `correct \|\| bestScore/maxScore ≥ 50%` | `bestScore` (best-score retention) |
| **Question (AI-evaluatable)**   | Cloud `evaluateAnswer()`          | `correct \|\| bestScore/maxScore ≥ 50%` | `bestScore` (best-score retention) |
| **Material**                    | Auto-complete on mount            | `score = 1, maxScore = 1`               | `1` when completed, `0` otherwise  |
| **Test question**               | Server `autoEvaluateSubmission()` | `correct \|\| score/maxScore ≥ 50%`     | `bestScore` per attempt            |
| **AI-pending test Q**           | Excluded until graded             | Excluded from %                         | `0` until AI evaluates             |

## 14. Key Files Reference

| Layer        | File                                                             | Purpose                                                                      |
| ------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Types**    | `packages/shared-types/src/levelup/progress.ts`                  | SpaceProgress, StoryPointProgress, ItemProgressEntry, QuestionProgressData   |
| **Types**    | `packages/shared-types/src/levelup/space.ts`                     | Space, SpaceStats, SpaceStatus                                               |
| **Types**    | `packages/shared-types/src/levelup/story-point.ts`               | StoryPoint, StoryPointType, AssessmentConfig, StoryPointStats                |
| **Types**    | `packages/shared-types/src/content/item.ts`                      | UnifiedItem, ItemType (7), QuestionType (15), MaterialType (7), all payloads |
| **Types**    | `packages/shared-types/src/levelup/test-session.ts`              | DigitalTestSession, TestSubmission, TestAnalytics                            |
| **Backend**  | `functions/levelup/src/callable/record-item-attempt.ts`          | Records single item attempt (standard/practice)                              |
| **Backend**  | `functions/levelup/src/callable/submit-test-session.ts`          | Submits entire test, grades all questions                                    |
| **Backend**  | `functions/levelup/src/utils/progress-updater.ts`                | Unified transactional progress writer                                        |
| **Hooks**    | `packages/shared-hooks/src/queries/useProgress.ts`               | useProgress, useAllSpaceProgress                                             |
| **Hooks**    | `packages/shared-hooks/src/queries/useRecordItemAttempt.ts`      | Mutation + optimistic update                                                 |
| **Frontend** | `apps/student-web/src/pages/StoryPointViewerPage.tsx`            | Standard story point viewer + item navigator                                 |
| **Frontend** | `apps/student-web/src/pages/TimedTestPage.tsx`                   | Timed test experience                                                        |
| **Frontend** | `apps/student-web/src/pages/PracticeModePage.tsx`                | Practice mode with RTDB persistence                                          |
| **Frontend** | `apps/student-web/src/components/questions/QuestionAnswerer.tsx` | Universal question answerer (15 types)                                       |
| **Frontend** | `apps/student-web/src/utils/auto-evaluate-client.ts`             | Client-side deterministic evaluation                                         |
| **Services** | `packages/shared-services/src/levelup/assessment-callables.ts`   | callRecordItemAttempt, callSubmitTestSession                                 |
