/**
 * DSA Space — Data Structures & Algorithms seed configuration
 * 12 story points × ~7 items = ~84 items total
 */
import type { SpaceSeed } from './subhang-content.js';

export const dsaSpace: SpaceSeed = {
  title: 'Data Structures & Algorithms',
  description: 'Master data structures and algorithms from arrays to advanced graph algorithms and dynamic programming, preparing for staff-level technical interviews.',
  subject: 'Computer Science',
  classIds: [],
  teacherIndex: 0,
  type: 'hybrid',
  storyPoints: [
    // ═══════════════════════════════════════════════════════
    // SP1: Arrays & Strings Foundations — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Arrays & Strings Foundations',
      description: 'Master two pointers, sliding window, and prefix sums for array and string problems.',
      type: 'standard',
      sections: [
        { id: 'sec_concepts', title: 'Core Concepts', orderIndex: 0 },
        { id: 'sec_practice', title: 'Practice', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Array Patterns Overview',
          type: 'material',
          sectionId: 'sec_concepts',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Array Patterns Overview',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Two Pointers Pattern', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'The two-pointer technique uses two indices that move toward each other or in the same direction to solve problems in O(n) time. Common applications include finding pairs with a target sum in sorted arrays, removing duplicates in-place, and the Dutch National Flag problem.' },
                { id: 'b3', type: 'heading', content: 'Sliding Window', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'The sliding window pattern maintains a window of elements that expands or contracts as you iterate. It\'s ideal for subarray/substring problems: maximum sum subarray of size k, longest substring without repeating characters, and minimum window substring.' },
                { id: 'b5', type: 'code', content: '// Two pointers: pair with target sum in sorted array\nfunction twoSum(nums: number[], target: number): [number, number] {\n  let left = 0, right = nums.length - 1;\n  while (left < right) {\n    const sum = nums[left] + nums[right];\n    if (sum === target) return [left, right];\n    if (sum < target) left++;\n    else right--;\n  }\n  return [-1, -1];\n}\n\n// Sliding window: max sum subarray of size k\nfunction maxSubarraySum(nums: number[], k: number): number {\n  let windowSum = 0, maxSum = -Infinity;\n  for (let i = 0; i < nums.length; i++) {\n    windowSum += nums[i];\n    if (i >= k) windowSum -= nums[i - k];\n    if (i >= k - 1) maxSum = Math.max(maxSum, windowSum);\n  }\n  return maxSum;\n}', metadata: { language: 'typescript' } },
                { id: 'b6', type: 'heading', content: 'Prefix Sums', metadata: { level: 2 } },
                { id: 'b7', type: 'paragraph', content: 'Prefix sums pre-compute cumulative sums so any subarray sum can be calculated in O(1). prefix[i] = sum of elements from index 0 to i. Subarray sum from i to j = prefix[j] - prefix[i-1]. This technique is essential for range sum queries and problems like "subarray sum equals K".' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Two pointers on sorted array',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the time complexity of the two-pointer technique for finding a pair with a target sum in a sorted array?',
            explanation: 'Two pointers traverse the array once from both ends, giving O(n) time complexity with O(1) space.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'O(n)', isCorrect: true },
                { id: 'b', text: 'O(n log n)', isCorrect: false },
                { id: 'c', text: 'O(n²)', isCorrect: false },
                { id: 'd', text: 'O(log n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Sliding window applications',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL problems that can be solved efficiently with the sliding window pattern:',
            explanation: 'Sliding window works for contiguous subarray/substring optimization problems. Finding the kth largest element requires a heap or quickselect, not sliding window.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Maximum sum subarray of size k', isCorrect: true },
                { id: 'b', text: 'Longest substring without repeating characters', isCorrect: true },
                { id: 'c', text: 'Minimum window substring', isCorrect: true },
                { id: 'd', text: 'Finding the kth largest element', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Prefix sum range query',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'numerical',
            content: 'Given array [2, 4, 6, 8, 10] and prefix sums [2, 6, 12, 20, 30], what is the sum of elements from index 1 to index 3 (inclusive)?',
            explanation: 'Sum from index 1 to 3 = prefix[3] - prefix[0] = 20 - 2 = 18. Or directly: 4 + 6 + 8 = 18.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: 18, tolerance: 0 },
          },
        },
        {
          title: 'Container with most water approach',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain the two-pointer approach to solve "Container With Most Water". Why does moving the shorter pointer inward guarantee we don\'t miss the optimal solution?',
            explanation: 'The greedy insight is that the area is limited by the shorter line. Moving the taller pointer inward can only decrease the area (width decreases and height is still bounded by the shorter line). Moving the shorter pointer gives a chance to find a taller line.',
            basePoints: 25,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'Start with pointers at both ends. The area = min(height[left], height[right]) × (right - left). Always move the pointer pointing to the shorter line inward. This works because: if we move the taller pointer, the width decreases by 1 and the height can only stay the same or decrease (bounded by the shorter line), so the area must decrease. Moving the shorter pointer might find a taller line that increases the limiting factor. This greedy choice ensures we explore all potentially optimal configurations in O(n) time.',
              minLength: 80,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Kadane\'s Algorithm',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'Kadane\'s algorithm finds the maximum subarray sum in O(n) time by maintaining a running _____ and resetting it when it becomes negative.',
            explanation: 'Kadane\'s algorithm maintains a running sum (current sum). At each step, it either extends the current subarray or starts a new one if the current sum goes negative.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'Kadane\'s algorithm finds the maximum subarray sum in O(n) time by maintaining a running {{blank1}} and resetting it when it becomes negative.',
              blanks: [
                { id: 'blank1', correctAnswer: 'sum', acceptableAnswers: ['sum', 'current sum', 'running sum', 'total'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'String reversal with two pointers',
          type: 'question',
          sectionId: 'sec_practice',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'Two pointers can reverse a string in-place using O(n) extra space.',
            explanation: 'False. Two pointers reverse a string in-place using O(1) extra space — swap characters at left and right pointers, then move them inward.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: false },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP2: Hash Maps & Sets Mastery — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Hash Maps & Sets Mastery',
      description: 'Master frequency counting, anagram detection, subarray sums, and hash map design.',
      type: 'standard',
      sections: [
        { id: 'sec_theory', title: 'Theory', orderIndex: 0 },
        { id: 'sec_problems', title: 'Problems', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Hash Map Internals',
          type: 'material',
          sectionId: 'sec_theory',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Hash Map Internals & Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'How Hash Maps Work', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'A hash map stores key-value pairs using a hash function to compute an index into an array of buckets. Average O(1) for insert, lookup, and delete. Worst case O(n) when all keys collide. Collision resolution: chaining (linked lists in buckets) or open addressing (probing).' },
                { id: 'b3', type: 'heading', content: 'Common Patterns', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Frequency counting: count occurrences of each element',
                  'Two-sum pattern: complement lookup in O(1)',
                  'Subarray sum equals K: prefix sum + hash map for O(n)',
                  'Group anagrams: sort string as key, or frequency array as key',
                  'First non-repeating character: frequency map + second pass',
                ] } },
                { id: 'b5', type: 'code', content: '// Subarray sum equals K using prefix sums + hash map\nfunction subarraySum(nums: number[], k: number): number {\n  const prefixCount = new Map<number, number>();\n  prefixCount.set(0, 1);\n  let sum = 0, count = 0;\n  for (const num of nums) {\n    sum += num;\n    count += prefixCount.get(sum - k) ?? 0;\n    prefixCount.set(sum, (prefixCount.get(sum) ?? 0) + 1);\n  }\n  return count;\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 6,
            },
          },
        },
        {
          title: 'Hash map average time complexity',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the average time complexity for lookup in a hash map?',
            explanation: 'Hash maps provide O(1) average-case lookup by computing a hash of the key to directly index into the underlying array.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'O(1)', isCorrect: true },
                { id: 'b', text: 'O(log n)', isCorrect: false },
                { id: 'c', text: 'O(n)', isCorrect: false },
                { id: 'd', text: 'O(n log n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Two Sum approach',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the optimal approach to solve Two Sum (unsorted array)?',
            explanation: 'Using a hash map, for each element check if (target - element) exists in the map. If yes, return the pair. If not, add the element. This runs in O(n) time.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Hash map with complement lookup — O(n)', isCorrect: true },
                { id: 'b', text: 'Sort then two pointers — O(n log n)', isCorrect: false },
                { id: 'c', text: 'Brute force nested loops — O(n²)', isCorrect: false },
                { id: 'd', text: 'Binary search for each element — O(n log n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Group Anagrams complexity',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'medium',
          payload: {
            questionType: 'numerical',
            content: 'If you group n strings of average length k by sorting each string as a key, what is the time complexity? Express as the exponent of k in O(n × k^x × log(k)). What is x?',
            explanation: 'Sorting each string takes O(k log k). For n strings: O(n × k log k). So x = 1.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: 1, tolerance: 0 },
          },
        },
        {
          title: 'Collision resolution strategies',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each collision resolution strategy to its description:',
            explanation: 'Chaining uses linked lists at each bucket. Linear probing checks the next slot. Quadratic probing uses quadratic increments. Double hashing uses a second hash function.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Chaining', right: 'Linked list at each bucket' },
                { id: 'p2', left: 'Linear probing', right: 'Check next consecutive slot' },
                { id: 'p3', left: 'Quadratic probing', right: 'Increment by squares (1, 4, 9...)' },
                { id: 'p4', left: 'Double hashing', right: 'Use second hash function for step size' },
              ],
            },
          },
        },
        {
          title: 'Design a HashMap',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'hard',
          payload: {
            questionType: 'code',
            content: 'Implement a simple HashMap class with put(key, value), get(key), and remove(key) methods using chaining for collision resolution.',
            explanation: 'Use an array of buckets where each bucket is a linked list (or array) of key-value pairs. Hash the key to find the bucket index, then search linearly within the bucket.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              language: 'typescript',
              starterCode: 'class MyHashMap {\n  // Implement put, get, remove\n}',
              modelAnswer: 'class MyHashMap {\n  private buckets: [number, number][][];\n  private size: number;\n\n  constructor(size = 1000) {\n    this.size = size;\n    this.buckets = new Array(size).fill(null).map(() => []);\n  }\n\n  private hash(key: number): number {\n    return key % this.size;\n  }\n\n  put(key: number, value: number): void {\n    const idx = this.hash(key);\n    const bucket = this.buckets[idx];\n    for (const pair of bucket) {\n      if (pair[0] === key) { pair[1] = value; return; }\n    }\n    bucket.push([key, value]);\n  }\n\n  get(key: number): number {\n    const bucket = this.buckets[this.hash(key)];\n    for (const pair of bucket) {\n      if (pair[0] === key) return pair[1];\n    }\n    return -1;\n  }\n\n  remove(key: number): void {\n    const idx = this.hash(key);\n    this.buckets[idx] = this.buckets[idx].filter(p => p[0] !== key);\n  }\n}',
            },
          },
        },
        {
          title: 'Load factor significance',
          type: 'question',
          sectionId: 'sec_problems',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'A hash map with a load factor greater than 1.0 is impossible when using open addressing.',
            explanation: 'True. In open addressing, each slot holds at most one element, so the load factor (n/capacity) cannot exceed 1.0. With chaining, load factor can exceed 1.0 since multiple elements share a bucket.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: true },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP3: Linked Lists & Stack/Queue Patterns — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Linked Lists & Stack/Queue Patterns',
      description: 'Reversal, cycle detection, monotonic stack, BFS with queue, and LRU cache design.',
      type: 'standard',
      sections: [
        { id: 'sec_ll', title: 'Linked Lists', orderIndex: 0 },
        { id: 'sec_stack', title: 'Stack & Queue', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Linked List Patterns',
          type: 'material',
          sectionId: 'sec_ll',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Linked List Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Key Patterns', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Reversal: Iterative (3 pointers: prev, curr, next) or recursive',
                  'Fast & Slow pointers: Cycle detection (Floyd\'s), finding middle node',
                  'Dummy head: Simplifies edge cases for insert/delete at head',
                  'Merge two sorted lists: Compare heads, advance smaller',
                ] } },
                { id: 'b3', type: 'code', content: '// Floyd\'s Cycle Detection\nfunction hasCycle(head: ListNode | null): boolean {\n  let slow = head, fast = head;\n  while (fast && fast.next) {\n    slow = slow!.next;\n    fast = fast.next.next;\n    if (slow === fast) return true;\n  }\n  return false;\n}\n\n// Reverse a linked list iteratively\nfunction reverseList(head: ListNode | null): ListNode | null {\n  let prev: ListNode | null = null;\n  let curr = head;\n  while (curr) {\n    const next = curr.next;\n    curr.next = prev;\n    prev = curr;\n    curr = next;\n  }\n  return prev;\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 5,
            },
          },
        },
        {
          title: 'Cycle detection algorithm',
          type: 'question',
          sectionId: 'sec_ll',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Which algorithm detects a cycle in a linked list using O(1) space?',
            explanation: 'Floyd\'s Tortoise and Hare algorithm uses two pointers moving at different speeds. If there\'s a cycle, they will eventually meet.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Floyd\'s Tortoise and Hare', isCorrect: true },
                { id: 'b', text: 'Hash set of visited nodes', isCorrect: false },
                { id: 'c', text: 'DFS traversal', isCorrect: false },
                { id: 'd', text: 'Binary search', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Reverse linked list pointers',
          type: 'question',
          sectionId: 'sec_ll',
          difficulty: 'medium',
          payload: {
            questionType: 'jumbled',
            content: 'Arrange the steps of iterative linked list reversal in correct order:',
            explanation: 'Save next, reverse the pointer, move prev forward, move curr forward. The key is saving next before modifying curr.next.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              items: [
                { id: 'j1', text: 'Save next = curr.next' },
                { id: 'j2', text: 'Set curr.next = prev' },
                { id: 'j3', text: 'Set prev = curr' },
                { id: 'j4', text: 'Set curr = next' },
              ],
              correctOrder: ['j1', 'j2', 'j3', 'j4'],
            },
          },
        },
        {
          title: 'Monotonic stack pattern',
          type: 'question',
          sectionId: 'sec_stack',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What problem is a monotonic decreasing stack best suited for?',
            explanation: 'A monotonic decreasing stack efficiently finds the next greater element for each position — when a larger element is found, it pops smaller elements, and for each popped element, the current element is the answer.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Next Greater Element', isCorrect: true },
                { id: 'b', text: 'Balanced parentheses', isCorrect: false },
                { id: 'c', text: 'BFS shortest path', isCorrect: false },
                { id: 'd', text: 'Finding median', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'LRU Cache design',
          type: 'question',
          sectionId: 'sec_stack',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Design an LRU Cache that supports get(key) and put(key, value) in O(1) time. Describe the data structures needed and explain why.',
            explanation: 'An LRU Cache uses a hash map for O(1) lookup and a doubly-linked list for O(1) removal and insertion of the most/least recently used items.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Use a HashMap<key, DoublyLinkedListNode> + a DoublyLinkedList.\n\nThe doubly-linked list maintains access order — most recently used at the head, least recently used at the tail.\n\nget(key): Look up the node in the hash map (O(1)). If found, move it to the head of the list (O(1) with doubly-linked list) and return its value.\n\nput(key, value): If the key exists, update the value and move to head. If new, create a node, add to head, and add to hash map. If capacity exceeded, remove the tail node from both the list and hash map.\n\nWhy doubly-linked list? It allows O(1) removal of any node (given a reference) without traversal, since we can update prev.next and next.prev directly.',
              minLength: 100,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Stack vs Queue order',
          type: 'question',
          sectionId: 'sec_stack',
          difficulty: 'easy',
          payload: {
            questionType: 'matching',
            content: 'Match each data structure to its access order:',
            explanation: 'Stack is LIFO (Last In, First Out). Queue is FIFO (First In, First Out). Priority Queue orders by priority. Deque supports both ends.',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Stack', right: 'Last In, First Out (LIFO)' },
                { id: 'p2', left: 'Queue', right: 'First In, First Out (FIFO)' },
                { id: 'p3', left: 'Priority Queue', right: 'Highest priority first' },
                { id: 'p4', left: 'Deque', right: 'Insert/remove from both ends' },
              ],
            },
          },
        },
        {
          title: 'Valid parentheses complexity',
          type: 'question',
          sectionId: 'sec_stack',
          difficulty: 'easy',
          payload: {
            questionType: 'numerical',
            content: 'The "Valid Parentheses" problem with a string of length n uses a stack. What is the worst-case space complexity in terms of n? Enter the exponent (e.g., for O(n^1), enter 1).',
            explanation: 'In the worst case (all opening brackets), the stack holds n/2 ≈ n elements, so space is O(n) = O(n^1). Exponent = 1.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: 1, tolerance: 0 },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP4: Binary Trees & BSTs — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Binary Trees & BSTs',
      description: 'Tree traversals, BST validation, LCA, serialization, and Morris traversal.',
      type: 'standard',
      sections: [
        { id: 'sec_basics', title: 'Tree Fundamentals', orderIndex: 0 },
        { id: 'sec_advanced', title: 'Advanced Tree Problems', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Tree Traversals & BST Properties',
          type: 'material',
          sectionId: 'sec_basics',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Tree Traversals & BST Properties',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Traversal Orders', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Inorder (Left, Root, Right): Gives sorted order for BSTs',
                  'Preorder (Root, Left, Right): Used for serialization, copying trees',
                  'Postorder (Left, Right, Root): Used for deletion, expression evaluation',
                  'Level-order (BFS): Uses a queue, processes level by level',
                ] } },
                { id: 'b3', type: 'heading', content: 'BST Property', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'For every node in a BST: all values in the left subtree < node value < all values in the right subtree. This enables O(log n) search, insert, and delete in balanced BSTs. An inorder traversal of a BST produces elements in sorted order.' },
                { id: 'b5', type: 'code', content: '// Validate BST using range checking\nfunction isValidBST(root: TreeNode | null, min = -Infinity, max = Infinity): boolean {\n  if (!root) return true;\n  if (root.val <= min || root.val >= max) return false;\n  return isValidBST(root.left, min, root.val) &&\n         isValidBST(root.right, root.val, max);\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 6,
            },
          },
        },
        {
          title: 'Inorder traversal of BST',
          type: 'question',
          sectionId: 'sec_basics',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What does an inorder traversal of a valid BST produce?',
            explanation: 'Inorder traversal visits left subtree, then root, then right subtree. For a BST, this produces elements in ascending sorted order.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Elements in sorted ascending order', isCorrect: true },
                { id: 'b', text: 'Elements in level order', isCorrect: false },
                { id: 'c', text: 'Elements in reverse sorted order', isCorrect: false },
                { id: 'd', text: 'Elements in insertion order', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Tree height calculation',
          type: 'question',
          sectionId: 'sec_basics',
          difficulty: 'easy',
          payload: {
            questionType: 'numerical',
            content: 'A complete binary tree has 15 nodes. What is its height? (Root is at height 0)',
            explanation: 'A complete binary tree with 15 nodes has 4 levels (0-3). Height = floor(log2(15)) = 3.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: 3, tolerance: 0 },
          },
        },
        {
          title: 'LCA in binary tree',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain the recursive approach to find the Lowest Common Ancestor (LCA) of two nodes in a binary tree. What is the time and space complexity?',
            explanation: 'Recursively search left and right subtrees. If both return non-null, current node is the LCA. If only one returns non-null, that result is the LCA.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'Recursive approach: Base case — if root is null or equals either target node, return root. Recursively search left and right subtrees. If both return non-null results, the current node is the LCA (targets are in different subtrees). If only one side returns non-null, return that result (both targets are in the same subtree). Time: O(n) — visit each node once. Space: O(h) — recursion stack depth equals tree height.',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'BST deletion cases',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'medium',
          payload: {
            questionType: 'jumbled',
            content: 'Arrange BST deletion cases from simplest to most complex:',
            explanation: 'Leaf node deletion is trivial (just remove). One child is simple (replace with child). Two children requires finding the inorder successor/predecessor.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              items: [
                { id: 'j1', text: 'Delete a leaf node (no children)' },
                { id: 'j2', text: 'Delete a node with one child' },
                { id: 'j3', text: 'Delete a node with two children' },
              ],
              correctOrder: ['j1', 'j2', 'j3'],
            },
          },
        },
        {
          title: 'Traversal identification',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each traversal to its primary use case:',
            explanation: 'Inorder gives sorted BST output. Preorder is used for tree serialization. Postorder for computing subtree sizes/deletion. Level-order for finding shortest paths in unweighted trees.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Inorder', right: 'Sorted BST output' },
                { id: 'p2', left: 'Preorder', right: 'Tree serialization' },
                { id: 'p3', left: 'Postorder', right: 'Subtree size computation' },
                { id: 'p4', left: 'Level-order', right: 'Shortest path in tree' },
              ],
            },
          },
        },
        {
          title: 'Morris traversal space',
          type: 'question',
          sectionId: 'sec_advanced',
          difficulty: 'hard',
          payload: {
            questionType: 'true-false',
            content: 'Morris inorder traversal achieves O(1) space by temporarily modifying the tree structure using threaded binary tree concepts.',
            explanation: 'True. Morris traversal creates temporary links from inorder predecessors back to the current node, allowing traversal without a stack or recursion. It restores the tree afterward.',
            basePoints: 10,
            difficulty: 'hard',
            questionData: { correctAnswer: true },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP5: Graphs — BFS, DFS & Topological Sort — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Graphs — BFS, DFS & Topological Sort',
      description: 'Connected components, shortest path, cycle detection, topological sort, and bipartite checking.',
      type: 'practice',
      sections: [
        { id: 'sec_fundamentals', title: 'Graph Fundamentals', orderIndex: 0 },
        { id: 'sec_algorithms', title: 'Graph Algorithms', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Graph Representations & Traversals',
          type: 'material',
          sectionId: 'sec_fundamentals',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Graph Representations & Traversals',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Representations', metadata: { level: 2 } },
                { id: 'b2', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Adjacency List: Space O(V+E), good for sparse graphs, fast neighbor iteration',
                  'Adjacency Matrix: Space O(V²), good for dense graphs, O(1) edge lookup',
                  'Edge List: Space O(E), good for algorithms like Kruskal\'s',
                ] } },
                { id: 'b3', type: 'heading', content: 'BFS vs DFS', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'BFS uses a queue and explores level by level — ideal for shortest path in unweighted graphs. DFS uses a stack (or recursion) and explores as deep as possible — ideal for cycle detection, topological sort, and connected components. Both run in O(V+E) time.' },
                { id: 'b5', type: 'code', content: '// Topological Sort using DFS (Kahn\'s Algorithm alternative)\nfunction topologicalSort(graph: Map<number, number[]>, n: number): number[] {\n  const inDegree = new Array(n).fill(0);\n  for (const [, neighbors] of graph) {\n    for (const neighbor of neighbors) inDegree[neighbor]++;\n  }\n  const queue: number[] = [];\n  for (let i = 0; i < n; i++) if (inDegree[i] === 0) queue.push(i);\n  const result: number[] = [];\n  while (queue.length > 0) {\n    const node = queue.shift()!;\n    result.push(node);\n    for (const neighbor of (graph.get(node) ?? [])) {\n      if (--inDegree[neighbor] === 0) queue.push(neighbor);\n    }\n  }\n  return result.length === n ? result : []; // empty = cycle exists\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'BFS shortest path guarantee',
          type: 'question',
          sectionId: 'sec_fundamentals',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'BFS guarantees the shortest path in an unweighted graph.',
            explanation: 'True. BFS explores nodes level by level, so the first time it reaches a node, it has found the shortest path (minimum number of edges) from the source.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'Graph representation comparison',
          type: 'question',
          sectionId: 'sec_fundamentals',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'For a sparse graph with 1000 vertices and 2000 edges, which representation is more space-efficient?',
            explanation: 'Adjacency list uses O(V+E) = O(3000) space. Adjacency matrix uses O(V²) = O(1,000,000) space. For sparse graphs, adjacency list is far more efficient.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Adjacency List', isCorrect: true },
                { id: 'b', text: 'Adjacency Matrix', isCorrect: false },
                { id: 'c', text: 'Both use the same space', isCorrect: false },
                { id: 'd', text: 'Edge List', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Topological sort prerequisite',
          type: 'question',
          sectionId: 'sec_algorithms',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Topological sort is only possible for which type of graph?',
            explanation: 'Topological sort requires a Directed Acyclic Graph (DAG). If the graph has a cycle, no valid topological ordering exists.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Directed Acyclic Graph (DAG)', isCorrect: true },
                { id: 'b', text: 'Any directed graph', isCorrect: false },
                { id: 'c', text: 'Undirected graph', isCorrect: false },
                { id: 'd', text: 'Weighted graph', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Cycle detection in directed graph',
          type: 'question',
          sectionId: 'sec_algorithms',
          difficulty: 'medium',
          payload: {
            questionType: 'paragraph',
            content: 'Explain how to detect a cycle in a directed graph using DFS with node coloring (white/gray/black). What does each color represent?',
            explanation: 'White = unvisited, Gray = in current DFS path (being processed), Black = fully processed. A cycle exists if DFS encounters a gray node.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              modelAnswer: 'Use three states: WHITE (unvisited), GRAY (in current recursion stack), BLACK (fully processed). Start DFS from each white node. Mark it GRAY when entering, BLACK when all neighbors are processed. If during DFS we encounter a GRAY node, we\'ve found a back edge, which means a cycle exists. Time: O(V+E), Space: O(V).',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Bipartite graph check',
          type: 'question',
          sectionId: 'sec_algorithms',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'A graph is bipartite if and only if it contains no _____ -length cycles.',
            explanation: 'A graph is bipartite iff it has no odd-length cycles. This can be checked by 2-coloring: BFS/DFS and try to assign alternating colors to neighbors.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'A graph is bipartite if and only if it contains no {{blank1}}-length cycles.',
              blanks: [
                { id: 'blank1', correctAnswer: 'odd', acceptableAnswers: ['odd', 'Odd'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'Number of islands approach',
          type: 'question',
          sectionId: 'sec_algorithms',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What is the optimal approach for the "Number of Islands" problem on an m×n grid?',
            explanation: 'DFS/BFS from each unvisited land cell, marking all connected land as visited. Each DFS/BFS call discovers one island. Time: O(m×n), Space: O(m×n).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'DFS/BFS flood fill from each land cell', isCorrect: true },
                { id: 'b', text: 'Sort all cells then group', isCorrect: false },
                { id: 'c', text: 'Dynamic programming', isCorrect: false },
                { id: 'd', text: 'Binary search on the grid', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP6: Advanced Graphs — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Advanced Graphs — Dijkstra, Union-Find, MST',
      description: 'Weighted shortest paths, Kruskal/Prim, Union-Find with rank and path compression.',
      type: 'practice',
      sections: [
        { id: 'sec_shortest', title: 'Shortest Paths', orderIndex: 0 },
        { id: 'sec_mst', title: 'MST & Union-Find', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Advanced Graph Algorithms',
          type: 'material',
          sectionId: 'sec_shortest',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Advanced Graph Algorithms',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Dijkstra\'s Algorithm', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Dijkstra\'s finds shortest paths from a single source in a weighted graph with non-negative edge weights. Uses a min-heap (priority queue) to always process the closest unvisited node. Time: O((V+E) log V) with a binary heap.' },
                { id: 'b3', type: 'heading', content: 'Union-Find (Disjoint Set)', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Union-Find efficiently tracks connected components. With path compression and union by rank, both find and union operations run in nearly O(1) amortized time — specifically O(α(n)) where α is the inverse Ackermann function.' },
                { id: 'b5', type: 'code', content: '// Union-Find with path compression and union by rank\nclass UnionFind {\n  parent: number[];\n  rank: number[];\n  constructor(n: number) {\n    this.parent = Array.from({length: n}, (_, i) => i);\n    this.rank = new Array(n).fill(0);\n  }\n  find(x: number): number {\n    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);\n    return this.parent[x];\n  }\n  union(x: number, y: number): boolean {\n    const px = this.find(x), py = this.find(y);\n    if (px === py) return false;\n    if (this.rank[px] < this.rank[py]) this.parent[px] = py;\n    else if (this.rank[px] > this.rank[py]) this.parent[py] = px;\n    else { this.parent[py] = px; this.rank[px]++; }\n    return true;\n  }\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'Dijkstra limitation',
          type: 'question',
          sectionId: 'sec_shortest',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'Dijkstra\'s algorithm does NOT work correctly with:',
            explanation: 'Dijkstra\'s algorithm assumes that once a node is finalized, no shorter path exists. Negative edge weights violate this assumption.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Negative edge weights', isCorrect: true },
                { id: 'b', text: 'Directed graphs', isCorrect: false },
                { id: 'c', text: 'Dense graphs', isCorrect: false },
                { id: 'd', text: 'Disconnected graphs', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Bellman-Ford vs Dijkstra',
          type: 'question',
          sectionId: 'sec_shortest',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL advantages of Bellman-Ford over Dijkstra\'s:',
            explanation: 'Bellman-Ford handles negative weights and detects negative cycles, but is slower at O(VE) vs Dijkstra\'s O((V+E) log V).',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Handles negative edge weights', isCorrect: true },
                { id: 'b', text: 'Detects negative weight cycles', isCorrect: true },
                { id: 'c', text: 'Faster time complexity', isCorrect: false },
                { id: 'd', text: 'Uses less memory', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Kruskal\'s algorithm dependency',
          type: 'question',
          sectionId: 'sec_mst',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'Kruskal\'s MST algorithm sorts edges by weight and uses _____ to detect cycles when adding edges.',
            explanation: 'Kruskal\'s uses Union-Find (Disjoint Set Union) to efficiently check if adding an edge creates a cycle — if both endpoints are in the same component, skip it.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'Kruskal\'s MST algorithm sorts edges by weight and uses {{blank1}} to detect cycles when adding edges.',
              blanks: [
                { id: 'blank1', correctAnswer: 'Union-Find', acceptableAnswers: ['Union-Find', 'union find', 'union-find', 'disjoint set', 'DSU', 'Disjoint Set Union'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'MST edge count',
          type: 'question',
          sectionId: 'sec_mst',
          difficulty: 'easy',
          payload: {
            questionType: 'numerical',
            content: 'A Minimum Spanning Tree of a connected graph with 10 vertices has exactly how many edges?',
            explanation: 'An MST of a connected graph with V vertices always has exactly V-1 edges. For 10 vertices: 10-1 = 9 edges.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: 9, tolerance: 0 },
          },
        },
        {
          title: 'Path compression effect',
          type: 'question',
          sectionId: 'sec_mst',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Explain path compression in Union-Find and why it dramatically improves performance. What is the amortized time complexity with both path compression and union by rank?',
            explanation: 'Path compression flattens the tree during find operations, making future operations nearly O(1).',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Path compression: During find(x), make every node on the path from x to the root point directly to the root. This flattens the tree structure, so subsequent find operations on any node in that path are O(1). Combined with union by rank (always attach the shorter tree under the root of the taller tree), the amortized time per operation is O(α(n)), where α is the inverse Ackermann function — effectively constant for all practical input sizes (α(n) ≤ 4 for n ≤ 10^80).',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Prim vs Kruskal',
          type: 'question',
          sectionId: 'sec_mst',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'Prim\'s algorithm is generally better than Kruskal\'s for dense graphs.',
            explanation: 'True. Prim\'s with a Fibonacci heap runs in O(E + V log V), which is better for dense graphs (E ≈ V²). Kruskal\'s O(E log E) is better for sparse graphs.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: true },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP7: Dynamic Programming I — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Dynamic Programming I — 1D & 2D',
      description: 'Fibonacci variants, knapsack, LIS, edit distance, coin change.',
      type: 'practice',
      sections: [
        { id: 'sec_1d', title: '1D DP', orderIndex: 0 },
        { id: 'sec_2d', title: '2D DP', orderIndex: 1 },
      ],
      items: [
        {
          title: 'DP Foundations',
          type: 'material',
          sectionId: 'sec_1d',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Dynamic Programming Foundations',
              blocks: [
                { id: 'b1', type: 'heading', content: 'What is DP?', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Dynamic Programming is an optimization technique that solves problems by breaking them into overlapping subproblems and storing their solutions. Two key properties: optimal substructure (optimal solution contains optimal solutions to subproblems) and overlapping subproblems (same subproblems are solved multiple times).' },
                { id: 'b3', type: 'heading', content: 'Top-Down vs Bottom-Up', metadata: { level: 2 } },
                { id: 'b4', type: 'list', content: '', metadata: { listType: 'unordered', items: [
                  'Top-Down (Memoization): Recursive + cache. Natural but uses stack space.',
                  'Bottom-Up (Tabulation): Iterative, fills table from base cases. Often more efficient.',
                ] } },
                { id: 'b5', type: 'code', content: '// 0/1 Knapsack — bottom-up\nfunction knapsack(weights: number[], values: number[], W: number): number {\n  const n = weights.length;\n  const dp = Array.from({length: n + 1}, () => new Array(W + 1).fill(0));\n  for (let i = 1; i <= n; i++) {\n    for (let w = 0; w <= W; w++) {\n      dp[i][w] = dp[i-1][w]; // don\'t take item i\n      if (weights[i-1] <= w) {\n        dp[i][w] = Math.max(dp[i][w], dp[i-1][w - weights[i-1]] + values[i-1]);\n      }\n    }\n  }\n  return dp[n][W];\n}', metadata: { language: 'typescript' } },
              ],
              readingTime: 7,
            },
          },
        },
        {
          title: 'DP prerequisites',
          type: 'question',
          sectionId: 'sec_1d',
          difficulty: 'easy',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL properties required for a problem to be solvable by Dynamic Programming:',
            explanation: 'DP requires both optimal substructure and overlapping subproblems. Greedy only needs optimal substructure (no overlapping subproblems needed).',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Optimal substructure', isCorrect: true },
                { id: 'b', text: 'Overlapping subproblems', isCorrect: true },
                { id: 'c', text: 'Linear time complexity', isCorrect: false },
                { id: 'd', text: 'Sorted input', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Coin change minimum coins',
          type: 'question',
          sectionId: 'sec_1d',
          difficulty: 'medium',
          payload: {
            questionType: 'numerical',
            content: 'Given coins [1, 5, 10, 25] and target amount 36, what is the minimum number of coins needed?',
            explanation: '25 + 10 + 1 = 36, using 3 coins. This is optimal (greedy works for US coin denominations).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: 3, tolerance: 0 },
          },
        },
        {
          title: 'LIS length',
          type: 'question',
          sectionId: 'sec_1d',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What is the time complexity of the optimal Longest Increasing Subsequence (LIS) algorithm?',
            explanation: 'The optimal LIS algorithm uses patience sorting with binary search: maintain a list of smallest tail elements, use binary search to find the position for each new element. O(n log n).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'O(n log n)', isCorrect: true },
                { id: 'b', text: 'O(n²)', isCorrect: false },
                { id: 'c', text: 'O(n)', isCorrect: false },
                { id: 'd', text: 'O(2^n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Edit distance recurrence',
          type: 'question',
          sectionId: 'sec_2d',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Write the recurrence relation for Edit Distance (Levenshtein distance) between strings s1 and s2. Explain each case.',
            explanation: 'dp[i][j] = dp[i-1][j-1] if characters match, else 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) for delete, insert, replace.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'dp[i][j] = minimum edit distance between s1[0..i-1] and s2[0..j-1].\n\nBase cases: dp[0][j] = j (insert j characters), dp[i][0] = i (delete i characters).\n\nRecurrence: If s1[i-1] == s2[j-1]: dp[i][j] = dp[i-1][j-1] (no operation needed).\nElse: dp[i][j] = 1 + min(\n  dp[i-1][j],     // delete from s1\n  dp[i][j-1],     // insert into s1\n  dp[i-1][j-1]    // replace in s1\n)\n\nTime: O(m×n), Space: O(m×n) or O(min(m,n)) with rolling array.',
              minLength: 80,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Knapsack variant identification',
          type: 'question',
          sectionId: 'sec_2d',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each knapsack variant to its key characteristic:',
            explanation: '0/1 Knapsack: each item once. Unbounded: unlimited copies. Fractional: take fractions (greedy works). Bounded: limited copies per item.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: '0/1 Knapsack', right: 'Each item used at most once' },
                { id: 'p2', left: 'Unbounded Knapsack', right: 'Unlimited copies of each item' },
                { id: 'p3', left: 'Fractional Knapsack', right: 'Solvable by greedy algorithm' },
                { id: 'p4', left: 'Bounded Knapsack', right: 'Fixed number of copies per item' },
              ],
            },
          },
        },
        {
          title: 'Memoization vs Tabulation',
          type: 'question',
          sectionId: 'sec_1d',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'Memoization (top-down DP) always computes all subproblems, even if some are unnecessary.',
            explanation: 'False. Memoization only computes subproblems that are actually needed (lazy evaluation). Tabulation (bottom-up) computes all subproblems systematically.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: false },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP8: Dynamic Programming II — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Dynamic Programming II — Advanced Patterns',
      description: 'Bitmask DP, interval DP, digit DP, DP on trees, and optimization techniques.',
      type: 'practice',
      sections: [
        { id: 'sec_patterns', title: 'Advanced Patterns', orderIndex: 0 },
        { id: 'sec_optimization', title: 'Optimization', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Advanced DP Patterns',
          type: 'material',
          sectionId: 'sec_patterns',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Advanced DP Patterns',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Bitmask DP', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Bitmask DP represents subsets of a set using bits in an integer. For n items, there are 2^n possible subsets. State: dp[mask] where mask is a bitmask representing which items are selected. Classic problem: Traveling Salesman Problem — dp[mask][i] = min cost to visit cities in mask, ending at city i.' },
                { id: 'b3', type: 'heading', content: 'Interval DP', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Interval DP solves problems on contiguous subarrays/substrings. State: dp[i][j] = answer for interval [i, j]. Iterate by interval length, try all split points. Classic: Matrix Chain Multiplication, Burst Balloons, Palindrome Partitioning.' },
                { id: 'b5', type: 'heading', content: 'DP on Trees', metadata: { level: 2 } },
                { id: 'b6', type: 'paragraph', content: 'Tree DP uses the tree structure: dp[node] depends on dp[children]. Process leaves first (post-order). Classic problems: maximum independent set on a tree, tree diameter, re-rooting technique for computing answers for all roots efficiently.' },
              ],
              readingTime: 8,
            },
          },
        },
        {
          title: 'Bitmask DP state space',
          type: 'question',
          sectionId: 'sec_patterns',
          difficulty: 'medium',
          payload: {
            questionType: 'numerical',
            content: 'In the Traveling Salesman Problem with 15 cities using bitmask DP, how many states are there? (dp[mask][city], answer in thousands)',
            explanation: '2^15 × 15 = 32768 × 15 = 491,520 ≈ 492 thousand.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: { correctAnswer: 492, tolerance: 1 },
          },
        },
        {
          title: 'Matrix Chain Multiplication approach',
          type: 'question',
          sectionId: 'sec_patterns',
          difficulty: 'hard',
          payload: {
            questionType: 'mcq',
            content: 'Matrix Chain Multiplication uses which DP pattern?',
            explanation: 'Matrix Chain Multiplication is a classic interval DP problem: dp[i][j] = minimum cost to multiply matrices from i to j, trying all split points k between i and j.',
            basePoints: 15,
            difficulty: 'hard',
            questionData: {
              options: [
                { id: 'a', text: 'Interval DP', isCorrect: true },
                { id: 'b', text: 'Bitmask DP', isCorrect: false },
                { id: 'c', text: 'Digit DP', isCorrect: false },
                { id: 'd', text: 'Knapsack DP', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Tree DP traversal',
          type: 'question',
          sectionId: 'sec_patterns',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'In tree DP, we typically process nodes in _____ order so that children are computed before parents.',
            explanation: 'Post-order traversal processes children before the parent, which is exactly what tree DP needs — compute dp[child] before dp[parent].',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'In tree DP, we typically process nodes in {{blank1}} order so that children are computed before parents.',
              blanks: [
                { id: 'blank1', correctAnswer: 'post-order', acceptableAnswers: ['post-order', 'postorder', 'post order', 'bottom-up'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'State reduction technique',
          type: 'question',
          sectionId: 'sec_optimization',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Explain the rolling array optimization for 2D DP problems like Edit Distance. How does it reduce space from O(m×n) to O(min(m,n))?',
            explanation: 'Since dp[i][j] only depends on dp[i-1][j], dp[i][j-1], and dp[i-1][j-1], we only need the previous row.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'In 2D DP like Edit Distance, dp[i][j] only depends on three values: dp[i-1][j] (above), dp[i][j-1] (left), dp[i-1][j-1] (diagonal). Since each row only needs the previous row, we can use two 1D arrays of size min(m,n)+1: prev[] and curr[]. After computing curr[], swap prev = curr. We also need to save the diagonal value before overwriting. This reduces space from O(m×n) to O(min(m,n)).',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Digit DP use case',
          type: 'question',
          sectionId: 'sec_optimization',
          difficulty: 'hard',
          payload: {
            questionType: 'mcq',
            content: 'Which type of problem is Digit DP typically used for?',
            explanation: 'Digit DP processes numbers digit by digit with a "tight" constraint flag. It counts numbers in a range [L, R] satisfying some property by building numbers digit by digit.',
            basePoints: 15,
            difficulty: 'hard',
            questionData: {
              options: [
                { id: 'a', text: 'Counting numbers in a range with a digit property', isCorrect: true },
                { id: 'b', text: 'Finding shortest paths in graphs', isCorrect: false },
                { id: 'c', text: 'String matching with wildcards', isCorrect: false },
                { id: 'd', text: 'Sorting large arrays', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'DP pattern identification',
          type: 'question',
          sectionId: 'sec_optimization',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each problem to its DP pattern:',
            explanation: 'TSP uses bitmask DP to track visited cities. Burst Balloons uses interval DP on subarray ranges. Maximum independent set on tree uses tree DP. Counting numbers with no repeated digits uses digit DP.',
            basePoints: 20,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'Traveling Salesman Problem', right: 'Bitmask DP' },
                { id: 'p2', left: 'Burst Balloons', right: 'Interval DP' },
                { id: 'p3', left: 'Max Independent Set on Tree', right: 'Tree DP' },
                { id: 'p4', left: 'Count numbers with no repeated digits', right: 'Digit DP' },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP9: Tries, Segment Trees & Advanced DS — standard
    // ═══════════════════════════════════════════════════════
    {
      title: 'Tries, Segment Trees & Advanced DS',
      description: 'Trie with wildcards, segment tree with lazy propagation, Fenwick tree.',
      type: 'standard',
      sections: [
        { id: 'sec_trie', title: 'Tries', orderIndex: 0 },
        { id: 'sec_segtree', title: 'Segment & Fenwick Trees', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Trie Data Structure',
          type: 'material',
          sectionId: 'sec_trie',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Trie Data Structure',
              blocks: [
                { id: 'b1', type: 'heading', content: 'What is a Trie?', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'A Trie (prefix tree) stores strings character by character. Each node represents a character, and paths from root to nodes with end markers represent complete strings. Operations (insert, search, prefix search) run in O(m) where m is the string length — independent of the number of strings stored.' },
                { id: 'b3', type: 'heading', content: 'Segment Tree', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'A segment tree is a binary tree where each node stores aggregate information (sum, min, max) for a range of the original array. Supports range queries and point/range updates in O(log n). Lazy propagation defers range updates to children, maintaining O(log n) per operation.' },
              ],
              readingTime: 6,
            },
          },
        },
        {
          title: 'Trie search complexity',
          type: 'question',
          sectionId: 'sec_trie',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the time complexity of searching for a word of length m in a Trie containing n words?',
            explanation: 'Trie search follows the characters of the query word one by one. It takes O(m) time regardless of how many words are in the Trie.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'O(m)', isCorrect: true },
                { id: 'b', text: 'O(n)', isCorrect: false },
                { id: 'c', text: 'O(m × n)', isCorrect: false },
                { id: 'd', text: 'O(m log n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Trie vs Hash Map for prefix',
          type: 'question',
          sectionId: 'sec_trie',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'A hash map is equally efficient as a Trie for prefix-based searches (e.g., autocomplete).',
            explanation: 'False. A Trie naturally supports prefix search by traversing to the prefix node and collecting all descendants. A hash map would require iterating all keys and checking each prefix — O(n×m) vs O(prefix_length + results).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: false },
          },
        },
        {
          title: 'Segment tree range query',
          type: 'question',
          sectionId: 'sec_segtree',
          difficulty: 'medium',
          payload: {
            questionType: 'numerical',
            content: 'A segment tree built on an array of n=8 elements has how many nodes in total? (Complete binary tree)',
            explanation: 'A segment tree for n elements has at most 4n nodes (or 2*next_power_of_2(n) - 1). For n=8: 2*8 - 1 = 15 nodes.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: 15, tolerance: 0 },
          },
        },
        {
          title: 'Lazy propagation purpose',
          type: 'question',
          sectionId: 'sec_segtree',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Explain lazy propagation in segment trees. Why is it necessary and how does it maintain O(log n) per range update?',
            explanation: 'Without lazy propagation, range updates would be O(n). Lazy propagation defers updates to children, only applying them when needed.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Without lazy propagation, updating a range [l, r] in a segment tree requires updating all individual elements — O(n) in the worst case. Lazy propagation solves this by storing pending updates at intermediate nodes instead of immediately propagating them to children. When a range update covers an entire segment, mark the node as "lazy" and don\'t recurse further. When a query later needs to access children of a lazy node, "push down" the pending update to the children before proceeding. This ensures each range update and query touches at most O(log n) nodes.',
              minLength: 60,
              maxLength: 1500,
            },
          },
        },
        {
          title: 'Fenwick vs Segment Tree',
          type: 'question',
          sectionId: 'sec_segtree',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL advantages of Fenwick Tree (BIT) over Segment Tree:',
            explanation: 'Fenwick trees use less memory (n vs 4n) and have smaller constant factors. However, they only support operations with an inverse (like sum) and cannot handle range updates without modification.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Less memory usage', isCorrect: true },
                { id: 'b', text: 'Simpler implementation', isCorrect: true },
                { id: 'c', text: 'Supports range minimum queries', isCorrect: false },
                { id: 'd', text: 'Supports lazy propagation natively', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Autocomplete system design',
          type: 'question',
          sectionId: 'sec_trie',
          difficulty: 'hard',
          payload: {
            questionType: 'code',
            content: 'Implement an autocomplete system using a Trie that returns all words starting with a given prefix.',
            explanation: 'Insert words into a Trie, then for autocomplete, traverse to the prefix node and DFS to collect all complete words.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              language: 'typescript',
              starterCode: '// Implement Trie with autocomplete',
              modelAnswer: 'class TrieNode {\n  children = new Map<string, TrieNode>();\n  isEnd = false;\n}\n\nclass AutocompleteSystem {\n  root = new TrieNode();\n\n  insert(word: string): void {\n    let node = this.root;\n    for (const ch of word) {\n      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());\n      node = node.children.get(ch)!;\n    }\n    node.isEnd = true;\n  }\n\n  autocomplete(prefix: string): string[] {\n    let node = this.root;\n    for (const ch of prefix) {\n      if (!node.children.has(ch)) return [];\n      node = node.children.get(ch)!;\n    }\n    const results: string[] = [];\n    this.dfs(node, prefix, results);\n    return results;\n  }\n\n  private dfs(node: TrieNode, path: string, results: string[]): void {\n    if (node.isEnd) results.push(path);\n    for (const [ch, child] of node.children) {\n      this.dfs(child, path + ch, results);\n    }\n  }\n}',
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP10: Greedy & Backtracking Patterns — practice
    // ═══════════════════════════════════════════════════════
    {
      title: 'Greedy & Backtracking Patterns',
      description: 'Activity selection, interval scheduling, N-Queens, Sudoku solver, constraint propagation.',
      type: 'practice',
      sections: [
        { id: 'sec_greedy', title: 'Greedy Algorithms', orderIndex: 0 },
        { id: 'sec_backtrack', title: 'Backtracking', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Greedy & Backtracking Overview',
          type: 'material',
          sectionId: 'sec_greedy',
          payload: {
            materialType: 'rich',
            richContent: {
              title: 'Greedy & Backtracking',
              blocks: [
                { id: 'b1', type: 'heading', content: 'Greedy Algorithms', metadata: { level: 2 } },
                { id: 'b2', type: 'paragraph', content: 'Greedy algorithms make the locally optimal choice at each step. They work when the problem has the greedy-choice property (local optimum leads to global optimum) and optimal substructure. Key problems: Activity Selection, Huffman Coding, Interval Scheduling, Jump Game.' },
                { id: 'b3', type: 'heading', content: 'Backtracking', metadata: { level: 2 } },
                { id: 'b4', type: 'paragraph', content: 'Backtracking explores all possible solutions by building candidates incrementally and abandoning (backtracking) a candidate as soon as it\'s determined that it cannot lead to a valid solution. It\'s essentially a depth-first search of the solution space with pruning. Key problems: N-Queens, Sudoku Solver, Permutations, Subsets, Word Search.' },
              ],
              readingTime: 5,
            },
          },
        },
        {
          title: 'Greedy vs DP',
          type: 'question',
          sectionId: 'sec_greedy',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What distinguishes greedy from dynamic programming?',
            explanation: 'Greedy makes one choice at each step and never reconsiders. DP considers all choices and picks the best from subproblem solutions.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Greedy never reconsiders choices; DP considers all subproblems', isCorrect: true },
                { id: 'b', text: 'Greedy is always faster than DP', isCorrect: false },
                { id: 'c', text: 'DP cannot solve problems that greedy can', isCorrect: false },
                { id: 'd', text: 'Greedy always gives optimal solutions', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Activity selection strategy',
          type: 'question',
          sectionId: 'sec_greedy',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'In the Activity Selection problem, the greedy strategy is to always pick the activity with the earliest _____ time.',
            explanation: 'Sorting by finish time and always picking the next activity that starts after the current one finishes maximizes the number of activities.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'In the Activity Selection problem, the greedy strategy is to always pick the activity with the earliest {{blank1}} time.',
              blanks: [
                { id: 'blank1', correctAnswer: 'finish', acceptableAnswers: ['finish', 'end', 'ending', 'completion'], caseSensitive: false },
              ],
            },
          },
        },
        {
          title: 'N-Queens approach',
          type: 'question',
          sectionId: 'sec_backtrack',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'What technique does the N-Queens problem primarily use?',
            explanation: 'N-Queens uses backtracking: place queens row by row, check if each placement is valid (no attacks), and backtrack if stuck.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Backtracking with constraint checking', isCorrect: true },
                { id: 'b', text: 'Dynamic programming', isCorrect: false },
                { id: 'c', text: 'Greedy algorithm', isCorrect: false },
                { id: 'd', text: 'Divide and conquer', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Backtracking pruning',
          type: 'question',
          sectionId: 'sec_backtrack',
          difficulty: 'medium',
          payload: {
            questionType: 'true-false',
            content: 'Backtracking without pruning is equivalent to brute-force exhaustive search.',
            explanation: 'True. Without pruning (early abandonment of invalid candidates), backtracking would explore every possible combination, which is the same as brute force.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'Sudoku solver complexity',
          type: 'question',
          sectionId: 'sec_backtrack',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Describe how backtracking with constraint propagation solves Sudoku. How does constraint propagation improve performance over naive backtracking?',
            explanation: 'Constraint propagation reduces the search space by eliminating impossible values before backtracking.',
            basePoints: 25,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Naive backtracking: Find an empty cell, try digits 1-9, check if valid, recurse. If stuck, backtrack. This explores many dead ends.\n\nWith constraint propagation: Maintain a set of possible values for each empty cell. When placing a digit, propagate constraints — remove that digit from the possible values of all cells in the same row, column, and 3×3 box. If any cell has zero possible values, backtrack immediately. If a cell has exactly one possible value, fill it in and propagate further (naked singles). This dramatically reduces the branching factor and prunes the search tree early, often solving easy puzzles without any backtracking at all.',
              minLength: 80,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Huffman coding property',
          type: 'question',
          sectionId: 'sec_greedy',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'Huffman coding is an optimal greedy algorithm for:',
            explanation: 'Huffman coding creates an optimal prefix-free binary code by repeatedly merging the two lowest-frequency symbols.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Lossless data compression using variable-length codes', isCorrect: true },
                { id: 'b', text: 'Sorting strings alphabetically', isCorrect: false },
                { id: 'c', text: 'Finding shortest paths in graphs', isCorrect: false },
                { id: 'd', text: 'Encrypting data', isCorrect: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP11: DSA Comprehensive Quiz — quiz
    // ═══════════════════════════════════════════════════════
    {
      title: 'DSA Comprehensive Quiz',
      description: 'Assessment covering all DSA topics from arrays to advanced algorithms.',
      type: 'quiz',
      assessmentConfig: {
        maxAttempts: 3,
        shuffleQuestions: true,
        showResultsImmediately: true,
        passingPercentage: 70,
      },
      sections: [
        { id: 'sec_ds', title: 'Data Structures', orderIndex: 0 },
        { id: 'sec_algo', title: 'Algorithms', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Array vs LinkedList insertion',
          type: 'question',
          sectionId: 'sec_ds',
          difficulty: 'easy',
          payload: {
            questionType: 'mcq',
            content: 'What is the time complexity of inserting at the beginning of a dynamic array vs a linked list?',
            explanation: 'Array: O(n) — must shift all elements. Linked List: O(1) — just update head pointer.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: {
              options: [
                { id: 'a', text: 'Array: O(n), LinkedList: O(1)', isCorrect: true },
                { id: 'b', text: 'Array: O(1), LinkedList: O(n)', isCorrect: false },
                { id: 'c', text: 'Both O(1)', isCorrect: false },
                { id: 'd', text: 'Both O(n)', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Heap property',
          type: 'question',
          sectionId: 'sec_ds',
          difficulty: 'easy',
          payload: {
            questionType: 'true-false',
            content: 'In a min-heap, the parent node is always smaller than or equal to its children.',
            explanation: 'True. This is the min-heap property: parent ≤ children, ensuring the root is the minimum element.',
            basePoints: 10,
            difficulty: 'easy',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'Sorting algorithm stability',
          type: 'question',
          sectionId: 'sec_algo',
          difficulty: 'medium',
          payload: {
            questionType: 'mcaq',
            content: 'Select ALL stable sorting algorithms:',
            explanation: 'Merge sort and insertion sort are stable (equal elements maintain relative order). Quicksort and heap sort are unstable.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Merge Sort', isCorrect: true },
                { id: 'b', text: 'Insertion Sort', isCorrect: true },
                { id: 'c', text: 'Quick Sort', isCorrect: false },
                { id: 'd', text: 'Heap Sort', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Time complexity ordering',
          type: 'question',
          sectionId: 'sec_algo',
          difficulty: 'easy',
          payload: {
            questionType: 'jumbled',
            content: 'Arrange these time complexities from fastest to slowest:',
            explanation: 'O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2^n).',
            basePoints: 15,
            difficulty: 'easy',
            questionData: {
              items: [
                { id: 'j1', text: 'O(1)' },
                { id: 'j2', text: 'O(log n)' },
                { id: 'j3', text: 'O(n log n)' },
                { id: 'j4', text: 'O(2^n)' },
              ],
              correctOrder: ['j1', 'j2', 'j3', 'j4'],
            },
          },
        },
        {
          title: 'Best sorting for nearly sorted',
          type: 'question',
          sectionId: 'sec_algo',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'Which sorting algorithm performs best on a nearly sorted array?',
            explanation: 'Insertion sort runs in O(n) on a nearly sorted array because few elements need to be moved. It has the adaptive property.',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Insertion Sort', isCorrect: true },
                { id: 'b', text: 'Quick Sort', isCorrect: false },
                { id: 'c', text: 'Merge Sort', isCorrect: false },
                { id: 'd', text: 'Selection Sort', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'Graph traversal comparison',
          type: 'question',
          sectionId: 'sec_algo',
          difficulty: 'medium',
          payload: {
            questionType: 'matching',
            content: 'Match each algorithm to its primary data structure:',
            explanation: 'BFS uses a queue, DFS uses a stack (or recursion), Dijkstra uses a priority queue (min-heap), Kruskal uses Union-Find.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              pairs: [
                { id: 'p1', left: 'BFS', right: 'Queue' },
                { id: 'p2', left: 'DFS', right: 'Stack' },
                { id: 'p3', left: 'Dijkstra', right: 'Priority Queue' },
                { id: 'p4', left: 'Kruskal', right: 'Union-Find' },
              ],
            },
          },
        },
        {
          title: 'Amortized analysis concept',
          type: 'question',
          sectionId: 'sec_ds',
          difficulty: 'medium',
          payload: {
            questionType: 'fill-blanks',
            content: 'Dynamic arrays achieve O(1) _____ time for append operations, even though individual resizing operations take O(n).',
            explanation: 'Amortized O(1): while resizing is expensive (O(n)), it happens infrequently enough that the average cost per operation is O(1).',
            basePoints: 10,
            difficulty: 'medium',
            questionData: {
              textWithBlanks: 'Dynamic arrays achieve O(1) {{blank1}} time for append operations, even though individual resizing operations take O(n).',
              blanks: [
                { id: 'blank1', correctAnswer: 'amortized', acceptableAnswers: ['amortized', 'average', 'amortised'], caseSensitive: false },
              ],
            },
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════
    // SP12: DSA Staff-Level Assessment — timed_test
    // ═══════════════════════════════════════════════════════
    {
      title: 'DSA Staff-Level Assessment',
      description: 'Timed assessment testing deep DSA understanding at staff engineer level.',
      type: 'timed_test',
      assessmentConfig: {
        durationMinutes: 45,
        maxAttempts: 1,
        shuffleQuestions: true,
        showResultsImmediately: false,
        passingPercentage: 60,
      },
      sections: [
        { id: 'sec_conceptual', title: 'Conceptual Questions', orderIndex: 0 },
        { id: 'sec_design', title: 'Design & Implementation', orderIndex: 1 },
      ],
      items: [
        {
          title: 'Optimal data structure selection',
          type: 'question',
          sectionId: 'sec_conceptual',
          difficulty: 'medium',
          payload: {
            questionType: 'mcq',
            content: 'You need a data structure that supports: insert O(log n), delete O(log n), find-min O(1), and decrease-key O(log n). Which is best?',
            explanation: 'A Fibonacci heap supports decrease-key in O(1) amortized, but a binary min-heap satisfies all listed requirements with O(log n) operations and O(1) find-min.',
            basePoints: 15,
            difficulty: 'medium',
            questionData: {
              options: [
                { id: 'a', text: 'Binary Min-Heap', isCorrect: true },
                { id: 'b', text: 'Hash Map', isCorrect: false },
                { id: 'c', text: 'Sorted Array', isCorrect: false },
                { id: 'd', text: 'Stack', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'System design data structure choice',
          type: 'question',
          sectionId: 'sec_conceptual',
          difficulty: 'hard',
          payload: {
            questionType: 'mcaq',
            content: 'For a real-time leaderboard that needs: top-K queries, score updates, and rank lookups, select ALL appropriate data structures:',
            explanation: 'Balanced BST (like AVL/Red-Black) and skip lists both support O(log n) insert/delete/rank operations. Sorted arrays need O(n) for insert. Hash maps don\'t support ordered operations.',
            basePoints: 20,
            difficulty: 'hard',
            questionData: {
              options: [
                { id: 'a', text: 'Balanced BST (AVL/Red-Black)', isCorrect: true },
                { id: 'b', text: 'Skip List', isCorrect: true },
                { id: 'c', text: 'Sorted Array', isCorrect: false },
                { id: 'd', text: 'Hash Map', isCorrect: false },
              ],
            },
          },
        },
        {
          title: 'NP-completeness understanding',
          type: 'question',
          sectionId: 'sec_conceptual',
          difficulty: 'hard',
          payload: {
            questionType: 'true-false',
            content: 'If P = NP, then every NP-complete problem could be solved in polynomial time.',
            explanation: 'True. If P = NP, then every problem in NP (including NP-complete ones) would be in P, meaning polynomial-time algorithms would exist for all of them.',
            basePoints: 10,
            difficulty: 'hard',
            questionData: { correctAnswer: true },
          },
        },
        {
          title: 'Design a rate limiter',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Design a sliding window rate limiter that allows at most K requests per minute per user. Describe the data structures, algorithms, and time/space complexity.',
            explanation: 'Use a sorted set or queue per user to track timestamps. For each request, remove expired timestamps and check if count < K.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Data structure: HashMap<userId, Deque<timestamp>> (or sorted set).\n\nAlgorithm for each request:\n1. Get current timestamp t\n2. Get user\'s deque (or create empty)\n3. Remove all timestamps older than t - 60 seconds from the front\n4. If deque.size() < K: allow request, add t to deque\n5. Else: reject request (rate limit exceeded)\n\nTime: O(1) amortized per request (each timestamp is added once and removed once).\nSpace: O(K × U) where U is the number of active users.\n\nOptimization: Use a circular buffer of fixed size K instead of a deque. Or use the sliding window counter approach (current window count * overlap percentage + previous window count) for approximate but memory-efficient rate limiting.',
              minLength: 100,
              maxLength: 2000,
            },
          },
        },
        {
          title: 'Implement merge k sorted lists',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'hard',
          payload: {
            questionType: 'code',
            content: 'Implement an algorithm to merge k sorted arrays into one sorted array. Aim for O(N log k) time complexity where N is the total number of elements.',
            explanation: 'Use a min-heap of size k, initially containing the first element of each array. Extract-min and add the next element from that array.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              language: 'typescript',
              starterCode: 'function mergeKSorted(arrays: number[][]): number[] {\n  // Implement O(N log k) merge\n}',
              modelAnswer: 'function mergeKSorted(arrays: number[][]): number[] {\n  // Min-heap approach: use indices to track position in each array\n  const result: number[] = [];\n  // [value, arrayIndex, elementIndex]\n  const heap: [number, number, number][] = [];\n\n  // Initialize with first element of each array\n  for (let i = 0; i < arrays.length; i++) {\n    if (arrays[i].length > 0) {\n      heapPush(heap, [arrays[i][0], i, 0]);\n    }\n  }\n\n  while (heap.length > 0) {\n    const [val, ai, ei] = heapPop(heap);\n    result.push(val);\n    if (ei + 1 < arrays[ai].length) {\n      heapPush(heap, [arrays[ai][ei + 1], ai, ei + 1]);\n    }\n  }\n  return result;\n}\n\n// Simple heap operations\nfunction heapPush(h: [number,number,number][], val: [number,number,number]) {\n  h.push(val);\n  let i = h.length - 1;\n  while (i > 0) {\n    const p = (i - 1) >> 1;\n    if (h[p][0] <= h[i][0]) break;\n    [h[p], h[i]] = [h[i], h[p]];\n    i = p;\n  }\n}\n\nfunction heapPop(h: [number,number,number][]): [number,number,number] {\n  const top = h[0];\n  const last = h.pop()!;\n  if (h.length > 0) {\n    h[0] = last;\n    let i = 0;\n    while (true) {\n      let smallest = i;\n      const l = 2*i+1, r = 2*i+2;\n      if (l < h.length && h[l][0] < h[smallest][0]) smallest = l;\n      if (r < h.length && h[r][0] < h[smallest][0]) smallest = r;\n      if (smallest === i) break;\n      [h[i], h[smallest]] = [h[smallest], h[i]];\n      i = smallest;\n    }\n  }\n  return top;\n}',
            },
          },
        },
        {
          title: 'Complexity analysis',
          type: 'question',
          sectionId: 'sec_conceptual',
          difficulty: 'hard',
          payload: {
            questionType: 'numerical',
            content: 'What is the time complexity of building a heap from an unsorted array of n elements using the bottom-up (heapify) approach? Express as the coefficient of n in O(c×n). What is c?',
            explanation: 'Building a heap bottom-up is O(n), not O(n log n). The sum of work across all levels converges to O(n). So c = 1.',
            basePoints: 15,
            difficulty: 'hard',
            questionData: { correctAnswer: 1, tolerance: 0 },
          },
        },
        {
          title: 'Trade-off analysis',
          type: 'question',
          sectionId: 'sec_design',
          difficulty: 'hard',
          payload: {
            questionType: 'paragraph',
            content: 'Compare the trade-offs of using a balanced BST vs a hash table for implementing a dictionary. When would you choose each? Consider: ordered operations, worst-case guarantees, cache performance, and memory overhead.',
            explanation: 'BST: ordered operations, worst-case O(log n). Hash table: O(1) average but O(n) worst case, better cache performance, no ordered ops.',
            basePoints: 30,
            difficulty: 'hard',
            questionData: {
              modelAnswer: 'Hash Table advantages: O(1) average for insert/delete/lookup, better cache locality (contiguous memory), simpler implementation. Disadvantages: O(n) worst case with bad hash function, no ordered operations (no range queries, no find-next/prev), rehashing overhead, wasted space.\n\nBalanced BST advantages: O(log n) guaranteed worst case, supports ordered operations (in-order traversal, range queries, floor/ceiling, rank), no rehashing. Disadvantages: O(log n) is slower than O(1) average, pointer-based structure has poor cache performance, higher memory overhead per node.\n\nChoose Hash Table: when you only need insert/delete/lookup and don\'t need ordering. Choose BST: when you need ordered operations, worst-case guarantees, or the data set changes unpredictably.',
              minLength: 100,
              maxLength: 2500,
            },
          },
        },
      ],
    },
  ],
};
