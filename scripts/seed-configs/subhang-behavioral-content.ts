/**
 * Behavioral Interview Space — Behavioral Interview Mastery seed configuration
 * 12 story points × ~7 items = ~84 items total
 * Distribution: Materials 35%, Paragraph 30%, MCQ/MCAQ 20%, Text 10%, Matching 5%
 */
import type { SpaceSeed } from './subhang-content.js';

export const behavioralSpace: SpaceSeed = {
  title: 'Behavioral Interview Mastery',
  description: 'Master behavioral interview techniques using the STAR method, covering leadership, conflict resolution, system ownership, and staff+ level questions for FAANG interviews.',
  subject: 'Career Development',
  classIds: [],
  teacherIndex: 0,
  type: 'hybrid',
  storyPoints: [
    // ═══════════════════════════════════════════════════════
    // SP1: STAR Method & Storytelling Framework — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'STAR Method & Storytelling Framework',
      description: 'Learn the STAR framework (Situation, Task, Action, Result) and how to structure compelling behavioral answers.',
      type: 'standard',
      sections: [
        { id: 'sec_framework', title: 'Framework', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'STAR Method Deep Dive',
          type: 'material',
          sectionId: 'sec_framework',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'The STAR Method for Behavioral Interviews',
              blocks: [
                { id: 'b1', type: 'heading', content: 'What is the STAR Method?', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'The STAR method is a structured approach for answering behavioral interview questions. It stands for Situation (set the context), Task (describe your responsibility), Action (explain what you did), and Result (share the outcome with metrics). This framework ensures your answers are concise, relevant, and demonstrate clear impact.' },
                { id: 'b3', type: 'heading', content: 'Situation', metadata: { level: 3 } },
                { id: 'b4', type: 'paragraph', content: 'Set the scene in 2-3 sentences. Provide enough context for the interviewer to understand the challenge without unnecessary details. Include the team size, your role, the timeline, and any constraints. Example: "At my previous company, our payment processing system was experiencing 2% transaction failures during peak hours, affecting 50K daily users."' },
                { id: 'b5', type: 'heading', content: 'Task', metadata: { level: 3 } },
                { id: 'b6', type: 'paragraph', content: 'Clarify YOUR specific responsibility. Distinguish between the team\'s goal and your individual contribution. Use "I" not "we" when describing your role. Example: "As the tech lead, I was responsible for diagnosing the root cause and delivering a fix within 2 weeks before the holiday traffic spike."' },
                { id: 'b7', type: 'heading', content: 'Action', metadata: { level: 3 } },
                { id: 'b8', type: 'paragraph', content: 'This is the most important part — spend 60% of your answer here. Detail the specific steps you took, the decisions you made, and WHY you chose that approach over alternatives. Show technical depth and leadership thinking. Mention trade-offs you evaluated.' },
                { id: 'b9', type: 'heading', content: 'Result', metadata: { level: 3 } },
                { id: 'b10', type: 'paragraph', content: 'Quantify the outcome whenever possible. Use metrics: "Reduced failure rate from 2% to 0.1%", "Saved $200K/month", "Improved latency by 40%". Also mention what you learned and any follow-up actions. If the outcome wasn\'t positive, explain what you learned and what you would do differently.' },
              ],
              readingTime: 10,
            },
          },
        },
        {
          title: 'Crafting Your Story Bank',
          type: 'material',
          sectionId: 'sec_framework',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Building a Story Bank',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Why You Need a Story Bank', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Prepare 8-12 stories from your career that can be adapted to various behavioral questions. Each story should highlight different competencies: technical leadership, conflict resolution, ambiguity, failure recovery, cross-functional collaboration. A well-prepared story bank means you never draw a blank during interviews.' },
                { id: 'b3', type: 'heading', content: 'Story Selection Criteria', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Recent (within last 2-3 years) — shows current capability level',
                  'Impactful — demonstrates measurable business or technical outcomes',
                  'Complex — involves trade-offs, ambiguity, or competing priorities',
                  'Role-appropriate — matches the seniority level you\'re interviewing for',
                  'Versatile — each story can answer 2-3 different question types',
                ] } },
                { id: 'b5', type: 'heading', content: 'Adapting Stories to Questions', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'The same project story can answer "Tell me about a time you led a team" (emphasize leadership actions), "Describe a technical challenge" (emphasize debugging and architecture), or "How do you handle disagreements?" (emphasize stakeholder alignment). Adjust the emphasis of your STAR components based on what the question is really asking.' },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'STAR components',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'In the STAR method, which component should receive the most time and detail in your response?',
            explanation: 'The Action component should take about 60% of your answer. This is where you demonstrate your skills, decision-making, and leadership by detailing WHAT you did and WHY.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Action — detail what you did and why', isCorrect: true },
                { id: 'b', text: 'Situation — provide extensive background context', isCorrect: false },
                { id: 'c', text: 'Result — focus on metrics and outcomes', isCorrect: false },
                { id: 'd', text: 'Task — clarify every aspect of your responsibility', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'STAR component ordering',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'jumbled',
            content: 'Arrange the STAR method components in the correct order for structuring a behavioral answer:',
            explanation: 'STAR stands for Situation → Task → Action → Result. Always set context first, then clarify your role, describe actions in detail, and conclude with measurable outcomes.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              correctOrder: [
                { id: 'j1', text: 'Situation — Set the context and background' },
                { id: 'j2', text: 'Task — Describe your specific responsibility' },
                { id: 'j3', text: 'Action — Detail the steps you took (60% of answer)' },
                { id: 'j4', text: 'Result — Quantify outcomes and learnings' },
              ],
            },
          },
        },
        {
          title: 'Write a STAR response',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Using the STAR method, write a response to: "Tell me about a time you had to make a difficult technical decision under time pressure." Create a realistic scenario from a software engineering context.',
            explanation: 'A strong answer includes: Situation (specific project/deadline), Task (your role and the decision needed), Action (analysis of options, trade-offs considered, decision rationale — this should be the longest part), Result (measurable outcome and lessons learned).',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear situation with context, (2) Specific task/responsibility, (3) Detailed actions with rationale and trade-offs, (4) Quantified results, (5) Professional tone and realistic scenario.',
            },
          },
        },
        {
          title: 'Common STAR mistakes',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL common mistakes people make when using the STAR method:',
            explanation: 'Common mistakes include using "we" instead of "I", spending too long on context, and giving vague results. Using specific technical details is actually a positive practice.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Using "we" instead of "I" throughout the answer', isCorrect: true },
                { id: 'b', text: 'Spending too much time on the Situation (over-explaining context)', isCorrect: true },
                { id: 'c', text: 'Giving vague results without specific metrics', isCorrect: true },
                { id: 'd', text: 'Including specific technical details in the Action step', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Evaluate a STAR response',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'What is the single most important element that distinguishes a good STAR response from a great one at the senior/staff engineer level?',
            explanation: 'At senior+ levels, the differentiator is demonstrating strategic thinking — showing WHY you chose your approach over alternatives, what trade-offs you evaluated, and how your decision aligned with broader business/technical goals.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP2: Leadership & Influence — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Leadership & Influence',
      description: 'Demonstrate technical leadership, mentoring ability, and influence without authority.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Leadership Concepts', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Technical Leadership Framework',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Technical Leadership at Scale',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Types of Technical Leadership', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Tech Lead: Own technical direction for a team of 3-8 engineers. Balance hands-on coding with architecture decisions.',
                  'Staff Engineer: Influence across multiple teams. Set technical standards, drive cross-cutting initiatives.',
                  'Principal Engineer: Organization-wide technical strategy. Define multi-year technical vision.',
                ] } },
                { id: 'b3', type: 'heading', content: 'Influence Without Authority', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'At senior levels, leadership isn\'t about telling people what to do. It\'s about building consensus through data, demonstrating expertise, writing compelling RFCs, presenting trade-offs clearly, and earning trust through consistent delivery. The best technical leaders make others around them more effective.' },
                { id: 'b5', type: 'heading', content: 'Mentoring & Growing Others', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Interviewers want to see that you invest in growing other engineers. This includes code review that teaches (not just approves), pairing sessions, creating documentation/runbooks, designing onboarding for new team members, and sponsoring junior engineers for stretch assignments.' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Leadership styles',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is "influence without authority" in the context of technical leadership?',
            explanation: 'Influence without authority means driving technical decisions and alignment through expertise, data, and trust rather than positional power. This is the primary mode of leadership for staff+ engineers.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Driving decisions through expertise, data, and trust rather than positional power', isCorrect: true },
                { id: 'b', text: 'Making decisions without consulting stakeholders', isCorrect: false },
                { id: 'c', text: 'Delegating all decisions to team members', isCorrect: false },
                { id: 'd', text: 'Following the manager\'s direction without question', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Describe a leadership moment',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a time you led a technical initiative that required getting buy-in from multiple teams or stakeholders who initially disagreed with your approach. How did you build consensus?',
            explanation: 'Strong answers show: (1) A clear technical vision, (2) Understanding opposing viewpoints, (3) Data-driven persuasion, (4) Willingness to incorporate feedback, (5) Measurable outcome.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear STAR structure, (2) Specific stakeholder concerns addressed, (3) Concrete persuasion tactics (RFC, prototype, data), (4) Compromise/adaptation shown, (5) Quantified impact.',
            },
          },
        },
        {
          title: 'Mentoring approach',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you mentored a junior engineer through a challenging project. What was your approach, and how did you balance guidance with letting them learn independently?',
            explanation: 'Good mentoring answers demonstrate: setting clear expectations, providing scaffolding not answers, celebrating growth, adjusting support level based on the mentee\'s progress.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Specific mentoring situation, (2) Balanced approach between guidance and autonomy, (3) Adaptation to mentee needs, (4) Measurable growth outcome, (5) Reflection on own mentoring style.',
            },
          },
        },
        {
          title: 'Leadership competencies matching',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'matching',
            content: 'Match each leadership level to its primary scope of influence:',
            explanation: 'Tech leads own their team\'s technical direction, staff engineers influence across teams, principal engineers set org-wide strategy, and engineering managers focus on people and process.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Tech Lead', right: 'Single team technical direction' },
                { id: 'p2', left: 'Staff Engineer', right: 'Cross-team technical standards' },
                { id: 'p3', left: 'Principal Engineer', right: 'Organization-wide technical strategy' },
                { id: 'p4', left: 'Engineering Manager', right: 'People growth and process' },
              ],
            },
          },
        },
        {
          title: 'Delegation scenario',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'You have a critical production issue and a junior engineer on your team is eager to help but has never debugged production systems. How do you handle this situation?',
            explanation: 'The ideal approach balances urgency (fix the issue) with growth (learning opportunity). Pair with the junior engineer, let them drive while you guide, or have them shadow and debrief afterward.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Technical decision-making',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL effective strategies for building consensus on a controversial technical decision:',
            explanation: 'Building consensus requires data, prototypes, addressing concerns directly, and incorporating feedback. Escalating to management should be a last resort, not a first strategy.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Writing an RFC with data comparing alternatives', isCorrect: true },
                { id: 'b', text: 'Building a prototype to demonstrate feasibility', isCorrect: true },
                { id: 'c', text: 'Having 1:1 conversations to understand concerns', isCorrect: true },
                { id: 'd', text: 'Immediately escalating to management for a decision', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP3: Conflict Resolution & Difficult Conversations — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Conflict Resolution & Difficult Conversations',
      description: 'Handle disagreements, pushback, and interpersonal challenges in engineering teams.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Frameworks', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Conflict Resolution Strategies',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Navigating Technical Disagreements',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Types of Engineering Conflicts', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Technical disagreements: Architecture choices, technology selection, design patterns',
                  'Process conflicts: Code review standards, deployment practices, on-call expectations',
                  'Priority conflicts: Feature vs tech debt, speed vs quality, team goals vs org goals',
                  'Interpersonal tensions: Communication styles, credit/blame dynamics, cultural differences',
                ] } },
                { id: 'b3', type: 'heading', content: 'The SBI Framework for Feedback', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Situation-Behavior-Impact (SBI) is effective for giving constructive feedback. Describe the specific Situation, the observable Behavior, and the Impact it had. This keeps feedback objective and actionable. Example: "In yesterday\'s design review (S), when you dismissed the junior engineer\'s suggestion without explanation (B), it discouraged them from contributing further and we missed a valid optimization (I)."' },
                { id: 'b5', type: 'heading', content: 'Disagree and Commit', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Sometimes you won\'t get your preferred outcome. The "disagree and commit" principle means voicing your concerns clearly, but once a decision is made, fully supporting it. Interviewers value candidates who can separate their ego from the decision and focus on the team\'s success.' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Conflict resolution approach',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What does "disagree and commit" mean in an engineering context?',
            explanation: 'Disagree and commit means expressing your concerns during the decision process, but once a team decision is made, fully supporting and executing it even if you would have chosen differently.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Voice concerns during discussion, then fully support the final decision', isCorrect: true },
                { id: 'b', text: 'Agree publicly but work around the decision privately', isCorrect: false },
                { id: 'c', text: 'Refuse to commit until everyone agrees', isCorrect: false },
                { id: 'd', text: 'Escalate every disagreement to leadership', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Handle a technical disagreement',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you had a significant technical disagreement with a senior colleague. How did you handle it, and what was the outcome?',
            explanation: 'Strong answers show: (1) Respect for the other person\'s perspective, (2) Data-driven approach, (3) Willingness to find middle ground, (4) Professional handling regardless of outcome, (5) Learning from the experience.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) STAR format used, (2) Respectful framing of disagreement, (3) Objective criteria used to evaluate options, (4) Mature resolution approach, (5) Reflection and learning.',
            },
          },
        },
        {
          title: 'Giving difficult feedback',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a time you had to give difficult feedback to a teammate whose code quality was consistently below standards. How did you approach the conversation?',
            explanation: 'Effective answers use the SBI framework, show empathy, focus on behavior not personality, offer specific improvement suggestions, and follow up on progress.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) SBI or similar framework used, (2) Empathy demonstrated, (3) Specific examples given, (4) Actionable improvement plan, (5) Follow-up mentioned.',
            },
          },
        },
        {
          title: 'Conflict scenarios',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each conflict scenario to the most appropriate resolution approach:',
            explanation: 'Architecture debates need data/prototypes, process disagreements need team discussion, underperformance needs private 1:1 feedback, and priority conflicts need stakeholder alignment.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Architecture debate between two approaches', right: 'Prototype both and compare with data' },
                { id: 'p2', left: 'Team disagrees on code review standards', right: 'Facilitate team discussion to establish norms' },
                { id: 'p3', left: 'Colleague consistently missing deadlines', right: 'Private 1:1 using SBI framework' },
                { id: 'p4', left: 'PM wants feature, you want tech debt work', right: 'Quantify tech debt cost to align priorities' },
              ],
            },
          },
        },
        {
          title: 'De-escalation technique',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'A code review comment thread has become heated between two team members. As the tech lead, what is your first action?',
            explanation: 'Move the conversation offline — suggest a quick call or in-person chat. Written communication often escalates conflicts because tone is lost. Then facilitate a discussion focused on technical merits.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Conflict red flags',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL red flags in a behavioral answer about conflict resolution:',
            explanation: 'Red flags include blaming others, showing no empathy, and claiming to never have conflicts (unrealistic). Acknowledging mistakes shows maturity and self-awareness.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Blaming the other person entirely without self-reflection', isCorrect: true },
                { id: 'b', text: 'Showing no empathy for the opposing viewpoint', isCorrect: true },
                { id: 'c', text: 'Claiming to never have experienced workplace conflicts', isCorrect: true },
                { id: 'd', text: 'Admitting you were wrong about part of the disagreement', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP4: System Ownership & Technical Decision-Making — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'System Ownership & Technical Decision-Making',
      description: 'Demonstrate ownership of complex systems, incident response, and architectural decision-making.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Concepts', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'System Ownership Principles',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Owning Systems End-to-End',
              blocks: [
                { id: 'b1', type: 'heading', content: 'What Does System Ownership Mean?', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'System ownership means taking full responsibility for a service or component — not just writing code, but monitoring it in production, responding to incidents, planning for scale, managing technical debt, and ensuring it meets SLAs. Owners think about their systems 24/7 and proactively identify risks before they become incidents.' },
                { id: 'b3', type: 'heading', content: 'Incident Response Stories', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Interviewers love incident response stories because they reveal how you perform under pressure. Key elements: How did you detect the issue? How did you triage and communicate? What was your debugging methodology? How did you prevent recurrence? The best stories show calm leadership, systematic debugging, and a strong postmortem culture.' },
                { id: 'b5', type: 'heading', content: 'Technical Decision Documentation', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Documenting architectural decisions through ADRs (Architecture Decision Records) or RFCs shows maturity. Include: context, options considered, trade-offs, decision, and consequences. This creates a historical record of WHY decisions were made, which is invaluable for future team members.' },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'System ownership scope',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL responsibilities that fall under system ownership:',
            explanation: 'System ownership encompasses monitoring, incident response, capacity planning, and tech debt management — not just writing features.',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Monitoring and alerting in production', isCorrect: true },
                { id: 'b', text: 'On-call incident response', isCorrect: true },
                { id: 'c', text: 'Capacity planning and scaling', isCorrect: true },
                { id: 'd', text: 'Only writing feature code for the service', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Describe an incident response',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a production incident you owned from detection through resolution and postmortem. What was the root cause, how did you manage the response, and what systemic improvements did you make?',
            explanation: 'Excellent answers show: (1) Systematic debugging approach, (2) Clear communication during the incident, (3) Root cause analysis, (4) Prevention measures implemented, (5) Postmortem culture.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear incident timeline, (2) Debugging methodology shown, (3) Communication with stakeholders, (4) Root cause identified (not just symptoms), (5) Systemic improvements made.',
            },
          },
        },
        {
          title: 'Architecture decision trade-offs',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a time you had to choose between two architectural approaches. What trade-offs did you evaluate, how did you make the final decision, and would you make the same choice today?',
            explanation: 'Shows decision-making maturity: identifying trade-offs, consulting stakeholders, using data, and having the self-awareness to evaluate past decisions critically.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear problem statement, (2) Multiple options considered, (3) Trade-off analysis (performance, maintainability, cost, team skills), (4) Decision rationale, (5) Retrospective reflection.',
            },
          },
        },
        {
          title: 'Incident severity classification',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'matching',
            content: 'Match each incident severity level to its typical characteristics:',
            explanation: 'Severity levels help triage response urgency. P0 = total outage, P1 = major degradation, P2 = partial impact, P3 = minor issues.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              pairs: [
                { id: 'p1', left: 'P0 — Critical', right: 'Complete service outage, all users affected' },
                { id: 'p2', left: 'P1 — High', right: 'Major feature broken, significant user impact' },
                { id: 'p3', left: 'P2 — Medium', right: 'Partial degradation, workaround available' },
                { id: 'p4', left: 'P3 — Low', right: 'Minor issue, cosmetic or edge case' },
              ],
            },
          },
        },
        {
          title: 'Technical debt communication',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'How would you convince a product manager to allocate sprint time for addressing critical technical debt?',
            explanation: 'Frame tech debt in business terms: velocity slowdown, incident risk, customer impact, developer retention. Use data to show the cost of inaction vs the investment needed.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Ownership antipatterns',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Which behavior best demonstrates strong system ownership?',
            explanation: 'Strong ownership means proactively identifying and fixing issues before they become incidents, not just reacting when things break.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Proactively adding monitoring and fixing issues before they cause incidents', isCorrect: true },
                { id: 'b', text: 'Waiting for users to report bugs before investigating', isCorrect: false },
                { id: 'c', text: 'Only working on the system during assigned on-call rotations', isCorrect: false },
                { id: 'd', text: 'Passing incident response to the next team member on rotation', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP5: Cross-Functional Collaboration — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Cross-Functional Collaboration',
      description: 'Work effectively with product managers, designers, data scientists, and other engineering teams.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Concepts', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Cross-Functional Communication',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Working Across Functions',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Translating Between Technical and Non-Technical', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'A key skill at senior levels is the ability to translate complex technical concepts for non-technical stakeholders. This means explaining system constraints in terms of user impact, framing technical debt as business risk, and presenting architecture decisions as trade-offs between speed, cost, and quality. Avoid jargon — use analogies and concrete examples.' },
                { id: 'b3', type: 'heading', content: 'Working with Product Managers', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'The best engineer-PM relationships are partnerships, not handoffs. Engineers should understand the business context (metrics, user needs, competitive landscape) and PMs should understand technical constraints. Push back on requirements when they don\'t make technical sense, but always propose alternatives rather than just saying no.' },
                { id: 'b5', type: 'heading', content: 'Collaborating with Design', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Engage with designers early in the process, not after designs are finalized. Provide input on technical feasibility, suggest simpler implementations that achieve the same UX goals, and be transparent about performance or platform limitations. The goal is finding the best solution together, not implementing designs exactly as specified.' },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'Cross-functional skills',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'When a product manager proposes a feature that would require significant architectural changes, what is the best initial response?',
            explanation: 'The best approach is collaborative: understand the business need, then discuss technical implications and alternatives together. Neither blindly agreeing nor immediately refusing is productive.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Understand the business need, then discuss technical implications and alternatives', isCorrect: true },
                { id: 'b', text: 'Agree to build it as specified to maintain a good relationship', isCorrect: false },
                { id: 'c', text: 'Refuse because the architecture wasn\'t designed for this', isCorrect: false },
                { id: 'd', text: 'Estimate the work at 2x the actual effort to buy time', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Stakeholder alignment story',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you had to align multiple stakeholders (engineering, product, design, business) who had conflicting priorities. How did you find a path forward?',
            explanation: 'Strong answers demonstrate: (1) Understanding each stakeholder\'s perspective, (2) Finding common ground, (3) Data-driven prioritization, (4) Clear communication, (5) A solution that addressed the core needs of all parties.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Multiple stakeholder perspectives understood, (2) Conflict clearly described, (3) Facilitation approach shown, (4) Creative solution found, (5) Outcome satisfied key stakeholders.',
            },
          },
        },
        {
          title: 'Communicating technical decisions',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'How would you explain to a non-technical executive why a database migration is necessary, despite having no user-visible impact? Write the key points of your explanation.',
            explanation: 'Frame in business terms: risk reduction, cost savings, future feature velocity, reliability improvements. Use analogies and concrete numbers.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 1500,
              rubric: 'Evaluate: (1) Business value clearly articulated, (2) Risk framed in terms executives understand, (3) No unnecessary jargon, (4) Concrete metrics/estimates, (5) Compelling narrative.',
            },
          },
        },
        {
          title: 'Communication adaptation',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'In one sentence, how would you explain "eventual consistency" to a product manager who wants to know why a user\'s data doesn\'t update immediately?',
            explanation: 'A good non-technical explanation: "The system prioritizes speed by showing the update across all servers within a few seconds rather than making users wait until every server confirms."',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 300,
            },
          },
        },
        {
          title: 'Stakeholder communication matching',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each audience to the most effective way to frame a technical delay:',
            explanation: 'Different stakeholders care about different aspects of the same issue. Adapt your message to their perspective and priorities.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'CEO', right: 'Revenue impact and mitigation timeline' },
                { id: 'p2', left: 'Product Manager', right: 'Feature scope trade-offs and alternatives' },
                { id: 'p3', left: 'Engineering Team', right: 'Technical root cause and fix approach' },
                { id: 'p4', left: 'Customer Support', right: 'User impact and expected resolution' },
              ],
            },
          },
        },
        {
          title: 'Saying no constructively',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL constructive ways to push back on an unrealistic deadline:',
            explanation: 'Constructive pushback offers alternatives and data. Demanding more time without justification or silently under-delivering are both ineffective.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Present a reduced scope that can meet the deadline', isCorrect: true },
                { id: 'b', text: 'Show a breakdown of work items with time estimates', isCorrect: true },
                { id: 'c', text: 'Propose a phased delivery with an MVP first', isCorrect: true },
                { id: 'd', text: 'Simply say "that\'s not possible" without alternatives', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP6: Failure, Recovery & Growth Mindset — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Failure, Recovery & Growth Mindset',
      description: 'Discuss failures authentically, demonstrate resilience, and show continuous learning.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Framework', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Talking About Failure',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'How to Discuss Failures in Interviews',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Why Interviewers Ask About Failure', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Failure questions test self-awareness, accountability, and growth mindset. Interviewers want to see that you take responsibility (not blame others), learn from mistakes, and implement changes to prevent recurrence. A candidate who has never failed is either lying or hasn\'t taken on challenging enough work.' },
                { id: 'b3', type: 'heading', content: 'Choosing the Right Failure Story', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Choose a real, meaningful failure — not a humble brag ("I worked too hard")',
                  'Pick something where YOU made a specific mistake or misjudgment',
                  'Ensure the failure led to concrete learning and behavior change',
                  'Avoid failures that reveal fundamental character flaws or ethical issues',
                  'The failure should be recoverable — you fixed it or learned from it',
                ] } },
                { id: 'b5', type: 'heading', content: 'The Recovery Arc', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'The most important part of a failure story is the recovery. What did you learn? What processes did you put in place? How did it change your approach going forward? Show that you have a growth mindset — you view failures as learning opportunities, not as reasons to avoid risk.' },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'Failure story elements',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the most important element of a failure story in a behavioral interview?',
            explanation: 'The recovery and learning are most important. Interviewers expect everyone to fail — they want to see how you respond, what you learn, and how you prevent recurrence.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'What you learned and how you changed your approach', isCorrect: true },
                { id: 'b', text: 'How dramatic or impactful the failure was', isCorrect: false },
                { id: 'c', text: 'Who else was involved or responsible', isCorrect: false },
                { id: 'd', text: 'The technical complexity of the situation', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Describe a significant failure',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you made a significant technical mistake that impacted production or your team. What happened, how did you respond, and what did you learn?',
            explanation: 'Strong failure stories show: accountability, clear root cause analysis, immediate response, systemic prevention, and genuine learning that changed future behavior.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Takes personal responsibility (no blame-shifting), (2) Clear description of the mistake, (3) Immediate response actions, (4) Root cause analysis, (5) Specific learnings and changes implemented.',
            },
          },
        },
        {
          title: 'Growth mindset demonstration',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a skill or area where you were initially weak but deliberately improved over time. What was your learning strategy, and how do you know you improved?',
            explanation: 'Growth mindset answers show self-awareness of weaknesses, a deliberate improvement plan, measurable progress, and ongoing commitment to learning.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Honest self-assessment, (2) Specific learning strategies used, (3) Measurable improvement shown, (4) Ongoing commitment to growth, (5) Application to current work.',
            },
          },
        },
        {
          title: 'Failure response evaluation',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL indicators of a strong failure response in an interview answer:',
            explanation: 'Strong failure responses show accountability, systematic follow-up, and genuine learning. Minimizing the failure or blaming external factors are red flags.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Taking personal accountability without deflecting', isCorrect: true },
                { id: 'b', text: 'Describing specific process changes implemented after', isCorrect: true },
                { id: 'c', text: 'Sharing the failure as a learning story with the team', isCorrect: true },
                { id: 'd', text: 'Minimizing the impact to avoid looking bad', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Postmortem culture',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'What makes a blameless postmortem culture effective, and how have you contributed to building one?',
            explanation: 'Blameless postmortems focus on systemic issues, not individual fault. They encourage honest reporting, identify process gaps, and create actionable improvements.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Failure story red flags',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Which failure story would be a RED FLAG in an interview?',
            explanation: 'A humble brag disguised as failure ("I was too dedicated") shows lack of self-awareness and doesn\'t demonstrate genuine learning from real mistakes.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: '"My biggest failure is that I care too much about code quality"', isCorrect: true },
                { id: 'b', text: '"I shipped a feature without proper testing and it caused a 2-hour outage"', isCorrect: false },
                { id: 'c', text: '"I underestimated a migration and it took 3x longer than planned"', isCorrect: false },
                { id: 'd', text: '"I chose the wrong database for a project and we had to migrate later"', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP7: Ambiguity & Prioritization — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Ambiguity & Prioritization',
      description: 'Navigate unclear requirements, competing priorities, and make decisions with incomplete information.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Frameworks', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Navigating Ambiguity',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Decision-Making Under Uncertainty',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Why Ambiguity Questions Matter', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'At senior+ levels, you rarely get clear, well-defined requirements. Interviewers want to see that you can break down ambiguous problems, make reasonable assumptions, identify the most important unknowns, and drive toward a solution without waiting for perfect information. This is a critical distinction between senior and staff-level engineers.' },
                { id: 'b3', type: 'heading', content: 'Prioritization Frameworks', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Impact vs Effort matrix: Plot tasks on a 2x2 grid. Do high-impact/low-effort first, plan high-impact/high-effort, defer low-impact items.',
                  'RICE: Reach × Impact × Confidence / Effort — quantitative prioritization framework.',
                  'MoSCoW: Must have, Should have, Could have, Won\'t have — useful for scope negotiations.',
                  'Cost of Delay: What is the cost per week of NOT doing this? Useful for tech debt prioritization.',
                ] } },
                { id: 'b5', type: 'heading', content: 'Making Reversible vs Irreversible Decisions', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Jeff Bezos\' "one-way door vs two-way door" framework: Reversible decisions (two-way doors) should be made quickly with 70% information. Irreversible decisions (one-way doors) deserve more analysis. Most decisions are two-way doors — bias toward action and course-correct as you learn more.' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Prioritization frameworks',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'matching',
            content: 'Match each prioritization framework to its best use case:',
            explanation: 'Each framework suits different contexts: RICE for quantitative product decisions, MoSCoW for scope negotiation, Impact/Effort for quick triage, Cost of Delay for tech debt.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Impact vs Effort Matrix', right: 'Quick visual triage of backlog items' },
                { id: 'p2', left: 'RICE Scoring', right: 'Quantitative product feature prioritization' },
                { id: 'p3', left: 'MoSCoW Method', right: 'Scope negotiation with stakeholders' },
                { id: 'p4', left: 'Cost of Delay', right: 'Justifying technical debt remediation' },
              ],
            },
          },
        },
        {
          title: 'Ambiguous project story',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you were given a project with vague or incomplete requirements. How did you clarify scope, make decisions, and deliver results?',
            explanation: 'Strong answers show: (1) Proactive requirement gathering, (2) Reasonable assumption-making, (3) Iterative approach, (4) Stakeholder communication, (5) Successful delivery despite ambiguity.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Active steps to reduce ambiguity, (2) Smart assumptions documented, (3) Iterative/incremental approach, (4) Stakeholder alignment, (5) Delivered meaningful outcome.',
            },
          },
        },
        {
          title: 'Priority conflict resolution',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'You have three projects with competing deadlines: a critical bug fix (P0), a feature your PM says is the top priority, and a tech debt task that\'s been deferred for 6 months. How do you prioritize and communicate your plan?',
            explanation: 'Strong answers address urgency vs importance, communicate trade-offs clearly, propose a plan that handles the critical bug first, and negotiate timeline for the other items.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) P0 bug addressed first, (2) Clear communication to stakeholders, (3) Trade-off analysis for remaining items, (4) Realistic plan proposed, (5) Proactive timeline negotiation.',
            },
          },
        },
        {
          title: 'Decision-making speed',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'According to the "one-way door vs two-way door" framework, what percentage of information is typically sufficient to make a reversible decision?',
            explanation: 'For reversible (two-way door) decisions, 70% information is usually enough. Waiting for 90%+ means you\'re moving too slowly. You can always course-correct.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: '70% — bias toward action and iterate', isCorrect: true },
                { id: 'b', text: '95% — ensure you have nearly complete information', isCorrect: false },
                { id: 'c', text: '50% — just flip a coin if it\'s reversible', isCorrect: false },
                { id: 'd', text: '100% — never make a decision without full information', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Scope creep management',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'A project you\'re leading keeps expanding in scope as stakeholders add "just one more thing." How do you manage this?',
            explanation: 'Establish clear success criteria upfront, document scope changes formally, communicate timeline impact, and use MoSCoW to categorize additions. Say yes to the idea but negotiate the timeline or cut lower-priority items.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Working with uncertainty',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL effective strategies for making progress on an ambiguous project:',
            explanation: 'Ambiguous projects benefit from incremental discovery, prototyping, stakeholder check-ins, and flexible timelines. Waiting for perfect requirements guarantees missed deadlines.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Build a prototype to validate assumptions quickly', isCorrect: true },
                { id: 'b', text: 'Break the problem into smaller, well-defined pieces', isCorrect: true },
                { id: 'c', text: 'Schedule frequent check-ins to validate direction', isCorrect: true },
                { id: 'd', text: 'Wait until all requirements are perfectly defined', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP8: Staff+ Level Questions — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Staff+ Level Questions',
      description: 'Advanced behavioral questions for staff, principal, and distinguished engineer levels.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Staff+ Expectations', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Staff+ Level Expectations',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'What Makes Staff+ Different',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Scope & Impact', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Staff+ engineers are evaluated on organization-wide impact, not individual output. Your stories should demonstrate: setting technical direction for multiple teams, driving adoption of standards across the org, identifying and solving problems no one asked you to solve, and multiplying the effectiveness of engineers around you.' },
                { id: 'b3', type: 'heading', content: 'Key Differentiators', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Vision & Strategy: Multi-quarter or multi-year technical roadmap ownership',
                  'Cross-org influence: Working across engineering, product, and business teams',
                  'Multiplier effect: Making 10 engineers 20% more effective > your individual output',
                  'Industry perspective: Drawing on knowledge from across the industry, not just your company',
                  'Organizational design: Shaping team structures, processes, and technical culture',
                ] } },
                { id: 'b5', type: 'heading', content: 'Common Staff+ Interview Questions', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Expect questions about: driving technical strategy, resolving org-level technical debt, building platforms used by multiple teams, making build-vs-buy decisions, and navigating organizational politics while maintaining technical integrity. Your answers should show systemic thinking and business awareness.' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Staff vs Senior scope',
          type: 'question',
          sectionId: 'sec_concepts',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What primarily distinguishes a staff engineer from a senior engineer in behavioral interviews?',
            explanation: 'Staff engineers are evaluated on organization-wide impact and multiplier effects, while senior engineers demonstrate strong individual and team-level contributions.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Organization-wide impact and multiplying team effectiveness', isCorrect: true },
                { id: 'b', text: 'Writing more complex code', isCorrect: false },
                { id: 'c', text: 'Having more years of experience', isCorrect: false },
                { id: 'd', text: 'Managing a larger team directly', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Drive technical strategy',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you identified a significant technical problem or opportunity that no one asked you to work on. How did you build a case for it, get organizational buy-in, and drive it to completion?',
            explanation: 'Staff+ answers show self-directed problem finding, business case building, cross-org coalition building, execution over multiple quarters, and measurable organizational impact.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Self-directed problem identification, (2) Business case with quantified impact, (3) Cross-org buy-in strategy, (4) Multi-quarter execution plan, (5) Measurable organizational outcome.',
            },
          },
        },
        {
          title: 'Multiplier effect story',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a time you made multiple engineering teams significantly more productive. What did you build, change, or establish, and how did you measure the impact?',
            explanation: 'Multiplier stories include: building internal platforms, establishing coding standards, creating shared libraries, improving CI/CD, or driving architecture changes that reduced complexity across teams.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Multiple teams impacted, (2) Concrete improvement built or established, (3) Adoption strategy across teams, (4) Measurable productivity gains, (5) Sustained long-term impact.',
            },
          },
        },
        {
          title: 'Build vs buy decision',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'What factors do you consider when making a build vs buy decision for infrastructure tooling?',
            explanation: 'Key factors: team expertise, customization needs, total cost of ownership, vendor lock-in risk, maintenance burden, strategic importance, and time-to-market pressure.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Organizational politics',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you had to navigate organizational politics to get a technical initiative approved. How did you identify the key decision-makers and build support?',
            explanation: 'Shows political savvy while maintaining technical integrity. Strong answers demonstrate stakeholder mapping, building allies, timing proposals strategically, and framing technical needs in business terms.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Stakeholder analysis done, (2) Strategic approach to building support, (3) Technical integrity maintained, (4) Business framing used, (5) Successful outcome achieved.',
            },
          },
        },
        {
          title: 'Staff+ antipatterns',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL antipatterns that suggest a candidate is NOT operating at a staff+ level:',
            explanation: 'Staff+ engineers think beyond their team, drive direction proactively, and impact org-wide outcomes. Focusing only on personal code output or waiting for direction are senior-level patterns.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'All stories focus on individual coding achievements', isCorrect: true },
                { id: 'b', text: 'Waiting for management to identify problems to solve', isCorrect: true },
                { id: 'c', text: 'No examples of cross-team or cross-org impact', isCorrect: true },
                { id: 'd', text: 'Describing trade-offs between speed and quality', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP9: Company-Specific FAANG Preparation — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Company-Specific FAANG Preparation',
      description: 'Tailor your behavioral answers for Google, Meta, Amazon, Apple, and Netflix interview cultures.',
      type: 'standard',
      sections: [
        { id: 'sec_companies', title: 'Company Frameworks', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'FAANG Behavioral Frameworks',
          type: 'material',
          sectionId: 'sec_companies',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Company-Specific Interview Expectations',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Amazon — Leadership Principles', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Amazon interviews are structured around their 16 Leadership Principles (LPs). Every behavioral question maps to 1-2 LPs. The most critical for senior roles: Customer Obsession, Ownership, Dive Deep, Have Backbone; Disagree and Commit, Deliver Results, and Earn Trust. Prepare 2-3 stories per LP. Amazon interviewers will probe deeply — prepare follow-up answers for "tell me more about that" and "what would you do differently?"' },
                { id: 'b3', type: 'heading', content: 'Google — Googleyness & Leadership', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Google evaluates "Googleyness" — thriving in ambiguity, taking action without being told, collaborating across boundaries, and putting the user first. For staff+ roles, they heavily weight "Leadership" — driving impact beyond your immediate team and upleveling those around you. Focus on stories showing initiative, collaboration, and user-centric thinking.' },
                { id: 'b5', type: 'heading', content: 'Meta — Move Fast & Build Social Value', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Meta values speed, impact, and openness. Behavioral questions focus on: shipping at scale, making bold bets, learning from data, and building for billions of users. They want to see that you can balance moving fast with making good decisions. Stories about rapid iteration, data-driven decisions, and large-scale impact resonate well.' },
                { id: 'b7', type: 'heading', content: 'Netflix — Freedom & Responsibility', metadata: { level: 2 } },
                { id: 'b8', type: 'paragraph', content: 'Netflix values radical candor, independent decision-making, and context over control. They look for: exceptional judgment, comfort with ambiguity, selfless candor, and courage to make tough calls. Stories should demonstrate independent thinking, open feedback, and decisions made without waiting for approval.' },
              ],
              readingTime: 10,
            },
          },
        },
        {
          title: 'Amazon Leadership Principles',
          type: 'material',
          sectionId: 'sec_companies',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Deep Dive: Amazon Leadership Principles',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Top 6 LPs for Senior/Staff Roles', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Customer Obsession: Start with the customer and work backwards. Show how you advocated for user needs.',
                  'Ownership: Think long-term, act on behalf of the entire company. Never say "that\'s not my job."',
                  'Dive Deep: Leaders operate at all levels, stay connected to details, audit frequently.',
                  'Have Backbone; Disagree and Commit: Respectfully challenge decisions, then commit wholly.',
                  'Earn Trust: Listen, speak candidly, treat others respectfully, be self-critical.',
                  'Deliver Results: Focus on key inputs, deliver with quality and timeliness despite setbacks.',
                ] } },
                { id: 'b3', type: 'heading', content: 'LP Story Mapping Strategy', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Map each of your 8-12 stories to 2-3 LPs. A strong Amazon behavioral round includes 4-6 LP questions in 45-60 minutes. Each answer should be 3-5 minutes. Practice timing your responses to ensure you cover S, T, A, and R within the time limit.' },
              ],
              readingTime: 6,
            },
          },
        },
        {
          title: 'Amazon LP matching',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each Amazon Leadership Principle to the type of story that best demonstrates it:',
            explanation: 'Each LP maps to specific behavioral patterns. Customer Obsession = user advocacy, Ownership = going beyond scope, Dive Deep = debugging/investigation, Earn Trust = honest communication.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Customer Obsession', right: 'Advocating for user needs against internal pressure' },
                { id: 'p2', left: 'Ownership', right: 'Fixing a problem outside your team\'s scope' },
                { id: 'p3', left: 'Dive Deep', right: 'Investigating root cause through multiple layers' },
                { id: 'p4', left: 'Earn Trust', right: 'Admitting a mistake and being transparent' },
              ],
            },
          },
        },
        {
          title: 'Company culture fit',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Using Amazon\'s "Customer Obsession" Leadership Principle, write a STAR response about a time you advocated for a customer/user need that conflicted with an internal priority or timeline.',
            explanation: 'A strong Customer Obsession story shows: (1) Clear user need identified, (2) Conflict with internal priorities, (3) Data used to build the case, (4) Advocacy despite resistance, (5) Positive user outcome.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear user need, (2) Internal conflict described, (3) Data-driven advocacy, (4) Persistent but professional approach, (5) Measurable user impact.',
            },
          },
        },
        {
          title: 'Googleyness traits',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL traits that Google evaluates under "Googleyness":',
            explanation: 'Googleyness includes thriving in ambiguity, taking initiative, collaborating across boundaries, and user-centric thinking. Having the most years of experience is not a Googleyness trait.',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Thriving in ambiguity', isCorrect: true },
                { id: 'b', text: 'Taking action without being told', isCorrect: true },
                { id: 'c', text: 'Collaborating across team boundaries', isCorrect: true },
                { id: 'd', text: 'Having the most years of industry experience', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Netflix culture answer',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: 'Netflix values "radical candor." Describe a situation where you gave direct, honest feedback that was difficult but necessary. Keep it to 2-3 sentences.',
            explanation: 'Radical candor means caring personally while challenging directly. The best answers show courage to speak up combined with genuine care for the person receiving the feedback.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 400,
            },
          },
        },
        {
          title: 'Company comparison',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'Which company\'s behavioral interview is MOST structured around a specific set of principles that you should explicitly reference in your answers?',
            explanation: 'Amazon is uniquely structured around their 16 Leadership Principles. Each behavioral question maps to specific LPs, and interviewers score against those LPs. Other companies have values but don\'t structure interviews as rigidly around them.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Amazon — 16 Leadership Principles structure every question', isCorrect: true },
                { id: 'b', text: 'Google — Googleyness is a rigid framework', isCorrect: false },
                { id: 'c', text: 'Meta — Move Fast is the only evaluation criteria', isCorrect: false },
                { id: 'd', text: 'Netflix — All questions reference the culture deck', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP10: Mock Interview Practice — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Mock Interview Practice',
      description: 'Practice answering common behavioral questions in a simulated interview environment.',
      type: 'practice',
      sections: [
        { id: 'sec_warmup', title: 'Warm-Up', orderIndex: 0 },
        { id: 'sec_deep', title: 'Deep Dive', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Mock Interview Tips',
          type: 'material',
          sectionId: 'sec_warmup',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Getting the Most from Mock Practice',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Practice Like It\'s Real', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Time yourself — aim for 3-5 minute responses. Record yourself and listen back. Practice speaking out loud, not just writing. Notice filler words, pacing, and whether you sound confident or uncertain. The gap between "knowing" an answer and "delivering" it smoothly is bridged only through practice.' },
                { id: 'b3', type: 'heading', content: 'Self-Evaluation Criteria', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Did I follow STAR structure? (Situation → Task → Action → Result)',
                  'Was my Action section the longest part? (~60% of the answer)',
                  'Did I use "I" and describe MY specific contributions?',
                  'Did I include concrete metrics in my Result?',
                  'Did I show what I LEARNED or how I GREW?',
                  'Was I under 5 minutes? (Aim for 3-4 minutes for most questions)',
                ] } },
              ],
              readingTime: 5,
            },
          },
        },
        {
          title: 'Tell me about yourself',
          type: 'question',
          sectionId: 'sec_warmup',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: '"Tell me about yourself." This is usually the first question. Write a 2-minute professional introduction that covers your background, key achievements, and why you\'re interested in this role.',
            explanation: 'A strong intro follows: Present (current role + key project), Past (relevant experience + growth), Future (why this opportunity). Keep it to 2 minutes, focus on impact, and customize the "future" part for the target company.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 1500,
              rubric: 'Evaluate: (1) Present-Past-Future structure, (2) Key achievements with metrics, (3) Concise and engaging delivery, (4) Relevant to senior/staff engineering, (5) Natural and authentic tone.',
            },
          },
        },
        {
          title: 'Why are you leaving?',
          type: 'question',
          sectionId: 'sec_warmup',
          difficulty: 'medium',
          payload: {
            questionType: 'text',
            content: '"Why are you looking to leave your current role?" Write a professional response that is honest but positive.',
            explanation: 'Focus on what you\'re looking FOR, not what you\'re running FROM. Emphasize growth opportunities, technical challenges, or company mission. Never badmouth your current employer.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              maxLength: 500,
            },
          },
        },
        {
          title: 'Most impactful project',
          type: 'question',
          sectionId: 'sec_deep',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: '"What is the most impactful project you\'ve worked on in your career?" Use STAR format and focus on a project that demonstrates staff+ level impact.',
            explanation: 'The best answers show: broad organizational impact, technical depth, leadership, and quantified business outcomes. Pick a project where your contribution was clearly differentiated.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Staff+ level scope and impact, (2) Strong STAR structure, (3) Technical depth demonstrated, (4) Quantified outcomes, (5) Leadership and influence shown.',
            },
          },
        },
        {
          title: 'Handle pushback',
          type: 'question',
          sectionId: 'sec_deep',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: '"Tell me about a time you received pushback on a technical proposal. How did you handle it?" Provide a staff-level response.',
            explanation: 'Staff+ engineers handle pushback by: listening to understand (not to respond), using data to support positions, being willing to adjust, and ultimately making the best decision for the org.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear technical proposal described, (2) Pushback reasons understood, (3) Data-driven response, (4) Willingness to adapt, (5) Professional resolution.',
            },
          },
        },
        {
          title: 'Drive organizational change',
          type: 'question',
          sectionId: 'sec_deep',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: '"Describe a time you drove a significant organizational or process change." Use the STAR method.',
            explanation: 'Organizational change stories at staff+ level should show: identifying the need, building a coalition, managing resistance, implementing incrementally, and measuring success.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Clear need identified, (2) Coalition-building approach, (3) Change management strategy, (4) Resistance handled constructively, (5) Measurable improvement.',
            },
          },
        },
        {
          title: 'Interview follow-up',
          type: 'question',
          sectionId: 'sec_deep',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL good questions to ask the interviewer at the end of a behavioral round:',
            explanation: 'Good closing questions show genuine interest and research. They should be specific to the role/team, demonstrate curiosity about the company\'s challenges, and be questions you actually want answered.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: '"What\'s the biggest technical challenge your team is facing right now?"', isCorrect: true },
                { id: 'b', text: '"How does the team handle disagreements on technical direction?"', isCorrect: true },
                { id: 'c', text: '"What does success look like in the first 6 months?"', isCorrect: true },
                { id: 'd', text: '"What\'s the salary range for this position?"', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP11: Behavioral Interview Quiz — quiz
    // ═══════════════════════════════════════════════════════
    {
      title: 'Behavioral Interview Concepts Quiz',
      description: 'Test your knowledge of behavioral interview frameworks, STAR method, and company-specific preparation.',
      type: 'quiz',
      assessmentConfig: {
        maxAttempts: 3,
        shuffleQuestions: true,
        showResultsImmediately: true,
        passingPercentage: 70,
      },
      sections: [
        { id: 'sec_quiz', title: 'Quiz', orderIndex: 0 },
      ],
      items: [
        {
          title: 'STAR time allocation',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What percentage of a STAR response should be spent on the Action component?',
            explanation: 'The Action component should be approximately 60% of your response, as this is where you demonstrate your skills, decision-making, and leadership.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: '60% — Actions reveal your capabilities', isCorrect: true },
                { id: 'b', text: '25% — Split equally across all four components', isCorrect: false },
                { id: 'c', text: '40% — Result should be equally long', isCorrect: false },
                { id: 'd', text: '10% — Keep actions brief', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Story bank size',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'How many prepared stories should you have in your "story bank" for behavioral interviews?',
            explanation: '8-12 stories is the sweet spot. Each story should be adaptable to multiple question types, covering different competencies across your career.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: '8-12 stories, each adaptable to multiple questions', isCorrect: true },
                { id: 'b', text: '2-3 stories that cover everything', isCorrect: false },
                { id: 'c', text: '50+ stories for every possible question', isCorrect: false },
                { id: 'd', text: '1 story per year of experience', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Failure story best practice',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'When answering "Tell me about a failure," what is the most important element?',
            explanation: 'What you learned and the changes you implemented are most important. Everyone fails — interviewers want to see growth mindset and accountability.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'The recovery: what you learned and changed as a result', isCorrect: true },
                { id: 'b', text: 'The drama: how severe the failure was', isCorrect: false },
                { id: 'c', text: 'The blame: who else was responsible', isCorrect: false },
                { id: 'd', text: 'The excuse: why it wasn\'t entirely your fault', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Amazon LP structure',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'Amazon behavioral interviews are structured around their 16 Leadership Principles, and each interview question maps to 1-2 specific principles.',
            explanation: 'True. Amazon has the most structured behavioral interview process among FAANG companies. Each question is designed to evaluate specific Leadership Principles, and interviewers score candidates against those LPs.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              correctAnswer: true,
            },
          },
        },
        {
          title: 'Disagree and commit',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What does "disagree and commit" mean in practice?',
            explanation: 'Disagree and commit means raising your concerns during the decision process, then fully supporting and executing the decision once it\'s made, even if you would have chosen differently.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Voice your objections, then fully commit to the team\'s decision', isCorrect: true },
                { id: 'b', text: 'Agree publicly but implement your preferred approach', isCorrect: false },
                { id: 'c', text: 'Keep disagreeing until the team changes their mind', isCorrect: false },
                { id: 'd', text: 'Never disagree with the team to maintain harmony', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Staff+ behavioral focus',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL characteristics that differentiate staff+ behavioral answers from senior-level answers:',
            explanation: 'Staff+ engineers demonstrate org-wide impact, multiplier effects, and long-term strategic thinking beyond individual or single-team contributions.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Organization-wide impact scope', isCorrect: true },
                { id: 'b', text: 'Multiplying effectiveness of other engineers', isCorrect: true },
                { id: 'c', text: 'Multi-quarter strategic planning', isCorrect: true },
                { id: 'd', text: 'Writing the most lines of code', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Reversible decisions',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'For reversible ("two-way door") decisions, you should wait until you have 95% of the information before proceeding.',
            explanation: 'False. For reversible decisions, 70% information is sufficient. Waiting for 95% leads to analysis paralysis. Make the decision, learn from the outcome, and course-correct as needed.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              correctAnswer: false,
            },
          },
        },
        {
          title: 'SBI framework purpose',
          type: 'question',
          sectionId: 'sec_quiz',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the SBI (Situation-Behavior-Impact) framework primarily used for?',
            explanation: 'SBI is a framework for giving constructive feedback. It keeps feedback objective by describing the specific Situation, the observable Behavior, and the measurable Impact.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Giving constructive feedback in a structured, objective way', isCorrect: true },
                { id: 'b', text: 'Prioritizing engineering tasks in a sprint', isCorrect: false },
                { id: 'c', text: 'Structuring system design interviews', isCorrect: false },
                { id: 'd', text: 'Writing performance reviews', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP12: Behavioral Interview Timed Assessment — timed_test
    // ═══════════════════════════════════════════════════════
    {
      title: 'Behavioral Interview Timed Assessment',
      description: 'Comprehensive timed assessment covering STAR method, leadership, conflict resolution, company-specific preparation, and staff-level behavioral competencies.',
      type: 'timed_test',
      assessmentConfig: {
        durationMinutes: 45,
        maxAttempts: 1,
        shuffleQuestions: true,
        showResultsImmediately: false,
        passingPercentage: 60,
      },
      sections: [
        { id: 'sec_test', title: 'Assessment', orderIndex: 0 },
      ],
      items: [
        {
          title: 'STAR method application',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'When using the STAR method, which pronoun should you predominantly use to describe your contributions?',
            explanation: 'Use "I" to clearly describe YOUR personal contributions. Using "we" too much obscures your individual impact, which is exactly what the interviewer is trying to assess.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: '"I" — to clearly highlight your personal contributions', isCorrect: true },
                { id: 'b', text: '"We" — to show you\'re a team player', isCorrect: false },
                { id: 'c', text: '"They" — to credit the team', isCorrect: false },
                { id: 'd', text: '"One" — to remain formal and detached', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Ideal response length',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the ideal length for a behavioral interview response?',
            explanation: '3-5 minutes allows enough time to cover all STAR components without losing the interviewer\'s attention. Under 2 minutes usually lacks depth; over 5 minutes loses engagement.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: '3-5 minutes', isCorrect: true },
                { id: 'b', text: '1-2 minutes', isCorrect: false },
                { id: 'c', text: '7-10 minutes', isCorrect: false },
                { id: 'd', text: '15+ minutes for detailed stories', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Leadership vs management',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'A staff engineer\'s primary mode of leadership is "influence without authority" — driving decisions through expertise and trust rather than positional power.',
            explanation: 'True. Unlike managers who have direct authority, staff engineers lead through technical expertise, trust, data-driven arguments, and building consensus across teams.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              correctAnswer: true,
            },
          },
        },
        {
          title: 'Conflict approach',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'A heated code review thread is escalating between two team members. As tech lead, what should you do FIRST?',
            explanation: 'Moving the conversation offline (video call or in-person) is the best first step. Written communication loses tone and often escalates conflicts. A synchronous conversation allows for nuance and de-escalation.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Suggest moving the discussion to a quick video call', isCorrect: true },
                { id: 'b', text: 'Post your own opinion in the thread to settle it', isCorrect: false },
                { id: 'c', text: 'Close the PR and rewrite the code yourself', isCorrect: false },
                { id: 'd', text: 'Escalate to the engineering manager immediately', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Comprehensive leadership story',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you identified a critical technical risk or opportunity, built a business case for addressing it, and led the effort to completion across multiple teams. Include the challenge, your approach, and quantified outcomes.',
            explanation: 'This is the quintessential staff+ question. The best answers demonstrate: proactive problem identification, business-aware thinking, cross-org leadership, execution excellence, and measurable impact.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Self-directed identification of opportunity, (2) Business case with data, (3) Cross-team coordination, (4) Execution and obstacle management, (5) Quantified organizational impact.',
            },
          },
        },
        {
          title: 'Navigate ambiguity',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Describe a time you were given a project with no clear requirements or success criteria. How did you define the problem, make progress, and know when you were done?',
            explanation: 'Ambiguity stories should show: proactive scoping, stakeholder interviews, assumption documentation, iterative delivery, and defining success criteria yourself.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Active steps to reduce ambiguity, (2) Self-defined success criteria, (3) Iterative approach with checkpoints, (4) Stakeholder management, (5) Meaningful outcome delivered.',
            },
          },
        },
        {
          title: 'FAANG culture knowledge',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each company to its primary behavioral interview focus:',
            explanation: 'Each FAANG company has a distinct interview culture: Amazon = Leadership Principles, Google = Googleyness, Meta = Scale + Impact, Netflix = Freedom & Responsibility.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Amazon', right: '16 Leadership Principles' },
                { id: 'p2', left: 'Google', right: 'Googleyness & Collaborative Leadership' },
                { id: 'p3', left: 'Meta', right: 'Speed, Scale, and Data-Driven Impact' },
                { id: 'p4', left: 'Netflix', right: 'Freedom, Responsibility, and Radical Candor' },
              ],
            },
          },
        },
        {
          title: 'Growth mindset response',
          type: 'question',
          sectionId: 'sec_test',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Tell me about a time you received critical feedback that was hard to hear. How did you process it and what changes did you make?',
            explanation: 'Growth mindset answers show: emotional maturity (processing rather than reacting), extracting value from criticism, implementing specific changes, and following up to verify improvement.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              maxLength: 2000,
              rubric: 'Evaluate: (1) Honest emotional reaction acknowledged, (2) Reflective processing, (3) Value extracted from feedback, (4) Specific behavioral changes, (5) Follow-up and improvement verified.',
            },
          },
        },
      ],
    },
  ],
};
