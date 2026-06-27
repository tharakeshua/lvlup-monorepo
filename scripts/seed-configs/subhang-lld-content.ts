/**
 * LLD Space — Low-Level Design & OOP seed configuration
 * 12 story points × ~7 items = ~84 items total
 */
import type { SpaceSeed } from './subhang-content.js';

export const lldSpace: SpaceSeed = {
  title: 'Low-Level Design & OOP',
  description: 'Master object-oriented design, SOLID principles, design patterns, and low-level system design for staff-level interviews.',
  subject: 'Software Engineering',
  classIds: [],
  teacherIndex: 0,
  type: 'hybrid',
  storyPoints: [
    // SP1: OOP Fundamentals & SOLID
    {
      title: 'OOP Fundamentals & SOLID Principles',
      description: 'Encapsulation, inheritance, polymorphism, abstraction, and SOLID principles with examples.',
      type: 'standard',
      sections: [
        { id: 'sec_oop', title: 'OOP Concepts', orderIndex: 0 },
        { id: 'sec_solid', title: 'SOLID Principles', orderIndex: 1 },
      ],
      items: [
        {
          title: 'OOP & SOLID Overview',
          type: 'material',
          sectionId: 'sec_oop',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'OOP & SOLID Principles',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Four Pillars of OOP', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Encapsulation: Bundle data and methods, hide internal state. Use private fields + public getters/setters.',
                  'Abstraction: Expose only relevant details. Abstract classes and interfaces define contracts without implementation.',
                  'Inheritance: Create new classes from existing ones. Promotes code reuse but can lead to tight coupling.',
                  'Polymorphism: Same interface, different implementations. Method overriding (runtime) and overloading (compile-time).',
                ] } },
                { id: 'b3', type: 'heading', content: 'SOLID Principles', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'S — Single Responsibility: A class should have only one reason to change.',
                  'O — Open/Closed: Open for extension, closed for modification.',
                  'L — Liskov Substitution: Subtypes must be substitutable for their base types.',
                  'I — Interface Segregation: Many specific interfaces are better than one general-purpose interface.',
                  'D — Dependency Inversion: Depend on abstractions, not concretions.',
                ] } },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'SOLID principle identification',
          type: 'question',
          sectionId: 'sec_solid',
          difficulty: 'easy',
          payload: {
            questionType: 'matching',
            content: 'Match each SOLID principle to its description:',
            explanation: 'S=one reason to change, O=extend without modifying, L=subtypes replaceable, I=specific interfaces, D=depend on abstractions.',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Single Responsibility', right: 'One reason to change' },
                { id: 'p2', left: 'Open/Closed', right: 'Extend without modifying' },
                { id: 'p3', left: 'Liskov Substitution', right: 'Subtypes are replaceable' },
                { id: 'p4', left: 'Dependency Inversion', right: 'Depend on abstractions' },
              ],
            },
          },
        },
        {
          title: 'Composition vs Inheritance',
          type: 'question',
          sectionId: 'sec_oop',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'Why is "composition over inheritance" generally preferred in modern OOP?',
            explanation: 'Composition provides more flexibility, avoids deep inheritance hierarchies, and allows behavior to be changed at runtime by swapping components.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'More flexible, avoids tight coupling, enables runtime behavior changes', isCorrect: true },
                { id: 'b', text: 'Composition is always faster than inheritance', isCorrect: false },
                { id: 'c', text: 'Inheritance is deprecated in modern languages', isCorrect: false },
                { id: 'd', text: 'Composition uses less memory', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Liskov violation example',
          type: 'question',
          sectionId: 'sec_solid',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain the classic Rectangle-Square problem as a violation of the Liskov Substitution Principle. How would you fix it?',
            explanation: 'Square inheriting from Rectangle violates LSP because setting width on a Square also changes height, breaking Rectangle\'s contract.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'If Square extends Rectangle and overrides setWidth() to also set height (and vice versa), code expecting a Rectangle will break. For example: rect.setWidth(5); rect.setHeight(10); assert(rect.area() == 50) fails for a Square (area would be 100). Fix: Don\'t make Square extend Rectangle. Instead, use a Shape interface with an area() method, and have both Rectangle and Square implement it independently. Or use immutable value objects where width and height are set at construction time.',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Encapsulation benefit',
          type: 'question',
          sectionId: 'sec_oop',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'Encapsulation allows changing internal implementation without affecting external code that uses the class.',
            explanation: 'True. By hiding internal state behind public methods, you can change how data is stored or computed without breaking clients.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'SRP violation detection',
          type: 'question',
          sectionId: 'sec_solid',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'A UserService class has methods: authenticate(), sendEmail(), generateReport(), updateProfile(). Which methods likely violate SRP?',
            explanation: 'sendEmail (email service responsibility) and generateReport (reporting responsibility) don\'t belong in a UserService.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'sendEmail()', isCorrect: true },
                { id: 'b', text: 'generateReport()', isCorrect: true },
                { id: 'c', text: 'authenticate()', isCorrect: false },
                { id: 'd', text: 'updateProfile()', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Interface Segregation',
          type: 'question',
          sectionId: 'sec_solid',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'The Interface Segregation Principle states that no client should be forced to depend on _____ it does not use.',
            explanation: 'ISP advocates for many small, specific interfaces rather than large, general ones. Clients should only know about methods they actually need.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'The Interface Segregation Principle states that no client should be forced to depend on {{blank1}} it does not use.',
              blanks: [
                { id: 'blank1', correctAnswer: 'methods', acceptableAnswers: ['methods', 'interfaces', 'abstractions'], caseSensitive: false },
              ],
            },
          },
        },
      ],
    },

    // SP2: Creational Patterns
    {
      title: 'Design Patterns — Creational',
      description: 'Singleton, Factory, Abstract Factory, Builder, Prototype — when and why.',
      type: 'standard',
      sections: [
        { id: 'sec_theory', title: 'Pattern Theory', orderIndex: 0 },
        { id: 'sec_apply', title: 'Application', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Creational Patterns Overview',
          type: 'material',
          sectionId: 'sec_theory',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Creational Design Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Overview', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Creational patterns deal with object creation mechanisms, trying to create objects in a manner suitable to the situation. They decouple the client from the concrete classes it needs to instantiate.' },
                { id: 'b3', type: 'code', content: '// Singleton (thread-safe with lazy initialization)\nclass DatabaseConnection {\n  private static instance: DatabaseConnection;\n  private constructor() { /* private */ }\n  static getInstance(): DatabaseConnection {\n    if (!this.instance) this.instance = new DatabaseConnection();\n    return this.instance;\n  }\n}\n\n// Factory Method\ninterface Notification { send(message: string): void; }\nclass EmailNotification implements Notification { send(msg: string) { /* email */ } }\nclass SMSNotification implements Notification { send(msg: string) { /* sms */ } }\n\nfunction createNotification(type: string): Notification {\n  switch (type) {\n    case \'email\': return new EmailNotification();\n    case \'sms\': return new SMSNotification();\n    default: throw new Error(\'Unknown type\');\n  }\n}\n\n// Builder\nclass QueryBuilder {\n  private table = \'\';\n  private conditions: string[] = [];\n  private limit?: number;\n  from(table: string) { this.table = table; return this; }\n  where(cond: string) { this.conditions.push(cond); return this; }\n  take(n: number) { this.limit = n; return this; }\n  build(): string {\n    let sql = `SELECT * FROM ${this.table}`;\n    if (this.conditions.length) sql += ` WHERE ${this.conditions.join(\' AND \')}`;\n    if (this.limit) sql += ` LIMIT ${this.limit}`;\n    return sql;\n  }\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Singleton use case',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Which scenario is most appropriate for the Singleton pattern?',
            explanation: 'Singleton ensures exactly one instance exists. Database connection pools and loggers are classic use cases where sharing a single instance across the application makes sense.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Database connection pool shared across the application', isCorrect: true },
                { id: 'b', text: 'Creating different types of vehicles', isCorrect: false },
                { id: 'c', text: 'Building complex SQL queries step by step', isCorrect: false },
                { id: 'd', text: 'Cloning existing objects', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Factory vs Abstract Factory',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain the difference between Factory Method and Abstract Factory patterns. When would you use each?',
            explanation: 'Factory Method creates one product through subclassing. Abstract Factory creates families of related products through composition.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'Factory Method: Defines an interface for creating an object but lets subclasses decide which class to instantiate. Uses inheritance. Example: a Document class with createPage() method overridden by PDFDocument and HTMLDocument.\n\nAbstract Factory: Provides an interface for creating families of related objects without specifying concrete classes. Uses composition. Example: UIFactory with createButton(), createTextBox() — implemented by WindowsFactory and MacFactory, each creating platform-specific widgets.\n\nUse Factory Method when you have one product type with variations. Use Abstract Factory when you need to create families of related products that must be used together.',
              minLength: 80,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Builder pattern benefit',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL benefits of the Builder pattern:',
            explanation: 'Builder separates construction from representation, allows step-by-step object creation, and produces readable code for complex objects.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Avoids telescoping constructors', isCorrect: true },
                { id: 'b', text: 'Allows step-by-step object construction', isCorrect: true },
                { id: 'c', text: 'Ensures exactly one instance exists', isCorrect: false },
                { id: 'd', text: 'Enables runtime class selection', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Pattern to use case matching',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each creational pattern to its best use case:',
            explanation: 'Each pattern solves a specific object creation problem.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Singleton', right: 'Global logging service' },
                { id: 'p2', left: 'Factory Method', right: 'Payment processor selection' },
                { id: 'p3', left: 'Builder', right: 'Complex query construction' },
                { id: 'p4', left: 'Prototype', right: 'Cloning expensive objects' },
              ],
            },
          },
        },
        {
          title: 'Singleton thread safety',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'hard',
          payload: {
            questionType: 'code',
            content: 'Implement a thread-safe Singleton in TypeScript that lazily initializes a configuration object. Include a method to get configuration values.',
            explanation: 'In JavaScript/TypeScript, the single-threaded event loop makes basic lazy initialization thread-safe, but the pattern demonstrates the concept.',
            basePoints: 20,
            difficulty: 'hard',
            questionData: {
              language: 'typescript',
              starterCode: '// Thread-safe Singleton',
              modelAnswer: 'class Config {\n  private static instance: Config | null = null;\n  private settings: Map<string, string> = new Map();\n\n  private constructor() {\n    // Load defaults\n    this.settings.set(\'env\', \'production\');\n    this.settings.set(\'logLevel\', \'info\');\n  }\n\n  static getInstance(): Config {\n    if (!Config.instance) {\n      Config.instance = new Config();\n    }\n    return Config.instance;\n  }\n\n  get(key: string): string | undefined {\n    return this.settings.get(key);\n  }\n\n  set(key: string, value: string): void {\n    this.settings.set(key, value);\n  }\n}',
            },
          },
        },
        {
          title: 'Prototype cloning',
          type: 'question',
          sectionId: 'sec_apply',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'The Prototype pattern creates new objects by cloning existing instances rather than using constructors.',
            explanation: 'True. Prototype pattern copies an existing object (the prototype) to create new instances, useful when object creation is expensive.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
      ],
    },

    // SP3: Structural Patterns
    {
      title: 'Design Patterns — Structural',
      description: 'Adapter, Bridge, Composite, Decorator, Facade, Proxy — real-world usage.',
      type: 'standard',
      sections: [
        { id: 'sec_patterns', title: 'Pattern Details', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Structural Patterns Overview',
          type: 'material',
          sectionId: 'sec_patterns',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Structural Design Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Overview', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Structural patterns deal with object composition, creating relationships between objects to form larger structures while keeping them flexible and efficient.' },
                { id: 'b3', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Adapter: Converts one interface to another. Wraps an incompatible object.',
                  'Decorator: Adds behavior dynamically without modifying the original class. Wraps and extends.',
                  'Facade: Provides a simplified interface to a complex subsystem.',
                  'Proxy: Controls access to another object. Types: virtual, protection, remote, caching.',
                  'Composite: Tree structure where individual objects and compositions are treated uniformly.',
                  'Bridge: Separates abstraction from implementation so both can vary independently.',
                ] } },
              ],
              readingTime: 6,
            },
          },
        },
        {
          title: 'Adapter vs Decorator',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What is the key difference between Adapter and Decorator?',
            explanation: 'Adapter changes the interface to make incompatible things work together. Decorator keeps the same interface but adds behavior.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Adapter changes the interface; Decorator adds behavior while keeping the same interface', isCorrect: true },
                { id: 'b', text: 'Decorator is for inheritance; Adapter is for composition', isCorrect: false },
                { id: 'c', text: 'Adapter adds functionality; Decorator changes interfaces', isCorrect: false },
                { id: 'd', text: 'They are the same pattern with different names', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Facade pattern benefit',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'The Facade pattern reduces dependencies between client code and complex subsystem classes.',
            explanation: 'True. Facade provides a unified, simplified interface, shielding clients from the complexity of the subsystem.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'Proxy types',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each Proxy type to its purpose:',
            explanation: 'Virtual proxy delays expensive creation. Protection proxy controls access. Caching proxy stores results. Remote proxy represents a remote object locally.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Virtual Proxy', right: 'Lazy initialization of expensive objects' },
                { id: 'p2', left: 'Protection Proxy', right: 'Access control and permissions' },
                { id: 'p3', left: 'Caching Proxy', right: 'Store and reuse expensive operation results' },
                { id: 'p4', left: 'Remote Proxy', right: 'Local representative of a remote object' },
              ],
            },
          },
        },
        {
          title: 'Composite pattern application',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain how the Composite pattern works for a file system with files and directories. What interface do both share?',
            explanation: 'Both File and Directory implement a FileSystemComponent interface with methods like getSize(). Directory contains a list of components.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'Define a FileSystemComponent interface with methods like getSize(), getName(), display(). File implements it directly (getSize returns file size). Directory implements it and contains a list of FileSystemComponent children. Directory.getSize() sums children\'s sizes recursively. This lets client code treat files and directories uniformly — you can call getSize() on any component without knowing if it\'s a file or directory. The tree structure naturally represents nested directories.',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Decorator real-world example',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'code',
            content: 'Implement a Decorator pattern for a notification system where you can stack decorators: LoggingDecorator, EncryptionDecorator on a base EmailNotifier.',
            explanation: 'Each decorator wraps a Notifier and adds behavior before/after delegating to the wrapped notifier.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              language: 'typescript',
              starterCode: '// Implement Decorator pattern for notifications',
              modelAnswer: 'interface Notifier {\n  send(message: string): void;\n}\n\nclass EmailNotifier implements Notifier {\n  send(message: string) {\n    console.log(`Email sent: ${message}`);\n  }\n}\n\nclass NotifierDecorator implements Notifier {\n  constructor(protected wrapped: Notifier) {}\n  send(message: string) { this.wrapped.send(message); }\n}\n\nclass LoggingDecorator extends NotifierDecorator {\n  send(message: string) {\n    console.log(`[LOG] Sending: ${message}`);\n    super.send(message);\n    console.log(`[LOG] Sent successfully`);\n  }\n}\n\nclass EncryptionDecorator extends NotifierDecorator {\n  send(message: string) {\n    const encrypted = btoa(message); // simple encoding\n    super.send(encrypted);\n  }\n}\n\n// Usage: const notifier = new LoggingDecorator(new EncryptionDecorator(new EmailNotifier()));',
            },
          },
        },
        {
          title: 'Bridge pattern purpose',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'The Bridge pattern is used to:',
            explanation: 'Bridge decouples abstraction from implementation, allowing both to vary independently. Example: Shape (abstraction) × Color (implementation).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Separate abstraction from implementation so both can evolve independently', isCorrect: true },
                { id: 'b', text: 'Convert one interface to another', isCorrect: false },
                { id: 'c', text: 'Add behavior to objects dynamically', isCorrect: false },
                { id: 'd', text: 'Provide a simplified interface to a subsystem', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // SP4: Behavioral Patterns
    {
      title: 'Design Patterns — Behavioral',
      description: 'Observer, Strategy, Command, State, Chain of Responsibility, Template Method.',
      type: 'standard',
      sections: [
        { id: 'sec_patterns', title: 'Patterns', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Behavioral Patterns Overview',
          type: 'material',
          sectionId: 'sec_patterns',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Behavioral Design Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Key Patterns', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Observer: Define a one-to-many dependency so when one object changes, all dependents are notified.',
                  'Strategy: Define a family of algorithms, encapsulate each one, and make them interchangeable at runtime.',
                  'Command: Encapsulate a request as an object, enabling undo/redo, queuing, and logging.',
                  'State: Allow an object to alter its behavior when its internal state changes (appears to change class).',
                  'Chain of Responsibility: Pass request along a chain of handlers until one handles it.',
                  'Template Method: Define algorithm skeleton in base class, defer steps to subclasses.',
                ] } },
                { id: 'b3', type: 'code', content: '// Strategy Pattern\ninterface SortStrategy {\n  sort(data: number[]): number[];\n}\nclass QuickSort implements SortStrategy {\n  sort(data: number[]) { return [...data].sort((a, b) => a - b); }\n}\nclass MergeSort implements SortStrategy {\n  sort(data: number[]) { /* merge sort impl */ return data; }\n}\nclass Sorter {\n  constructor(private strategy: SortStrategy) {}\n  setStrategy(s: SortStrategy) { this.strategy = s; }\n  sort(data: number[]) { return this.strategy.sort(data); }\n}\n\n// Observer Pattern\nclass EventEmitter {\n  private listeners = new Map<string, Function[]>();\n  on(event: string, fn: Function) {\n    if (!this.listeners.has(event)) this.listeners.set(event, []);\n    this.listeners.get(event)!.push(fn);\n  }\n  emit(event: string, ...args: any[]) {\n    for (const fn of this.listeners.get(event) ?? []) fn(...args);\n  }\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Strategy vs State',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What is the key difference between Strategy and State patterns?',
            explanation: 'Strategy: client selects the algorithm. State: object automatically transitions between behaviors based on internal state.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Strategy is selected by client; State transitions automatically based on internal state', isCorrect: true },
                { id: 'b', text: 'Strategy uses inheritance; State uses composition', isCorrect: false },
                { id: 'c', text: 'They are identical patterns', isCorrect: false },
                { id: 'd', text: 'State can only have two states; Strategy can have many', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Observer pattern use case',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL valid use cases for the Observer pattern:',
            explanation: 'Observer is for event-driven scenarios: UI events, pub-sub messaging, reactive data binding. Database queries are request-response, not event-driven.',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'UI event handling (click listeners)', isCorrect: true },
                { id: 'b', text: 'Publish-subscribe messaging', isCorrect: true },
                { id: 'c', text: 'Reactive data binding in UI frameworks', isCorrect: true },
                { id: 'd', text: 'Database query execution', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Command pattern for undo',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Design an undo/redo system using the Command pattern. Explain the interfaces, how commands are stored, and how undo/redo work.',
            explanation: 'Commands encapsulate actions with execute() and undo(). An undo stack stores executed commands, a redo stack stores undone commands.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Interface Command { execute(): void; undo(): void; }\n\nEach action (InsertTextCommand, DeleteTextCommand, etc.) implements Command with execute() performing the action and undo() reversing it.\n\nCommandHistory class maintains two stacks:\n- undoStack: commands that have been executed\n- redoStack: commands that have been undone\n\nExecute: command.execute(), push to undoStack, clear redoStack.\nUndo: pop from undoStack, call command.undo(), push to redoStack.\nRedo: pop from redoStack, call command.execute(), push to undoStack.\n\nThis cleanly separates the action logic from the history management.',
              minLength: 80,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Chain of Responsibility',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'In the Chain of Responsibility pattern, what happens if no handler in the chain can handle the request?',
            explanation: 'The request reaches the end of the chain unhandled. Implementations typically have a default handler at the end or return a "not handled" result.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'The request falls through unhandled (or hits a default handler)', isCorrect: true },
                { id: 'b', text: 'The first handler is forced to handle it', isCorrect: false },
                { id: 'c', text: 'An exception is automatically thrown', isCorrect: false },
                { id: 'd', text: 'The chain restarts from the beginning', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Template Method pattern',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'The Template Method pattern defines the _____ of an algorithm in a base class, letting subclasses override specific steps.',
            explanation: 'Template Method defines the skeleton (overall structure) in the base class. Subclasses provide implementations for individual steps.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'The Template Method pattern defines the {{blank1}} of an algorithm in a base class, letting subclasses override specific steps.',
              blanks: [
                { id: 'blank1', correctAnswer: 'skeleton', acceptableAnswers: ['skeleton', 'structure', 'outline', 'framework'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'Pattern identification',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each scenario to the appropriate behavioral pattern:',
            explanation: 'Payment processing = Strategy. Vending machine = State. Text editor undo = Command. HTTP middleware = Chain of Responsibility.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Payment processing (PayPal/Stripe/Cash)', right: 'Strategy' },
                { id: 'p2', left: 'Vending machine states (idle/selecting/dispensing)', right: 'State' },
                { id: 'p3', left: 'Text editor with undo/redo', right: 'Command' },
                { id: 'p4', left: 'HTTP request middleware pipeline', right: 'Chain of Responsibility' },
              ],
            },
          },
        },
      ],
    },

    // SP5: Clean Architecture & DI
    {
      title: 'Clean Architecture & Dependency Injection',
      description: 'Layered architecture, hexagonal architecture, DI containers, and testability.',
      type: 'practice',
      sections: [
        { id: 'sec_arch', title: 'Architecture', orderIndex: 0 },
        { id: 'sec_di', title: 'Dependency Injection', orderIndex: 1 },
      ],
      items: [
        { title: 'Clean Architecture Principles', type: 'material', sectionId: 'sec_arch', payload: { materialType: 'rich', richContent: { title: 'Clean Architecture', blocks: [
          { id: 'b1', type: 'heading', content: 'The Dependency Rule', metadata: { level: 2 } },
          { id: 'b2', type: 'paragraph', content: 'In Clean Architecture, source code dependencies must point inward. Inner layers (domain/entities) know nothing about outer layers (frameworks, UI, databases). The dependency rule ensures that business logic is independent of delivery mechanisms.' },
          { id: 'b3', type: 'list', content: '', metadata: { listType: 'unordered', items: ['Entities: Enterprise business rules, pure domain objects', 'Use Cases: Application business rules, orchestrate entities', 'Interface Adapters: Convert data between use cases and external formats', 'Frameworks & Drivers: UI, DB, web frameworks — outermost layer'] } },
        ], readingTime: 6 } } },
        { title: 'Dependency rule direction', type: 'question', sectionId: 'sec_arch', difficulty: 'easy', payload: { questionType: 'mcq', content: 'In Clean Architecture, dependencies should point:', explanation: 'The dependency rule: outer layers depend on inner layers, never the reverse. Inner layers are the most stable and abstract.', basePoints: 10, difficulty: 'easy', questionData: { options: [{ id: 'a', text: 'Inward — from frameworks toward domain entities', isCorrect: true }, { id: 'b', text: 'Outward — from entities toward frameworks', isCorrect: false }, { id: 'c', text: 'In both directions equally', isCorrect: false }, { id: 'd', text: 'There is no specific direction', isCorrect: false }] } } },
        { title: 'Hexagonal architecture ports', type: 'question', sectionId: 'sec_arch', difficulty: 'medium', payload: { questionType: 'paragraph', content: 'Explain ports and adapters in Hexagonal Architecture. How do they enable testability?', explanation: 'Ports are interfaces defined by the domain. Adapters are implementations for specific technologies.', basePoints: 20, difficulty: 'medium', questionData: { modelAnswer: 'Ports are interfaces that define how the application core communicates with the outside world. Primary ports (driving) define use case inputs. Secondary ports (driven) define dependencies the core needs (e.g., repository interfaces). Adapters implement these ports for specific technologies — a PostgresUserRepository adapter implements the UserRepository port. For testing, swap real adapters with mock/in-memory adapters. The domain core never changes — only adapters are swapped. This makes the business logic fully testable without any infrastructure dependencies.', minLength: 60, maxLength: 1500 } } },
        { title: 'DI benefits', type: 'question', sectionId: 'sec_di', difficulty: 'medium', payload: { questionType: 'mcaq', content: 'Select ALL benefits of Dependency Injection:', explanation: 'DI improves testability (inject mocks), reduces coupling (depend on interfaces), and enables configuration flexibility.', basePoints: 15, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Improved testability via mock injection', isCorrect: true }, { id: 'b', text: 'Loose coupling between components', isCorrect: true }, { id: 'c', text: 'Faster runtime performance', isCorrect: false }, { id: 'd', text: 'Reduced memory usage', isCorrect: false }] } } },
        { title: 'Constructor injection', type: 'question', sectionId: 'sec_di', difficulty: 'easy', payload: { questionType: 'true-false', content: 'Constructor injection is generally preferred over setter injection because it ensures dependencies are available when the object is created.', explanation: 'True. Constructor injection makes dependencies explicit, ensures they are provided at creation time, and supports immutability.', basePoints: 10, difficulty: 'easy', questionData: { correctAnswer: true } } },
        { title: 'Layer responsibility', type: 'question', sectionId: 'sec_arch', difficulty: 'medium', payload: { questionType: 'matching', content: 'Match each Clean Architecture layer to its responsibility:', explanation: 'Entities hold business rules, Use Cases orchestrate flows, Interface Adapters convert data, Frameworks provide infrastructure.', basePoints: 15, difficulty: 'medium', questionData: { pairs: [{ id: 'p1', left: 'Entities', right: 'Enterprise business rules' }, { id: 'p2', left: 'Use Cases', right: 'Application-specific business rules' }, { id: 'p3', left: 'Interface Adapters', right: 'Data format conversion (controllers, presenters)' }, { id: 'p4', left: 'Frameworks & Drivers', right: 'Database, web server, UI framework' }] } } },
        { title: 'Inversion of Control', type: 'question', sectionId: 'sec_di', difficulty: 'medium', payload: { questionType: 'fill-blanks', content: 'Dependency Injection is one form of the broader principle called Inversion of _____.', explanation: 'Inversion of Control (IoC) is the principle where framework calls user code rather than user code calling framework code. DI is one technique for achieving IoC.', basePoints: 10, difficulty: 'medium', questionData: { textWithBlanks: 'Dependency Injection is one form of the broader principle called Inversion of {{blank1}}.', blanks: [{ id: 'blank1', correctAnswer: 'Control', acceptableAnswers: ['Control', 'control', 'IoC'], caseSensitive: false }] } } },
      ],
    },

    // SP6-9: LLD Design Problems (compact format)
    {
      title: 'LLD — Parking Lot & Elevator System',
      description: 'Class diagrams, state machines, concurrency handling, extensibility.',
      type: 'practice',
      sections: [{ id: 'sec_design', title: 'Design', orderIndex: 0 }, { id: 'sec_questions', title: 'Questions', orderIndex: 1 }],
      items: [
        { title: 'Parking Lot System Design', type: 'material', sectionId: 'sec_design', payload: { materialType: 'rich', richContent: { title: 'LLD: Parking Lot System', blocks: [{ id: 'b1', type: 'heading', content: 'Requirements', metadata: { level: 2 } }, { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: ['Multiple floors with different spot sizes (compact, regular, large)', 'Vehicle types: motorcycle, car, bus', 'Entry/exit with ticket generation', 'Hourly pricing, payment processing', 'Real-time availability tracking'] } }, { id: 'b3', type: 'heading', content: 'Key Classes', metadata: { level: 2 } }, { id: 'b4', type: 'paragraph', content: 'ParkingLot (singleton) → ParkingFloor[] → ParkingSpot[] (abstract, subclassed by size). Vehicle (abstract) → Car, Motorcycle, Bus. Ticket tracks entry time, vehicle, spot. PaymentProcessor handles pricing.' }], readingTime: 7 } } },
        { title: 'Parking spot assignment', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'paragraph', content: 'Design the spot assignment algorithm for a parking lot. How would you efficiently find the nearest available spot of the right size?', explanation: 'Use a min-heap per spot size per floor, ordered by distance from entrance.', basePoints: 20, difficulty: 'medium', questionData: { modelAnswer: 'Maintain a PriorityQueue<ParkingSpot> per floor per spot size, ordered by distance from entrance. When a vehicle enters: 1) Determine required spot size. 2) Search floors from entrance for first non-empty queue of matching size. 3) Poll the nearest spot. Mark as occupied. When vehicle exits: add spot back to the queue. Time: O(log n) for assign/release. For multi-floor: iterate floors in order, return first available. This gives the nearest spot efficiently.', minLength: 60, maxLength: 1500 } } },
        { title: 'Elevator state machine', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Design the state machine for an elevator system. List the states, transitions, and how multiple elevator scheduling works (e.g., LOOK algorithm).', explanation: 'States: IDLE, MOVING_UP, MOVING_DOWN, DOOR_OPEN. Scheduler assigns nearest elevator moving in the right direction.', basePoints: 30, difficulty: 'hard', questionData: { modelAnswer: 'States: IDLE (waiting), MOVING_UP, MOVING_DOWN, DOOR_OPEN, MAINTENANCE.\n\nTransitions: IDLE→MOVING_UP/DOWN (request received), MOVING→DOOR_OPEN (reached target floor), DOOR_OPEN→MOVING (more requests in same direction), DOOR_OPEN→IDLE (no more requests).\n\nLOOK Algorithm: Elevator continues in current direction, servicing requests. At each floor, check if anyone wants to get on/off. Only reverse when no more requests in current direction. This minimizes total travel.\n\nMultiple elevator scheduling: For a new request, find the elevator that minimizes response time. Prefer: 1) Moving toward the request in the same direction, 2) IDLE elevator nearest to the floor, 3) Moving away but will reverse and reach it.', minLength: 100, maxLength: 2000 } } },
        { title: 'Concurrency in parking', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'mcq', content: 'How would you handle concurrent parking requests for the last available spot?', explanation: 'Use optimistic locking or a mutex/lock on the spot assignment operation to prevent double-booking.', basePoints: 15, difficulty: 'hard', questionData: { options: [{ id: 'a', text: 'Use a lock/mutex on spot assignment to prevent race conditions', isCorrect: true }, { id: 'b', text: 'Allow double-booking and fix later', isCorrect: false }, { id: 'c', text: 'Reject all concurrent requests', isCorrect: false }, { id: 'd', text: 'Use eventual consistency', isCorrect: false }] } } },
        { title: 'Vehicle-spot compatibility', type: 'question', sectionId: 'sec_questions', difficulty: 'easy', payload: { questionType: 'true-false', content: 'A motorcycle can park in any size spot (compact, regular, or large), but a bus can only park in a large spot.', explanation: 'True. Smaller vehicles can use larger spots, but larger vehicles cannot use smaller spots.', basePoints: 10, difficulty: 'easy', questionData: { correctAnswer: true } } },
        { title: 'Design pattern in parking lot', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which design pattern is most appropriate for the ParkingLot class to ensure only one instance exists?', explanation: 'Singleton ensures a single ParkingLot instance manages all floors and spots globally.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Singleton', isCorrect: true }, { id: 'b', text: 'Factory', isCorrect: false }, { id: 'c', text: 'Observer', isCorrect: false }, { id: 'd', text: 'Strategy', isCorrect: false }] } } },
        { title: 'Extensibility for EV charging', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'paragraph', content: 'How would you extend the parking lot design to support EV charging spots without modifying existing code?', explanation: 'Open/Closed Principle: create an EVChargingSpot subclass of ParkingSpot.', basePoints: 20, difficulty: 'medium', questionData: { modelAnswer: 'Apply Open/Closed Principle: Create EVChargingSpot extending ParkingSpot with additional charger state (available/charging/complete), charging rate, and connector type. Add an EVChargingManager service that handles charging sessions. The existing ParkingLot, Vehicle, and Ticket classes remain unchanged. EVChargingSpot is just another spot type. Add a new EVChargingTicket or extend the existing Ticket with optional charging data. This keeps existing code stable while adding new functionality.', minLength: 60, maxLength: 1500 } } },
      ],
    },

    { title: 'LLD — Library Management & Hotel Booking', description: 'Entity relationships, booking conflicts, payment integration patterns.', type: 'practice',
      sections: [{ id: 'sec_design', title: 'Design', orderIndex: 0 }, { id: 'sec_questions', title: 'Questions', orderIndex: 1 }],
      items: [
        { title: 'Library & Hotel Systems', type: 'material', sectionId: 'sec_design', payload: { materialType: 'rich', richContent: { title: 'Library & Hotel LLD', blocks: [{ id: 'b1', type: 'heading', content: 'Library Management', metadata: { level: 2 } }, { id: 'b2', type: 'paragraph', content: 'Key entities: Book (ISBN, title, author), BookItem (physical copy with barcode), Member, Librarian, Loan (member, bookItem, dueDate, returnDate), Fine. A Book can have multiple BookItems. Members borrow BookItems, not Books. The system tracks availability, overdue items, and fines.' }, { id: 'b3', type: 'heading', content: 'Hotel Booking', metadata: { level: 2 } }, { id: 'b4', type: 'paragraph', content: 'Key entities: Hotel, Room (type, rate, floor), Guest, Reservation (guest, room, checkIn, checkOut, status), Payment. Room types: Standard, Deluxe, Suite. Reservations must handle conflicts — no double-booking. Check availability by querying existing reservations for date overlap.' }], readingTime: 7 } } },
        { title: 'Book vs BookItem', type: 'question', sectionId: 'sec_questions', difficulty: 'easy', payload: { questionType: 'mcq', content: 'Why separate Book from BookItem in a library system?', explanation: 'A Book represents the abstract concept (title, author, ISBN). BookItem represents a physical copy that can be borrowed. Multiple copies of the same book = multiple BookItems.', basePoints: 10, difficulty: 'easy', questionData: { options: [{ id: 'a', text: 'A Book is the abstract entity; BookItem is a physical copy that can be borrowed', isCorrect: true }, { id: 'b', text: 'They are the same thing', isCorrect: false }, { id: 'c', text: 'BookItem is for digital books only', isCorrect: false }, { id: 'd', text: 'Book stores user data', isCorrect: false }] } } },
        { title: 'Hotel date overlap check', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'paragraph', content: 'Write the logic to check if a new hotel reservation conflicts with existing reservations for the same room.', explanation: 'Two date ranges [s1,e1] and [s2,e2] overlap if s1 < e2 AND s2 < e1.', basePoints: 20, difficulty: 'medium', questionData: { modelAnswer: 'Two reservations conflict if their date ranges overlap. Date range [checkIn1, checkOut1] overlaps with [checkIn2, checkOut2] when: checkIn1 < checkOut2 AND checkIn2 < checkOut1. To check availability for a new reservation (roomId, checkIn, checkOut): query all existing reservations for that room where status is not "cancelled", and check if any overlap with the requested dates. If no overlap exists, the room is available.\n\nfunction isAvailable(existing: Reservation[], newCheckIn: Date, newCheckOut: Date): boolean {\n  return !existing.some(r => newCheckIn < r.checkOut && r.checkIn < newCheckOut);\n}', minLength: 60, maxLength: 1500 } } },
        { title: 'Fine calculation pattern', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which design pattern is best for implementing different fine calculation strategies (per day, flat rate, escalating)?', explanation: 'Strategy pattern allows swapping fine calculation algorithms at runtime without changing the Loan class.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Strategy Pattern', isCorrect: true }, { id: 'b', text: 'Singleton Pattern', isCorrect: false }, { id: 'c', text: 'Observer Pattern', isCorrect: false }, { id: 'd', text: 'Factory Pattern', isCorrect: false }] } } },
        { title: 'Reservation status transitions', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'jumbled', content: 'Arrange hotel reservation statuses in typical lifecycle order:', explanation: 'Pending → Confirmed → CheckedIn → CheckedOut is the normal lifecycle.', basePoints: 15, difficulty: 'medium', questionData: { items: [{ id: 'j1', text: 'Pending' }, { id: 'j2', text: 'Confirmed' }, { id: 'j3', text: 'Checked In' }, { id: 'j4', text: 'Checked Out' }], correctOrder: ['j1', 'j2', 'j3', 'j4'] } } },
        { title: 'Payment integration', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Design the payment processing component for a hotel booking system. How would you support multiple payment methods while keeping the booking service decoupled from payment providers?', explanation: 'Use Strategy pattern for payment methods and an Adapter pattern for each provider.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'Define a PaymentProcessor interface with methods: authorize(amount), capture(authId), refund(paymentId). Implement adapters for each provider: StripeProcessor, PayPalProcessor, CashProcessor. Use the Strategy pattern in the BookingService — inject the PaymentProcessor at booking time based on guest preference. The BookingService calls paymentProcessor.authorize() during reservation and paymentProcessor.capture() at checkout. If a provider changes its API, only its adapter changes. Add new providers by implementing the PaymentProcessor interface. Use a PaymentProcessorFactory to create the right adapter based on payment method string.', minLength: 80, maxLength: 2000 } } },
        { title: 'Library member limits', type: 'question', sectionId: 'sec_questions', difficulty: 'easy', payload: { questionType: 'numerical', content: 'If a library allows members to borrow a maximum of 5 books and a member currently has 3 active loans, how many more books can they borrow?', explanation: '5 - 3 = 2 more books.', basePoints: 10, difficulty: 'easy', questionData: { correctAnswer: 2, tolerance: 0 } } },
      ],
    },

    { title: 'LLD — Social Media Feed & Notification System', description: 'Fan-out patterns, priority queues, rate limiting, pub-sub.', type: 'practice',
      sections: [{ id: 'sec_design', title: 'Design', orderIndex: 0 }, { id: 'sec_questions', title: 'Questions', orderIndex: 1 }],
      items: [
        { title: 'Social Media & Notification LLD', type: 'material', sectionId: 'sec_design', payload: { materialType: 'rich', richContent: { title: 'Social Media Feed & Notifications', blocks: [{ id: 'b1', type: 'heading', content: 'Feed System Design', metadata: { level: 2 } }, { id: 'b2', type: 'paragraph', content: 'Core classes: User, Post, Feed, FeedGenerator. Two approaches: Fan-out-on-write (push model — write to all followers\' feeds when posting) vs Fan-out-on-read (pull model — assemble feed at read time). Hybrid: fan-out-on-write for normal users, fan-out-on-read for celebrity users (many followers).' }, { id: 'b3', type: 'heading', content: 'Notification System', metadata: { level: 2 } }, { id: 'b4', type: 'paragraph', content: 'Classes: Notification (abstract), NotificationChannel (Email, Push, SMS), NotificationPreference, NotificationQueue. Use Observer pattern for generating notifications on events (new follower, like, comment). Use Strategy for channel selection. Rate limiter prevents notification spam.' }], readingTime: 7 } } },
        { title: 'Fan-out trade-offs', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Compare fan-out-on-write vs fan-out-on-read for a social media feed. When would you use each approach?', explanation: 'Write: fast reads, expensive writes, stale for unfollows. Read: always fresh, expensive reads.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'Fan-out-on-write: When a user posts, push the post to all followers\' pre-computed feeds. Pros: very fast reads (just fetch the feed list), simple read path. Cons: expensive writes for users with millions of followers, wasted work if many followers are inactive, complex to handle unfollows.\n\nFan-out-on-read: At read time, fetch posts from all followed users, merge and rank. Pros: always fresh, no wasted writes, handles unfollows naturally. Cons: slow reads (must aggregate at request time), complex merge logic.\n\nHybrid approach (Twitter model): Fan-out-on-write for regular users. Fan-out-on-read for celebrity accounts (>100K followers). At read time, merge the pre-computed feed with celebrity posts.', minLength: 80, maxLength: 2000 } } },
        { title: 'Notification rate limiting', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which data structure is best for implementing a per-user notification rate limiter?', explanation: 'A sliding window counter or token bucket per user efficiently tracks notification rates.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Token bucket or sliding window counter per user', isCorrect: true }, { id: 'b', text: 'Global counter for all users', isCorrect: false }, { id: 'c', text: 'Simple boolean flag per user', isCorrect: false }, { id: 'd', text: 'Hash map of all sent notifications', isCorrect: false }] } } },
        { title: 'Observer for notifications', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'true-false', content: 'The Observer pattern is appropriate for triggering notifications when a user gets a new follower, like, or comment.', explanation: 'True. These are events that need to notify interested parties (the notification system). Observer/pub-sub decouples the event producer from notification logic.', basePoints: 10, difficulty: 'medium', questionData: { correctAnswer: true } } },
        { title: 'Feed ranking', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcaq', content: 'Select ALL factors typically used in a social media feed ranking algorithm:', explanation: 'Feed ranking considers recency, engagement signals, relationship strength, and content type. File size is not relevant.', basePoints: 15, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Post recency (time since posted)', isCorrect: true }, { id: 'b', text: 'Engagement signals (likes, comments, shares)', isCorrect: true }, { id: 'c', text: 'Relationship closeness with author', isCorrect: true }, { id: 'd', text: 'File size of the post', isCorrect: false }] } } },
        { title: 'Priority queue for notifications', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'fill-blanks', content: 'A _____ queue ensures high-priority notifications (security alerts) are processed before low-priority ones (marketing updates).', explanation: 'A priority queue processes elements in order of priority, not insertion order.', basePoints: 10, difficulty: 'medium', questionData: { textWithBlanks: 'A {{blank1}} queue ensures high-priority notifications (security alerts) are processed before low-priority ones (marketing updates).', blanks: [{ id: 'blank1', correctAnswer: 'priority', acceptableAnswers: ['priority', 'Priority'], caseSensitive: false }] } } },
        { title: 'Notification deduplication', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Design a deduplication system that prevents sending duplicate notifications (e.g., multiple likes on the same post should batch into one notification).', explanation: 'Use a time-windowed aggregation: buffer notifications by (userId, eventType, targetId) and batch them.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'Use time-windowed aggregation with a NotificationBuffer:\n\n1. Key: (recipientId, eventType, targetEntityId) — e.g., (user123, "like", post456)\n2. When a notification event arrives, check if a pending buffer exists for this key\n3. If yes: increment count, update message ("5 people liked your post"), reset timer\n4. If no: create buffer with 30-second window, start timer\n5. When timer expires: send the aggregated notification\n\nData structure: HashMap<BufferKey, { count, firstEventTime, latestActors[] }>\nA background worker periodically flushes expired buffers. This prevents "Alice liked your post", "Bob liked your post" becoming a single "Alice, Bob, and 3 others liked your post".', minLength: 80, maxLength: 2000 } } },
      ],
    },

    { title: 'LLD — Chess Game & Card Game Engine', description: 'Game state management, rule engines, undo/redo, event sourcing.', type: 'practice',
      sections: [{ id: 'sec_design', title: 'Design', orderIndex: 0 }, { id: 'sec_questions', title: 'Questions', orderIndex: 1 }],
      items: [
        { title: 'Game Engine Design', type: 'material', sectionId: 'sec_design', payload: { materialType: 'rich', richContent: { title: 'Chess & Card Game LLD', blocks: [{ id: 'b1', type: 'heading', content: 'Chess Game', metadata: { level: 2 } }, { id: 'b2', type: 'paragraph', content: 'Key classes: Game, Board (8×8 grid of Cell), Piece (abstract → King, Queen, Bishop, Knight, Rook, Pawn), Player, Move. Each Piece subclass overrides canMove(from, to, board) to validate legal moves. The Game class manages turn order, check/checkmate detection, and move history.' }, { id: 'b3', type: 'heading', content: 'Card Game Engine', metadata: { level: 2 } }, { id: 'b4', type: 'paragraph', content: 'Core abstractions: Card (suit, rank), Deck (shuffle, deal), Hand (player\'s cards), GameEngine (abstract → PokerEngine, BlackjackEngine). Use Template Method for game flow: deal → bet → play → evaluate. Use Strategy for different evaluation rules.' }], readingTime: 7 } } },
        { title: 'Chess piece movement', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which design pattern is best for implementing different movement rules for each chess piece?', explanation: 'Each piece type has its own movement algorithm — this is polymorphism. The Piece abstract class defines canMove(), each subclass implements it differently.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Polymorphism via abstract Piece class with canMove() overrides', isCorrect: true }, { id: 'b', text: 'A single large switch statement', isCorrect: false }, { id: 'c', text: 'Decorator pattern', isCorrect: false }, { id: 'd', text: 'Singleton per piece type', isCorrect: false }] } } },
        { title: 'Game undo with Command', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'code', content: 'Implement a Move command for chess that supports undo. Include handling for captured pieces.', explanation: 'Move stores from, to, piece, capturedPiece. Execute moves the piece. Undo restores both pieces.', basePoints: 25, difficulty: 'hard', questionData: { language: 'typescript', starterCode: '// Chess Move command with undo', modelAnswer: 'interface GameCommand {\n  execute(): void;\n  undo(): void;\n}\n\nclass MoveCommand implements GameCommand {\n  private capturedPiece: Piece | null = null;\n\n  constructor(\n    private board: Board,\n    private piece: Piece,\n    private from: Position,\n    private to: Position\n  ) {}\n\n  execute(): void {\n    this.capturedPiece = this.board.getPiece(this.to);\n    this.board.removePiece(this.from);\n    this.board.placePiece(this.to, this.piece);\n    this.piece.setPosition(this.to);\n  }\n\n  undo(): void {\n    this.board.removePiece(this.to);\n    this.board.placePiece(this.from, this.piece);\n    this.piece.setPosition(this.from);\n    if (this.capturedPiece) {\n      this.board.placePiece(this.to, this.capturedPiece);\n    }\n  }\n}' } } },
        { title: 'Event sourcing for games', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'How would you use event sourcing to store and replay a chess game? What are the benefits over storing board snapshots?', explanation: 'Store each move as an event. Replay by applying all events sequentially. Benefits: complete history, smaller storage, time travel.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'Store each move as an immutable event: MoveEvent(pieceType, from, to, timestamp, capturedPiece?). The complete game state can be reconstructed by replaying all events from the start.\n\nBenefits over snapshots:\n1. Complete history — every decision is recorded, enabling analysis\n2. Smaller storage — a move is much smaller than a full board state\n3. Time travel — replay to any point by applying events up to that point\n4. Debugging — reproduce exact game flow\n5. Undo is just removing the last event and re-computing state\n6. Replay and analysis tools come naturally\n\nTrade-off: Rebuilding current state requires replaying all events (mitigate with periodic snapshots as checkpoints).', minLength: 80, maxLength: 2000 } } },
        { title: 'Card deck shuffle', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which algorithm produces a uniformly random shuffle of a deck?', explanation: 'Fisher-Yates (Knuth) shuffle iterates from end to start, swapping each card with a random card from the remaining unshuffled portion.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Fisher-Yates (Knuth) shuffle', isCorrect: true }, { id: 'b', text: 'Bubble sort with random comparisons', isCorrect: false }, { id: 'c', text: 'Assigning random numbers and sorting', isCorrect: false }, { id: 'd', text: 'Reversing the deck multiple times', isCorrect: false }] } } },
        { title: 'Template Method for game flow', type: 'question', sectionId: 'sec_questions', difficulty: 'medium', payload: { questionType: 'true-false', content: 'The Template Method pattern is ideal for defining a common game flow (setup → play → evaluate → end) while allowing different games to customize each step.', explanation: 'True. Template Method defines the skeleton in a base GameEngine class. Concrete games (Poker, Blackjack) override individual steps.', basePoints: 10, difficulty: 'medium', questionData: { correctAnswer: true } } },
        { title: 'Checkmate detection', type: 'question', sectionId: 'sec_questions', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Design the algorithm for detecting checkmate in chess. What classes and methods are involved?', explanation: 'A player is in checkmate when their king is in check and no legal move can escape check.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'isCheckmate(player):\n1. First verify isInCheck(player) — the king is under attack\n2. If not in check, return false\n3. Try every possible move for every piece of the player:\n   a. For each piece, get all legal moves (canMove returns true)\n   b. For each legal move, simulate it (execute move on a cloned board)\n   c. Check if the king is still in check after the move\n   d. Undo the simulated move\n4. If no move removes the check, it\'s checkmate\n\nOptimization: Check three types of escape: move the king, block the attacking piece, capture the attacking piece. Only generate moves for relevant pieces.\n\nClasses: Game.isCheckmate(), Board.isKingInCheck(color), Piece.getLegalMoves(board), Board.simulateMove(move).', minLength: 80, maxLength: 2000 } } },
      ],
    },

    // SP10: CQRS, Event Sourcing & DDD
    { title: 'CQRS, Event Sourcing & Domain-Driven Design', description: 'Aggregates, bounded contexts, event store, read models, eventual consistency.', type: 'standard',
      sections: [{ id: 'sec_concepts', title: 'Concepts', orderIndex: 0 }, { id: 'sec_practice', title: 'Practice', orderIndex: 1 }],
      items: [
        { title: 'DDD & CQRS Concepts', type: 'material', sectionId: 'sec_concepts', payload: { materialType: 'rich', richContent: { title: 'DDD, CQRS & Event Sourcing', blocks: [{ id: 'b1', type: 'heading', content: 'Domain-Driven Design', metadata: { level: 2 } }, { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: ['Entity: Object with unique identity that persists across time (User, Order)', 'Value Object: Immutable object defined by attributes, no identity (Money, Address)', 'Aggregate: Cluster of entities and value objects treated as a unit. Has a root entity.', 'Bounded Context: Explicit boundary where a domain model applies. Different contexts can model the same concept differently.', 'Ubiquitous Language: Shared vocabulary between developers and domain experts.'] } }, { id: 'b3', type: 'heading', content: 'CQRS', metadata: { level: 2 } }, { id: 'b4', type: 'paragraph', content: 'Command Query Responsibility Segregation separates read and write models. Commands (writes) go through domain logic. Queries (reads) use optimized read models. This allows independent scaling and optimization of read/write paths.' }], readingTime: 8 } } },
        { title: 'Entity vs Value Object', type: 'question', sectionId: 'sec_practice', difficulty: 'easy', payload: { questionType: 'mcq', content: 'In DDD, what distinguishes an Entity from a Value Object?', explanation: 'Entities have unique identity. Value Objects are defined entirely by their attributes and are immutable.', basePoints: 10, difficulty: 'easy', questionData: { options: [{ id: 'a', text: 'Entities have identity; Value Objects are defined by attributes and are immutable', isCorrect: true }, { id: 'b', text: 'Value Objects are always larger than Entities', isCorrect: false }, { id: 'c', text: 'Entities cannot have methods', isCorrect: false }, { id: 'd', text: 'There is no difference', isCorrect: false }] } } },
        { title: 'CQRS benefits', type: 'question', sectionId: 'sec_practice', difficulty: 'medium', payload: { questionType: 'mcaq', content: 'Select ALL benefits of CQRS:', explanation: 'CQRS allows independent scaling, different storage for reads/writes, and simplified query models. It adds complexity, not reduces it.', basePoints: 15, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Independent scaling of read and write workloads', isCorrect: true }, { id: 'b', text: 'Optimized read models (denormalized for queries)', isCorrect: true }, { id: 'c', text: 'Reduced overall system complexity', isCorrect: false }, { id: 'd', text: 'Automatic data synchronization', isCorrect: false }] } } },
        { title: 'Bounded context example', type: 'question', sectionId: 'sec_practice', difficulty: 'medium', payload: { questionType: 'paragraph', content: 'Give an example of how the same real-world concept (e.g., "Customer") can be modeled differently in two bounded contexts.', explanation: 'In a Sales context, Customer has orders and payment info. In Shipping context, Customer has delivery address and shipping preferences.', basePoints: 20, difficulty: 'medium', questionData: { modelAnswer: 'In an e-commerce system:\n\nSales Bounded Context: Customer entity has name, email, payment methods, order history, loyalty tier, and cart. The Sales team cares about purchasing behavior and revenue.\n\nShipping Bounded Context: Customer (or "Recipient") has name, shipping addresses, delivery preferences, and package tracking info. The Shipping team doesn\'t need payment info.\n\nEach context has its own Customer model with only the attributes relevant to that domain. They share a customer ID for correlation but are otherwise independent. This prevents a bloated "God object" Customer class and allows each team to evolve their model independently.', minLength: 60, maxLength: 1500 } } },
        { title: 'Aggregate root rule', type: 'question', sectionId: 'sec_practice', difficulty: 'medium', payload: { questionType: 'true-false', content: 'External objects should only hold references to the Aggregate Root, never to internal entities within the aggregate.', explanation: 'True. The aggregate root is the only entry point. External access to internal entities would bypass invariant enforcement.', basePoints: 10, difficulty: 'medium', questionData: { correctAnswer: true } } },
        { title: 'Event sourcing trade-off', type: 'question', sectionId: 'sec_practice', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'What are the main trade-offs of using Event Sourcing? When is it NOT appropriate?', explanation: 'Event sourcing provides complete audit trail and temporal queries but adds complexity and makes simple queries harder.', basePoints: 25, difficulty: 'hard', questionData: { modelAnswer: 'Benefits: Complete audit trail, temporal queries (state at any point in time), natural fit with CQRS, enables event-driven architectures, debugging and replay capability.\n\nDrawbacks: Increased complexity, eventual consistency challenges, event schema evolution is hard (versioning events), simple queries become complex (need read models/projections), event store grows indefinitely (need snapshots), not suitable for CRUD-heavy systems with simple requirements.\n\nNot appropriate for: Simple CRUD applications, systems that need strong consistency everywhere, prototypes or MVPs where simplicity matters more, domains without rich business logic, teams without event sourcing experience.', minLength: 80, maxLength: 2000 } } },
        { title: 'Ubiquitous language', type: 'question', sectionId: 'sec_practice', difficulty: 'easy', payload: { questionType: 'fill-blanks', content: 'In DDD, the shared language between developers and domain experts is called the _____ Language.', explanation: 'Ubiquitous Language ensures everyone uses the same terms for domain concepts, reducing miscommunication.', basePoints: 10, difficulty: 'easy', questionData: { textWithBlanks: 'In DDD, the shared language between developers and domain experts is called the {{blank1}} Language.', blanks: [{ id: 'blank1', correctAnswer: 'Ubiquitous', acceptableAnswers: ['Ubiquitous', 'ubiquitous'], caseSensitive: false }] } } },
      ],
    },

    // SP11: LLD Comprehensive Quiz
    { title: 'LLD Comprehensive Quiz', description: 'Assessment covering OOP, design patterns, SOLID, and system design.', type: 'quiz',
      assessmentConfig: { maxAttempts: 3, shuffleQuestions: true, showResultsImmediately: true, passingPercentage: 70 },
      sections: [{ id: 'sec_patterns', title: 'Patterns & Principles', orderIndex: 0 }, { id: 'sec_design', title: 'Design', orderIndex: 1 }],
      items: [
        { title: 'Pattern category', type: 'question', sectionId: 'sec_patterns', difficulty: 'easy', payload: { questionType: 'matching', content: 'Match each design pattern to its category:', explanation: 'Singleton is creational, Adapter is structural, Observer is behavioral, Builder is creational.', basePoints: 15, difficulty: 'easy', questionData: { pairs: [{ id: 'p1', left: 'Singleton', right: 'Creational' }, { id: 'p2', left: 'Adapter', right: 'Structural' }, { id: 'p3', left: 'Observer', right: 'Behavioral' }, { id: 'p4', left: 'Decorator', right: 'Structural' }] } } },
        { title: 'SOLID violation', type: 'question', sectionId: 'sec_patterns', difficulty: 'medium', payload: { questionType: 'mcq', content: 'A Bird class has a fly() method. Penguin extends Bird but throws an exception in fly(). Which SOLID principle is violated?', explanation: 'Liskov Substitution Principle: Penguin cannot be substituted for Bird because it changes the expected behavior of fly().', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Liskov Substitution Principle', isCorrect: true }, { id: 'b', text: 'Single Responsibility', isCorrect: false }, { id: 'c', text: 'Open/Closed', isCorrect: false }, { id: 'd', text: 'Interface Segregation', isCorrect: false }] } } },
        { title: 'Immutability benefit', type: 'question', sectionId: 'sec_patterns', difficulty: 'easy', payload: { questionType: 'true-false', content: 'Immutable objects are inherently thread-safe because their state cannot change after creation.', explanation: 'True. Since immutable objects cannot be modified, multiple threads can read them simultaneously without synchronization.', basePoints: 10, difficulty: 'easy', questionData: { correctAnswer: true } } },
        { title: 'Gang of Four count', type: 'question', sectionId: 'sec_patterns', difficulty: 'easy', payload: { questionType: 'numerical', content: 'How many design patterns are described in the original Gang of Four book?', explanation: 'The GoF book describes 23 design patterns: 5 creational, 7 structural, 11 behavioral.', basePoints: 10, difficulty: 'easy', questionData: { correctAnswer: 23, tolerance: 0 } } },
        { title: 'DRY principle', type: 'question', sectionId: 'sec_patterns', difficulty: 'easy', payload: { questionType: 'fill-blanks', content: 'The DRY principle stands for "Don\'t _____ Yourself".', explanation: 'Don\'t Repeat Yourself — every piece of knowledge should have a single, unambiguous representation.', basePoints: 10, difficulty: 'easy', questionData: { textWithBlanks: 'The DRY principle stands for "Don\'t {{blank1}} Yourself".', blanks: [{ id: 'blank1', correctAnswer: 'Repeat', acceptableAnswers: ['Repeat', 'repeat'], caseSensitive: false }] } } },
        { title: 'Coupling vs Cohesion', type: 'question', sectionId: 'sec_design', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Good software design aims for:', explanation: 'Low coupling (minimal dependencies between modules) and high cohesion (related functionality grouped together) are key design goals.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Low coupling and high cohesion', isCorrect: true }, { id: 'b', text: 'High coupling and low cohesion', isCorrect: false }, { id: 'c', text: 'High coupling and high cohesion', isCorrect: false }, { id: 'd', text: 'Low coupling and low cohesion', isCorrect: false }] } } },
        { title: 'Design pattern for payment methods', type: 'question', sectionId: 'sec_design', difficulty: 'medium', payload: { questionType: 'mcq', content: 'You need to support multiple payment methods (credit card, PayPal, crypto) that can be selected at runtime. Which pattern?', explanation: 'Strategy pattern: define a PaymentStrategy interface, implement for each method, and inject the chosen strategy at runtime.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Strategy', isCorrect: true }, { id: 'b', text: 'Singleton', isCorrect: false }, { id: 'c', text: 'Composite', isCorrect: false }, { id: 'd', text: 'Proxy', isCorrect: false }] } } },
      ],
    },

    // SP12: LLD Staff-Level Assessment
    { title: 'LLD Staff-Level Assessment', description: 'Timed assessment: design a complete system from requirements.', type: 'timed_test',
      assessmentConfig: { durationMinutes: 45, maxAttempts: 1, shuffleQuestions: true, showResultsImmediately: false, passingPercentage: 60 },
      sections: [{ id: 'sec_concepts', title: 'Concepts', orderIndex: 0 }, { id: 'sec_design', title: 'System Design', orderIndex: 1 }],
      items: [
        { title: 'Pattern selection', type: 'question', sectionId: 'sec_concepts', difficulty: 'medium', payload: { questionType: 'mcq', content: 'An e-commerce system needs to validate orders through multiple steps: inventory check, fraud detection, payment verification. Which pattern?', explanation: 'Chain of Responsibility passes the order through a chain of validators, each deciding to approve, reject, or pass to the next.', basePoints: 15, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'Chain of Responsibility', isCorrect: true }, { id: 'b', text: 'Observer', isCorrect: false }, { id: 'c', text: 'Prototype', isCorrect: false }, { id: 'd', text: 'Bridge', isCorrect: false }] } } },
        { title: 'SOLID refactoring', type: 'question', sectionId: 'sec_concepts', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'A ReportGenerator class reads data from the database, formats it as PDF, and emails it to the admin. Identify all SOLID violations and describe how to refactor.', explanation: 'Violates SRP (3 responsibilities), DIP (depends on concrete implementations). Refactor into separate classes with interfaces.', basePoints: 30, difficulty: 'hard', questionData: { modelAnswer: 'SOLID violations:\n1. SRP: Three responsibilities — data access, formatting, and email sending\n2. OCP: Adding a new format (CSV, Excel) requires modifying the class\n3. DIP: Likely depends on concrete DB, PDF library, and email service\n\nRefactored design:\n- IReportDataSource interface → DatabaseReportSource implementation\n- IReportFormatter interface → PdfFormatter, CsvFormatter, ExcelFormatter\n- IReportSender interface → EmailSender, SlackSender\n- ReportGenerator takes all three via constructor injection and orchestrates\n\nclass ReportGenerator {\n  constructor(\n    private dataSource: IReportDataSource,\n    private formatter: IReportFormatter,\n    private sender: IReportSender\n  ) {}\n  generate() {\n    const data = this.dataSource.fetchData();\n    const report = this.formatter.format(data);\n    this.sender.send(report);\n  }\n}', minLength: 100, maxLength: 2500 } } },
        { title: 'Design online food ordering', type: 'question', sectionId: 'sec_design', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'Design the class structure for an online food ordering system (like UberEats). Include key classes, their relationships, design patterns used, and how you would handle order state transitions.', explanation: 'Key classes: Restaurant, Menu, MenuItem, Customer, Order, OrderItem, DeliveryDriver, Payment. State pattern for order lifecycle.', basePoints: 30, difficulty: 'hard', questionData: { modelAnswer: 'Key Classes:\n- Restaurant: name, menu, address, isOpen, ratings\n- Menu: menuItems[], addItem(), removeItem()\n- MenuItem: name, price, category, available\n- Customer: name, addresses[], paymentMethods[], orderHistory[]\n- Order: customer, restaurant, items[], status, total, deliveryAddress, driver\n- OrderItem: menuItem, quantity, specialInstructions, subtotal\n- DeliveryDriver: name, location, isAvailable, currentOrder\n- Payment: order, amount, method, status\n\nDesign Patterns:\n- State: Order states (Placed → Confirmed → Preparing → ReadyForPickup → PickedUp → Delivered/Cancelled)\n- Observer: Notify customer/restaurant/driver on state changes\n- Strategy: PaymentStrategy for different payment methods\n- Factory: OrderFactory to create orders with validation\n\nOrder State Machine:\nPlaced → Restaurant confirms → Preparing → Ready → Driver picks up → Delivered\nAny state → Cancelled (with refund logic varying by state)', minLength: 150, maxLength: 3000 } } },
        { title: 'Concurrency in order processing', type: 'question', sectionId: 'sec_design', difficulty: 'hard', payload: { questionType: 'mcq', content: 'Two customers simultaneously order the last item in stock. How should the system handle this?', explanation: 'Use optimistic locking: check the item count at order time, decrement atomically. If the decrement fails (count already 0), reject the second order.', basePoints: 15, difficulty: 'hard', questionData: { options: [{ id: 'a', text: 'Optimistic locking on inventory count with atomic decrement', isCorrect: true }, { id: 'b', text: 'First-come-first-served based on order timestamp', isCorrect: false }, { id: 'c', text: 'Allow both orders and apologize later', isCorrect: false }, { id: 'd', text: 'Lock the entire menu during any order', isCorrect: false }] } } },
        { title: 'Extensibility assessment', type: 'question', sectionId: 'sec_design', difficulty: 'hard', payload: { questionType: 'paragraph', content: 'You built a ride-sharing app. Now the business wants to add food delivery and package delivery. How would you design the system to support multiple delivery types with minimal code duplication?', explanation: 'Abstract a Delivery base with ride, food, package subtypes. Use Strategy for pricing, matching, and routing.', basePoints: 30, difficulty: 'hard', questionData: { modelAnswer: 'Design a DeliveryRequest abstract base: origin, destination, requester, status, assignedDriver. Subclasses: RideRequest (passengers, vehicleType), FoodDeliveryRequest (restaurant, items, specialInstructions), PackageRequest (dimensions, weight, fragile).\n\nShared services via interfaces:\n- IMatchingStrategy: assigns the best driver (different logic for each type)\n- IPricingStrategy: calculates fare (distance-based for rides, flat + distance for food)\n- IRoutingService: shared navigation\n- IPaymentService: shared payment processing\n- INotificationService: shared notifications\n\nThe core DeliveryManager handles the lifecycle (matching, tracking, completion) generically. Type-specific logic lives in strategy implementations injected via DI. Adding a new delivery type = new DeliveryRequest subclass + new strategy implementations, zero changes to core.', minLength: 100, maxLength: 2500 } } },
        { title: 'Microservice boundary', type: 'question', sectionId: 'sec_design', difficulty: 'hard', payload: { questionType: 'mcaq', content: 'When splitting a monolith into microservices, which criteria help define service boundaries?', explanation: 'DDD bounded contexts, team ownership, independent deployment, and data ownership all help define boundaries.', basePoints: 20, difficulty: 'hard', questionData: { options: [{ id: 'a', text: 'DDD bounded contexts', isCorrect: true }, { id: 'b', text: 'Team ownership alignment', isCorrect: true }, { id: 'c', text: 'Database table count', isCorrect: false }, { id: 'd', text: 'Lines of code per class', isCorrect: false }] } } },
        { title: 'API versioning strategy', type: 'question', sectionId: 'sec_concepts', difficulty: 'medium', payload: { questionType: 'mcq', content: 'Which API versioning strategy is most commonly recommended for REST APIs?', explanation: 'URL path versioning (/v1/users, /v2/users) is most common and visible. Header versioning is cleaner but harder to test.', basePoints: 10, difficulty: 'medium', questionData: { options: [{ id: 'a', text: 'URL path versioning (/v1/resource)', isCorrect: true }, { id: 'b', text: 'Query parameter (?version=1)', isCorrect: false }, { id: 'c', text: 'Random version assignment', isCorrect: false }, { id: 'd', text: 'No versioning needed', isCorrect: false }] } } },
      ],
    },
  ],
};
