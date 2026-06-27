/**
 * System Design Space — seed configuration
 * 4 story points × 8 items = 32 items total
 * Story point types: standard, practice, quiz, timed_test
 * Question types used: mcq, mcaq, true-false, numerical, text, paragraph, fill-blanks, matching, jumbled
 */

// ── Seed interfaces (flat payload, no {type,data} wrapper) ──

export interface SpaceSeed {
  title: string;
  description: string;
  subject: string;
  classIds: string[];
  teacherIndex: number;
  type: string;
  storyPoints: StoryPointSeed[];
}

export interface StoryPointSeed {
  title: string;
  description: string;
  type: string;
  assessmentConfig?: {
    durationMinutes?: number;
    maxAttempts?: number;
    shuffleQuestions?: boolean;
    showResultsImmediately?: boolean;
    passingPercentage?: number;
  };
  sections: { id: string; title: string; orderIndex: number }[];
  items: ItemSeed[];
}

export interface ItemSeed {
  title: string;
  type: 'question' | 'material';
  sectionId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  payload: Record<string, unknown>;
}

// ── System Design Space ──

export const systemDesignSpace: SpaceSeed = {
  title: 'System Design',
  description:
    'Master the fundamentals of system design, covering scalability, databases, caching, load balancing, and distributed architectures through theory, practice, quizzes, and timed assessments.',
  subject: 'Computer Science',
  classIds: [],
  teacherIndex: 0,
  type: 'hybrid',
  storyPoints: [
    // ═══════════════════════════════════════════════════════
    // SP1: Fundamentals of Scalability — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Fundamentals of Scalability',
      description:
        'Learn core scalability concepts — horizontal vs vertical scaling, CAP theorem, and trade-offs.',
      type: 'standard',
      sections: [
        { id: 'sec_theory', title: 'Theory & Concepts', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice Questions', orderIndex: 1 },
      ],
      items: [
        // 1. Material - Rich
        {
          title: 'Introduction to Scalability',
          type: 'material',
          sectionId: 'sec_theory',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Introduction to Scalability',
              blocks: [
                {
                  id: 'b1',
                  type: 'heading',
                  content: 'What is Scalability?',
                  metadata: { level: 2 },
                },
                {
                  id: 'b2',
                  type: 'paragraph',
                  content:
                    'Scalability is the ability of a system to handle growing amounts of work by adding resources. A scalable system can maintain performance and availability as demand increases, whether from more users, more data, or more transactions.',
                },
                {
                  id: 'b3',
                  type: 'heading',
                  content: 'Horizontal vs Vertical Scaling',
                  metadata: { level: 3 },
                },
                {
                  id: 'b4',
                  type: 'paragraph',
                  content:
                    'Vertical scaling (scaling up) means adding more power to an existing machine — more CPU, RAM, or storage. Horizontal scaling (scaling out) means adding more machines to distribute the load across multiple servers.',
                },
                {
                  id: 'b5',
                  type: 'list',
                  content: '',
                  metadata: {
                    listType: 'unordered',
                    items: [
                      'Vertical Scaling: Simpler but has hardware limits. Example: upgrading a database server from 16GB to 64GB RAM.',
                      'Horizontal Scaling: More complex but virtually unlimited. Example: adding more web servers behind a load balancer.',
                    ],
                  },
                },
                {
                  id: 'b6',
                  type: 'heading',
                  content: 'CAP Theorem Overview',
                  metadata: { level: 3 },
                },
                {
                  id: 'b7',
                  type: 'paragraph',
                  content:
                    'The CAP theorem states that a distributed data store can only guarantee two of three properties: Consistency (every read returns the most recent write), Availability (every request receives a response), and Partition Tolerance (the system continues to operate despite network partitions). In practice, since network partitions are unavoidable, you must choose between consistency and availability.',
                },
                {
                  id: 'b8',
                  type: 'quote',
                  content:
                    '"You can have at most two of these three properties for any shared-data system." — Eric Brewer',
                },
              ],
              readingTime: 5,
            },
          },
        },
        // 2. Material - Video
        {
          title: 'Scalability Deep Dive',
          type: 'material',
          sectionId: 'sec_theory',
          payload: {
            materialType: 'video',
            url: 'https://www.youtube.com/watch?v=tndzLznxq40',
            duration: 1200,
          },
        },
        // 3. MCQ — easy
        {
          title: 'Which type of scaling adds more machines?',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Which type of scaling adds more machines to handle increased load?',
            explanation:
              'Horizontal scaling (scaling out) adds more machines to the pool, distributing the workload across multiple servers.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Horizontal scaling', isCorrect: true },
                { id: 'b', text: 'Vertical scaling', isCorrect: false },
                { id: 'c', text: 'Diagonal scaling', isCorrect: false },
                { id: 'd', text: 'Circular scaling', isCorrect: false },
              ],
            },
          },
        },
        // 4. True/False — easy
        {
          title: 'CAP theorem allows all three guarantees',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content:
              'CAP theorem states you can have all three: Consistency, Availability, and Partition Tolerance simultaneously in a distributed system.',
            explanation:
              'False. The CAP theorem states that a distributed system can only guarantee two of the three properties at any given time.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: false },
          },
        },
        // 5. MCAQ — medium
        {
          title: 'Benefits of horizontal scaling',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL benefits of horizontal scaling:',
            explanation:
              'Horizontal scaling provides better fault tolerance (if one server fails, others continue) and linear cost scaling (add commodity hardware as needed). However, it requires a load balancer and introduces architectural complexity.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Better fault tolerance', isCorrect: true },
                { id: 'b', text: 'Linear cost scaling', isCorrect: true },
                { id: 'c', text: 'Simpler architecture', isCorrect: false },
                { id: 'd', text: 'No need for load balancer', isCorrect: false },
              ],
            },
          },
        },
        // 6. Numerical — easy
        {
          title: 'Horizontal scaling throughput calculation',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'numerical',
            content:
              'If a system handles 1000 req/s with 1 server, how many req/s can 4 identical servers handle with perfect horizontal scaling?',
            explanation:
              'With perfect horizontal scaling, throughput scales linearly: 1000 × 4 = 4000 req/s.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: 4000, tolerance: 0 },
          },
        },
        // 7. Fill Blanks — medium
        {
          title: 'CAP theorem fill-in-the-blank',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content:
              'The _____ theorem states that a distributed system can only guarantee two of three properties.',
            explanation:
              'The CAP theorem (Consistency, Availability, Partition Tolerance) was proposed by Eric Brewer.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks:
                'The {{blank1}} theorem states that a distributed system can only guarantee two of three properties.',
              blanks: [
                {
                  id: 'blank1',
                  correctAnswer: 'CAP',
                  acceptableAnswers: ['CAP', 'cap', 'Cap'],
                  caseSensitive: false,
                },
              ],
            },
          },
        },
        // 8. Paragraph — hard
        {
          title: 'Horizontal vs vertical scaling trade-offs',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content:
              'Explain the trade-offs between horizontal and vertical scaling. Include real-world examples of when you would choose each approach.',
            explanation:
              'A strong answer should cover: cost differences, complexity, fault tolerance, hardware limits, data consistency challenges, and provide concrete examples like database scaling vs web server scaling.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer:
                'Vertical scaling (scaling up) involves adding more resources to a single machine. It is simpler to implement — no code changes needed — but has hard limits (you can only add so much RAM/CPU to one server). It also creates a single point of failure. Example: upgrading a PostgreSQL database server.\n\nHorizontal scaling (scaling out) involves adding more machines. It offers virtually unlimited scalability and better fault tolerance, but introduces complexity: you need load balancers, data consistency strategies, and distributed system patterns. Example: adding more web servers behind an Nginx load balancer.\n\nIn practice, most systems use a combination: vertically scale the database (which is harder to distribute) and horizontally scale stateless application servers.',
              minLength: 100,
              maxLength: 2000,
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP2: Database Design & Patterns — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Database Design & Patterns',
      description:
        'Practice database selection, schema design, partitioning, and replication strategies.',
      type: 'practice',
      sections: [
        { id: 'sec_concepts', title: 'Key Concepts', orderIndex: 0 },
        { id: 'sec_exercises', title: 'Practice Exercises', orderIndex: 1 },
        { id: 'sec_advanced', title: 'Advanced Patterns', orderIndex: 2 },
      ],
      items: [
        // 1. Material - Rich
        {
          title: 'SQL vs NoSQL Decision Guide',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'SQL vs NoSQL Decision Guide',
              blocks: [
                {
                  id: 'b1',
                  type: 'heading',
                  content: 'Choosing the Right Database',
                  metadata: { level: 2 },
                },
                {
                  id: 'b2',
                  type: 'paragraph',
                  content:
                    'The choice between SQL and NoSQL databases depends on your data model, scalability needs, consistency requirements, and query patterns. There is no one-size-fits-all answer.',
                },
                {
                  id: 'b3',
                  type: 'heading',
                  content: 'SQL Databases',
                  metadata: { level: 3 },
                },
                {
                  id: 'b4',
                  type: 'list',
                  content: '',
                  metadata: {
                    listType: 'unordered',
                    items: [
                      'PostgreSQL: Best for complex queries, ACID compliance, and relational data with joins.',
                      'MySQL: Popular for web applications, good read performance, widely supported.',
                      'Use when: You need strong consistency, complex queries, or well-defined schemas.',
                    ],
                  },
                },
                {
                  id: 'b5',
                  type: 'heading',
                  content: 'NoSQL Databases',
                  metadata: { level: 3 },
                },
                {
                  id: 'b6',
                  type: 'list',
                  content: '',
                  metadata: {
                    listType: 'unordered',
                    items: [
                      'MongoDB: Document store, flexible schemas, good for rapidly evolving data models.',
                      'Redis: In-memory key-value store, ideal for caching, sessions, and real-time data.',
                      'Cassandra: Wide-column store, excellent for time-series data and high write throughput.',
                      'Use when: You need horizontal scalability, flexible schemas, or specific access patterns.',
                    ],
                  },
                },
                {
                  id: 'b7',
                  type: 'code',
                  content:
                    '-- SQL: Relational query with JOIN\nSELECT u.name, o.total\nFROM users u\nJOIN orders o ON u.id = o.user_id\nWHERE o.total > 100;\n\n// NoSQL (MongoDB): Embedded document query\ndb.users.find({\n  "orders.total": { $gt: 100 }\n});',
                  metadata: { language: 'sql' },
                },
              ],
              readingTime: 6,
            },
          },
        },
        // 2. MCQ — easy
        {
          title: 'Best database for relational data with joins',
          type: 'question',
          sectionId: 'sec_exercises',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content:
              'Which database is best for highly relational data with complex joins?',
            explanation:
              'PostgreSQL is a powerful relational database that excels at complex queries involving joins, aggregations, and ACID transactions.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'PostgreSQL', isCorrect: true },
                { id: 'b', text: 'MongoDB', isCorrect: false },
                { id: 'c', text: 'Redis', isCorrect: false },
                { id: 'd', text: 'Cassandra', isCorrect: false },
              ],
            },
          },
        },
        // 3. Matching — medium
        {
          title: 'Match database to use case',
          type: 'question',
          sectionId: 'sec_exercises',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each database to its primary use case:',
            explanation:
              'Redis is optimized for in-memory caching. PostgreSQL handles relational data. MongoDB stores flexible documents. Cassandra excels at time-series and high-write workloads.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Redis', right: 'Caching' },
                { id: 'p2', left: 'PostgreSQL', right: 'Relational Data' },
                { id: 'p3', left: 'MongoDB', right: 'Document Storage' },
                { id: 'p4', left: 'Cassandra', right: 'Time-series Data' },
              ],
            },
          },
        },
        // 4. MCAQ — medium
        {
          title: 'Valid database sharding strategies',
          type: 'question',
          sectionId: 'sec_exercises',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select all valid database sharding strategies:',
            explanation:
              'Hash-based, range-based, and directory-based are all valid sharding strategies. Random distribution is not a sharding strategy as it provides no way to locate data efficiently.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Hash-based sharding', isCorrect: true },
                { id: 'b', text: 'Range-based sharding', isCorrect: true },
                { id: 'c', text: 'Directory-based sharding', isCorrect: true },
                { id: 'd', text: 'Random distribution', isCorrect: false },
              ],
            },
          },
        },
        // 5. Text — medium
        {
          title: 'What is database denormalization?',
          type: 'question',
          sectionId: 'sec_exercises',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content:
              'What is database denormalization and when would you use it?',
            explanation:
              'Denormalization is the process of adding redundant data to a normalized database to improve read performance at the cost of write complexity and storage.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
              correctAnswer:
                'Denormalization adds redundant copies of data to reduce expensive joins and improve read performance, typically used in read-heavy systems.',
              acceptableAnswers: [
                'Adding redundant data to improve read performance',
                'Storing duplicate data to avoid joins',
              ],
            },
          },
        },
        // 6. MCQ — easy
        {
          title: 'Primary benefit of database replication',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content:
              'What is the primary benefit of database replication?',
            explanation:
              'Database replication copies data across multiple servers, primarily to ensure high availability — if one server fails, others can serve requests.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'High availability', isCorrect: true },
                { id: 'b', text: 'Reduced storage', isCorrect: false },
                { id: 'c', text: 'Faster writes', isCorrect: false },
                { id: 'd', text: 'Simpler queries', isCorrect: false },
              ],
            },
          },
        },
        // 7. True/False — easy
        {
          title: 'Master-slave replication write direction',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content:
              'In a master-slave replication setup, writes go to slave nodes.',
            explanation:
              'False. In master-slave replication, all writes go to the master node, which then replicates data to slave (read replica) nodes.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: false },
          },
        },
        // 8. Paragraph — hard
        {
          title: 'Design a social media database schema',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content:
              'Design a database schema for a social media platform like Twitter. Include tables, relationships, and indexing strategy.',
            explanation:
              'A comprehensive answer should address users table, tweets/posts table, follows/relationships, likes, hashtags, and indexing on frequently queried columns like user_id, created_at, and hashtag.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              modelAnswer:
                'Core Tables:\n1. users (id PK, username UNIQUE, email UNIQUE, display_name, bio, created_at)\n2. tweets (id PK, user_id FK→users, content VARCHAR(280), media_url, created_at, reply_to_id FK→tweets)\n3. follows (follower_id FK→users, following_id FK→users, created_at, PRIMARY KEY(follower_id, following_id))\n4. likes (user_id FK→users, tweet_id FK→tweets, created_at, PRIMARY KEY(user_id, tweet_id))\n5. hashtags (id PK, tag UNIQUE)\n6. tweet_hashtags (tweet_id FK→tweets, hashtag_id FK→hashtags)\n\nIndexing Strategy:\n- B-tree index on tweets.user_id + tweets.created_at (user timeline)\n- B-tree index on follows.following_id (follower lookup)\n- B-tree index on tweets.created_at (global feed)\n- Full-text index on tweets.content (search)\n\nFor scale: partition tweets by created_at (time-based sharding), cache hot timelines in Redis, use fan-out-on-write for home timeline generation.',
              minLength: 150,
              maxLength: 3000,
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP3: Caching & Load Balancing Quiz — quiz
    // ═══════════════════════════════════════════════════════
    {
      title: 'Caching & Load Balancing Quiz',
      description:
        'Quick assessment on caching strategies, CDNs, and load balancing algorithms.',
      type: 'quiz',
      assessmentConfig: {
        maxAttempts: 3,
        shuffleQuestions: true,
        showResultsImmediately: true,
        passingPercentage: 60,
      },
      sections: [
        { id: 'sec_caching', title: 'Caching Questions', orderIndex: 0 },
        { id: 'sec_lb', title: 'Load Balancing Questions', orderIndex: 1 },
      ],
      items: [
        // 1. MCQ — easy
        {
          title: 'Write-through caching strategy',
          type: 'question',
          sectionId: 'sec_caching',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content:
              'Which caching strategy writes to cache AND database simultaneously?',
            explanation:
              'Write-through cache writes data to both the cache and the database at the same time, ensuring consistency but with higher write latency.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Write-through', isCorrect: true },
                { id: 'b', text: 'Write-back', isCorrect: false },
                { id: 'c', text: 'Write-around', isCorrect: false },
                { id: 'd', text: 'Cache-aside', isCorrect: false },
              ],
            },
          },
        },
        // 2. MCQ — medium
        {
          title: 'What is a cache stampede?',
          type: 'question',
          sectionId: 'sec_caching',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What is a cache stampede?',
            explanation:
              'A cache stampede (thundering herd) occurs when a cached item expires and many concurrent requests all miss the cache simultaneously, flooding the database with identical queries.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                {
                  id: 'a',
                  text: 'Many requests hitting DB when cache expires',
                  isCorrect: true,
                },
                { id: 'b', text: 'Cache becoming too large', isCorrect: false },
                {
                  id: 'c',
                  text: 'Cache writing incorrect data',
                  isCorrect: false,
                },
                { id: 'd', text: 'Cache server crashing', isCorrect: false },
              ],
            },
          },
        },
        // 3. True/False — easy
        {
          title: 'CDN for static assets',
          type: 'question',
          sectionId: 'sec_caching',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content:
              'CDN (Content Delivery Network) is primarily used for caching static assets.',
            explanation:
              'True. CDNs cache static content (images, CSS, JS, videos) at edge locations geographically close to users, reducing latency and server load.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
        // 4. Fill Blanks — medium
        {
          title: 'Cache-aside pattern',
          type: 'question',
          sectionId: 'sec_caching',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content:
              'The _____ caching pattern has the application check cache first, and on miss, loads from DB and populates cache.',
            explanation:
              'The cache-aside (lazy loading) pattern puts the application in charge of reading from and writing to the cache, checking it before each database read.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks:
                'The {{blank1}} caching pattern has the application check cache first, and on miss, loads from DB and populates cache.',
              blanks: [
                {
                  id: 'blank1',
                  correctAnswer: 'cache-aside',
                  acceptableAnswers: [
                    'cache-aside',
                    'cache aside',
                    'lazy loading',
                  ],
                  caseSensitive: false,
                },
              ],
            },
          },
        },
        // 5. MCQ — easy
        {
          title: 'Round Robin load balancing',
          type: 'question',
          sectionId: 'sec_lb',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content:
              'Which load balancing algorithm sends each request to the next server in order?',
            explanation:
              'Round Robin distributes requests sequentially across servers in a circular fashion — server 1, then server 2, then server 3, then back to server 1.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Round Robin', isCorrect: true },
                { id: 'b', text: 'Least Connections', isCorrect: false },
                { id: 'c', text: 'IP Hash', isCorrect: false },
                { id: 'd', text: 'Random', isCorrect: false },
              ],
            },
          },
        },
        // 6. MCQ — medium
        {
          title: 'Weighted Round Robin use case',
          type: 'question',
          sectionId: 'sec_lb',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content:
              'Which load balancing algorithm is best for servers with different capacities?',
            explanation:
              'Weighted Round Robin assigns more requests to servers with higher capacity (weight), making it ideal for heterogeneous server pools.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Weighted Round Robin', isCorrect: true },
                { id: 'b', text: 'Simple Round Robin', isCorrect: false },
                { id: 'c', text: 'Random', isCorrect: false },
                { id: 'd', text: 'IP Hash', isCorrect: false },
              ],
            },
          },
        },
        // 7. MCAQ — medium
        {
          title: 'Layer 7 load balancing features',
          type: 'question',
          sectionId: 'sec_lb',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content:
              'Select all Layer 7 (application layer) load balancing features:',
            explanation:
              'Layer 7 load balancers operate at the application layer and can inspect HTTP headers, URLs, and perform SSL termination. MAC address routing is a Layer 2 operation.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'URL-based routing', isCorrect: true },
                { id: 'b', text: 'SSL termination', isCorrect: true },
                { id: 'c', text: 'Header inspection', isCorrect: true },
                { id: 'd', text: 'MAC address routing', isCorrect: false },
              ],
            },
          },
        },
        // 8. Jumbled — medium
        {
          title: 'Caching layers order',
          type: 'question',
          sectionId: 'sec_lb',
          difficulty: 'medium',
          payload: {
            questionType: 'jumbled',
            content:
              'Arrange the caching layers from closest to furthest from the user:',
            explanation:
              'The correct order from closest to furthest: Browser Cache (client-side) → CDN (edge network) → Application Cache (server-side, e.g., Redis) → Database Cache (query cache, buffer pool).',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              items: [
                { id: 'j1', text: 'Browser Cache' },
                { id: 'j2', text: 'CDN' },
                { id: 'j3', text: 'Application Cache' },
                { id: 'j4', text: 'Database Cache' },
              ],
              correctOrder: ['j1', 'j2', 'j3', 'j4'],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP4: System Design Assessment — timed_test
    // ═══════════════════════════════════════════════════════
    {
      title: 'System Design Assessment',
      description:
        'Timed assessment covering all system design topics. Tests deep understanding of distributed systems architecture.',
      type: 'timed_test',
      assessmentConfig: {
        durationMinutes: 30,
        maxAttempts: 1,
        shuffleQuestions: true,
        showResultsImmediately: false,
        passingPercentage: 50,
      },
      sections: [
        { id: 'sec_mcq', title: 'Multiple Choice', orderIndex: 0 },
        { id: 'sec_design', title: 'Design Questions', orderIndex: 1 },
      ],
      items: [
        // 1. MCQ — easy
        {
          title: 'Purpose of a message queue',
          type: 'question',
          sectionId: 'sec_mcq',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content:
              'What is the primary purpose of a message queue in system design?',
            explanation:
              'Message queues enable asynchronous processing and decouple producers from consumers, allowing systems to handle spikes in traffic and process tasks independently.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                {
                  id: 'a',
                  text: 'Asynchronous processing & decoupling',
                  isCorrect: true,
                },
                { id: 'b', text: 'Database replication', isCorrect: false },
                { id: 'c', text: 'User authentication', isCorrect: false },
                { id: 'd', text: 'File storage', isCorrect: false },
              ],
            },
          },
        },
        // 2. MCQ — medium
        {
          title: 'Eventual consistency model',
          type: 'question',
          sectionId: 'sec_mcq',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content:
              'Which consistency model does eventual consistency belong to?',
            explanation:
              'Eventual consistency is a form of weak consistency where the system guarantees that, given enough time without new updates, all replicas will converge to the same value.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Weak consistency', isCorrect: true },
                { id: 'b', text: 'Strong consistency', isCorrect: false },
                { id: 'c', text: 'Immediate consistency', isCorrect: false },
                { id: 'd', text: 'Causal consistency', isCorrect: false },
              ],
            },
          },
        },
        // 3. True/False — easy
        {
          title: 'Microservices always outperform monoliths',
          type: 'question',
          sectionId: 'sec_mcq',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content:
              'A microservices architecture always performs better than a monolith.',
            explanation:
              'False. Microservices introduce network overhead, operational complexity, and distributed system challenges. Monoliths can be simpler and faster for small to medium applications.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: false },
          },
        },
        // 4. MCQ — medium
        {
          title: 'What does a reverse proxy do?',
          type: 'question',
          sectionId: 'sec_mcq',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What does a reverse proxy do?',
            explanation:
              'A reverse proxy sits in front of backend servers and forwards client requests to them. It can provide load balancing, SSL termination, caching, and security.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                {
                  id: 'a',
                  text: 'Sits in front of servers and forwards client requests',
                  isCorrect: true,
                },
                {
                  id: 'b',
                  text: 'Sits in front of clients and masks their identity',
                  isCorrect: false,
                },
                {
                  id: 'c',
                  text: 'Encrypts database connections',
                  isCorrect: false,
                },
                { id: 'd', text: 'Manages DNS records', isCorrect: false },
              ],
            },
          },
        },
        // 5. Numerical — hard
        {
          title: 'Uptime downtime calculation',
          type: 'question',
          sectionId: 'sec_mcq',
          difficulty: 'hard',
          payload: {
            questionType: 'numerical',
            content:
              'If a system has 99.9% uptime, approximately how many minutes of downtime does it have per year?',
            explanation:
              'Total minutes/year = 365.25 × 24 × 60 = 525,960. Downtime = 0.1% = 525,960 × 0.001 ≈ 526 minutes.',
            basePoints: 15,
            difficulty: 'hard',
            questionData: { correctAnswer: 526, tolerance: 5 },
          },
        },
        // 6. Paragraph — hard
        {
          title: 'Design a URL shortener',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content:
              'Design a URL shortener like bit.ly. Describe the key components, APIs, database schema, and how you would handle high traffic.',
            explanation:
              'A comprehensive answer should cover API design (POST /shorten, GET /:code), database schema (short_code, original_url, created_at), base62 encoding, collision handling, caching, and rate limiting.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              modelAnswer:
                'Key Components:\n1. API Gateway: Rate limiting, authentication\n2. Application Servers: Generate short codes, handle redirects\n3. Database: Store URL mappings\n4. Cache (Redis): Cache frequently accessed short URLs\n5. Analytics Service: Track click counts, referrers\n\nAPIs:\n- POST /api/shorten { url: "https://..." } → { shortUrl: "https://short.ly/abc123" }\n- GET /:shortCode → 301 Redirect to original URL\n\nDatabase Schema:\nurls (id BIGINT PK, short_code VARCHAR(7) UNIQUE INDEX, original_url TEXT, user_id INT, created_at TIMESTAMP, expires_at TIMESTAMP)\n\nShort Code Generation:\nUse base62 encoding (a-z, A-Z, 0-9) of an auto-increment ID or a counter service. 7 characters = 62^7 ≈ 3.5 trillion unique URLs.\n\nHigh Traffic Handling:\n- Cache hot URLs in Redis (90%+ of redirects are for a small set of URLs)\n- Use database read replicas for redirect lookups\n- CDN for geographic distribution\n- Rate limit URL creation per user\n- Async analytics processing via message queue',
              minLength: 200,
              maxLength: 3000,
            },
          },
        },
        // 7. Paragraph — hard
        {
          title: 'Design a notification system',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content:
              'Design a notification system that supports email, SMS, and push notifications. How would you handle millions of notifications per day?',
            explanation:
              'A strong answer covers message queues for async processing, provider abstraction, template management, user preferences, rate limiting, retry logic, and observability.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              modelAnswer:
                'Architecture:\n1. Notification Service API: Receives notification requests from other services\n2. Message Queue (Kafka/SQS): Buffers notifications for async processing\n3. Priority Router: Routes to correct channel workers based on type and priority\n4. Channel Workers: Separate worker pools for email (SendGrid), SMS (Twilio), push (FCM/APNs)\n5. Template Engine: Manages notification templates with variable substitution\n6. User Preference Service: Stores user channel preferences and quiet hours\n7. Rate Limiter: Prevents notification spam per user/channel\n\nHandling Millions/Day:\n- Horizontally scale workers per channel independently\n- Use Kafka partitions for parallel processing (partition by user_id)\n- Batch email sends where possible (digest mode)\n- Circuit breakers for third-party provider failures\n- Retry with exponential backoff for transient failures\n- Dead letter queue for permanently failed notifications\n\nData Model:\nnotifications (id, user_id, type, channel, template_id, payload JSON, status, created_at, sent_at)\nuser_preferences (user_id, channel, enabled, quiet_start, quiet_end)\ntemplates (id, name, channel, subject, body_template)',
              minLength: 200,
              maxLength: 3000,
            },
          },
        },
        // 8. Text — medium
        {
          title: 'Key production monitoring metrics',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content:
              'Name three key metrics you would monitor for a production distributed system.',
            explanation:
              'Essential metrics include latency (p50/p95/p99), throughput (requests per second), error rate (4xx/5xx), CPU/memory utilization, and queue depth.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 300,
              correctAnswer:
                'Latency (response time), throughput (requests per second), error rate (percentage of failed requests)',
              acceptableAnswers: [
                'Latency, throughput, error rate',
                'Response time, RPS, error percentage',
                'P99 latency, QPS, availability',
              ],
            },
          },
        },
      ],
    },
  ],
};
