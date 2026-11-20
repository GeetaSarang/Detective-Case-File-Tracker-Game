# Project Documentation: Detective Mystery Game Using Binary Trees

## 1. Objective
A mystery game in which every evidence node branches into exactly two investigation leads, and the case can be
solved only after every lead has been explored. The project also studies how the **percentage of leads explored**
affects the **time and steps** needed.

## 2. Implementation overview (C++ versus JavaScript)
- **C++ (`cpp_application/`)** is the real data-structure implementation: pointer-based nodes, recursive traversals,
  property checks, a BST of suspects, the game rules and the automated experiment.
- **JavaScript (`website/`)** is a separate browser version with the same rules, plus drawings and animations. It does
  **not** execute or call the C++ code. The Statistics page shows C++ results only by copying the CSV files into
  `cppResults.js` with a script; the numbers are not edited.

## 3. The case: "Diwali Night at Sharma Haveli"
It is Diwali night in Jaipur. The power goes off at 9:15 PM. At 10:30 PM Adithya Sharma, owner of Sharma Jewellers, is found at his study desk next to a glass of milk. His safe is open and his red account book is missing.
Five suspects (ids 1-5): Geeta Sharma (wife), Rashi Yadav (family cook), Advaith Sharma (son), Abhinav Malhotra (shop manager), Neeti Nair (niece).
The investigation tree has **15 evidence nodes in 4 levels** (height 3). Evidence types: Scene, Physical, Forensic, Testimony, Document, Digital, Surveillance.
- Four leaves clear the four innocent suspects (kitchen camera, Neeti's video call, Advaith's phone location, temple camera).
- Three leaves point at the culprit (medical shop bill, napkin in the dustbin, corridor camera).
- Two early clues are red herrings: "What the Family Says" points at Geeta, Advaith and Neeti, and "Rashi's Statement" points at Rashi. Because of this, a partly explored case can point to the wrong person.
The tree is stored in `dataset/case_haveli.txt`.

Winning condition: explore all 15 nodes, then accuse **Abhinav Malhotra** (id 4).
The solution: Abhinav had been stealing from the shop. Adithya found out and said he would call the police. On Diwali night Abhinav brought sweets, used the power cut to crush sleeping tablets into the milk and took the red book.

## 4. Binary tree concepts used
### Node (`EvidenceNode`)
Holds id, type, title, text, pointers `left` and `right`, plus an `explored` flag.

### Functions in `EvidenceTree.h`
| Requirement | Function |
|---|---|
| Node creation, left/right links | built by `CaseLoader.h` from the dataset |
| Preorder (Root, L, R) | `preorder` |
| Inorder (L, Root, R) | `inorder` |
| Postorder (L, R, Root) | `postorder` |
| Level-order (uses a queue) | `levelOrder` |
| Node count | `countNodes` |
| Leaf count | `countLeaves` |
| Height | `treeHeight` |
| Search by id | `findById` |
| Property checks | `isFull`, `isComplete`, `isPerfect` (three separate functions) |

Real output for the Sharma Haveli tree (`./detective --analysis`):
```
Total nodes 15, leaves 8, internal 7, height 3
Preorder : 1 2 4 8 9 5 10 11 3 6 12 13 7 14 15
Inorder  : 8 4 9 2 10 5 11 1 12 6 13 3 14 7 15
Postorder: 8 9 4 10 11 5 2 12 13 6 14 15 7 3 1
Level    : 1 2 3 ... 15
isFull = YES, isComplete = YES, isPerfect = YES
```

### Full, Complete, Perfect and the investigation
- **Full**: every node has 0 or 2 children. This is exactly the game rule "every evidence branches into exactly two
  leads", so the investigation tree must be full. A node with one lead would break it.
- **Complete**: all levels are filled except possibly the last, which is filled left to right. It means the case has
  no gaps on the way down and leads are balanced.
- **Perfect**: all internal nodes have two children and all leaves are on the same level. Then
  n = 2^(h+1) - 1 and leaves = 2^h. For h = 3: n = 15, leaves = 8. Every line of inquiry is equally deep, so
  no suspect is cleared "earlier" than another.
Every perfect tree is full and complete; the reverse is not true. `--demo` builds four small trees (perfect, complete
only, full only, skewed) to show the checkers answering differently.

### Binary SEARCH Tree (used only where it fits)
The investigation tree is a **general binary tree**, not a BST: evidence is not ordered by value. A BST is used only
for the **suspects** (`SuspectBST.h`), ordered by unique suspect id, to search a suspect in O(h). Its inorder
traversal prints the suspects sorted by id (1, 2, 3, 4, 5).

## 5. Game rules (enforced in `GameLogic.h`, mirrored in `website/js/game.js`)
1. Exploring a lead marks that node explored; walking back is allowed and counts as a step.
2. `attemptAccusation` **refuses every accusation while explored nodes < total nodes**, even if the suspect named is
   the true culprit. The attempt is logged as BLOCKED.
3. At 100%, a wrong suspect gives an INCORRECT message with evidence that clears that suspect; a right suspect solves the case.
4. The final report shows total, explored and unexplored nodes, completeness %, steps, time, incorrect accusations.

## 6. Lead completeness and solve-time experiment
### Design
Conditions: **25%, 50%, 75%, 100%** of the 15 nodes. Targets are rounded to whole nodes: 4, 8, 12 and 15 nodes, so the
actual completeness is 26.7%, 53.3%, 80.0% and 100%. At the target the detective attempts to accuse through the
**same** rule function the game uses. Two search orders: depth-first (`dfs`) and random order (`random`),
2000 runs per condition. Time is measured with `std::chrono` around the exploration plus accusation attempt.
In the website, `performance.now()` is used. Human attempts are recorded by the game into `human_sessions.csv`.

### Measured results (C++, `experiments/experiment_results.csv`, copied unchanged)
| Order | Target | Avg nodes | Completeness | Avg steps | Avg time (µs) | Accusation accepted | Case solved | Deduction already correct |
|---|---|---|---|---|---|---|---|---|
| dfs | 25% | 4 | 26.7% | 3 | 4.804 | 0% | 0% | 0% |
| dfs | 50% | 8 | 53.3% | 11 | 3.730 | 0% | 0% | 100% |
| dfs | 75% | 12 | 80.0% | 19 | 5.286 | 0% | 0% | 100% |
| dfs | 100% | 15 | 100% | 25 | 5.521 | 100% | 100% | 100% |
| random | 25% | 4 | 26.7% | 3 | 5.376 | 0% | 0% | 25.2% |
| random | 50% | 8 | 53.3% | 11 | 6.402 | 0% | 0% | 49.6% |
| random | 75% | 12 | 80.0% | 19 | 5.247 | 0% | 0% | 100% |
| random | 100% | 15 | 100% | 25 | 6.627 | 100% | 100% | 100% |

Times depend on the computer that ran them. Every time you run `./detective --experiment` you get slightly different microsecond values; the step counts never change. Run it yourself and use your own numbers in your report.

### Scaling experiment (`scaling_results.csv`, perfect trees)
| Height | Nodes | Time at 25% / 50% / 75% / 100% (ms) |
|---|---|---|
| 10 | 2,047 | 0.0264 / 0.0512 / 0.0747 / 0.1041 |
| 14 | 32,767 | 0.4173 / 0.8521 / 1.2244 / 1.6380 |
| 17 | 262,143 | 3.4967 / 9.0388 / 13.5487 / 15.9292 |

### What the data shows
1. **Steps grow with completeness, exactly.** DFS needs 3, 11, 19, 25 steps for 4, 8, 12, 15 nodes. For the full walk
   steps = 2(n-1) - h = 2(14) - 3 = 25 (the walk stops on the last node, so the final climb is skipped). This matches
   the larger trees too (e.g. n = 2047, h = 10: 4082).
2. **On the 15-node tree, measured time does not rise cleanly.** It is only a few microseconds, so timer resolution,
   cache and CPU noise are as large as the effect (for example, the random-order times at 50% and 100% are higher than at 75%). Do not claim a trend from
   these rows. On large trees, where the work is big enough to measure, time rises with completeness, roughly in a
   straight line (3.50 → 15.93 ms for 262,143 nodes).
3. **Validity depends only on 100%.** In all conditions below 100% the accusation was never accepted, whichever order was used.
   The "deduction correct" column in the CSV shows that a depth-first detective can already name the right suspect at 50%, but a random-order detective is right only 25.2% (at 25%) and 49.6% (at 50%) of the time, because the red herrings can mislead. The game refuses in every case, because the rule is about **completeness**, not about a lucky guess.
4. **Human play time** is dominated by reading and thinking (seconds to minutes), far larger than computer time
   (microseconds). Use the Guided Experiment (C++ menu 2) or the Experiment mode on the website for your own measurements.

### Actual time versus theoretical complexity
- **Theoretical complexity** describes how work grows with input size: visiting k nodes is O(k), the whole tree O(n),
  and with n = 2^(h+1) - 1 the height is O(log n) for a perfect tree. Traversals use O(h) stack space.
  It says nothing about seconds.
- **Actual elapsed time** is measured on one machine with one compiler, and includes constants, cache and timer noise.
  It matches the O(k) prediction only when k is large (scaling experiment), not for 15 nodes.

## 7. Testing
- `cpp_application/tests.cpp`: **50 checks passed, 0 failed** (tree building, traversals, counts, height, search,
  full/complete/perfect on test trees, BST, 100% rule including the true culprit refused at 14 of 15 nodes, percent targets, bot rules).
- `website/tests/logic_test.js`: **21 checks passed, 0 failed** (`node website/tests/logic_test.js`).
- C++ compiled with `-Wall -Wextra` without warnings; the website loaded with no console errors.

Sample test cases:
| Input | Expected | Result |
|---|---|---|
| Accuse at 1 of 15 nodes | Refused | pass |
| Accuse the correct suspect at 14 of 15 | Refused | pass |
| Accuse suspect 1 at 15 of 15 | Incorrect, with clearing evidence | pass |
| Accuse suspect 3 at 15 of 15 | Case solved | pass |
| `findById(42)` | not found | pass |
| Perfect tree of 15 nodes | full, complete, perfect all YES | pass |
| Skewed tree | full NO, complete NO, perfect NO | pass |

## 8. Website features (JavaScript)
- **Themes and motion**: five switchable colour themes (Lavender Latte, Mint Matcha, Peach Sunset, Night Diya, Cream Notebook) built with CSS variables and saved with `localStorage`; animated background, scroll reveals, word-by-word story text, flowing lead lines, progress ring, ripples, count-up numbers and confetti. Motion is disabled for users who ask their system to reduce motion.
- **Home**: story, animated tree, the six characters (victim and five suspects), how to play.
- **Play**: evidence card, two lead buttons, notebook, live tree, circle meter, suspect board, step chart (your walk vs the best possible walk), accusation with feedback, confetti and a final report.
- **Tree Visualizer**: tree of your investigation with explored/open/locked states and your path; a traversal player (Play, Next step, Reset, speed) that shows the call stack or queue and the current code line.
- **Tree Lab**: an editable tree with live Full/Complete/Perfect checks that explain the reason; a BST playground (insert, search, inorder); a search race (general tree vs BST).
- **Learn DSA**: definitions, diagrams, comparison table, complexity table.
- **Statistics**: all required numbers, accusation log with CSV download, in-browser experiment with two charts, and the C++ measurements.

## 9. Screenshots
`screenshots/` has 27 images captured from the real website by an automated browser: home (two views), play (intro, start, mid-game, refused accusation, all explored, wrong accusation, result with confetti, experiment mode 50%), visualizer (complete tree, preorder with call stack, level-order with queue, finished postorder), Tree Lab (checks pass, why a deleted node fails, BST search, search race), learn page, statistics, a mobile view and four more colour themes.
The accusation rows visible in the statistics screenshot come from the automated test run, not from a real participant.

## 10. Limitations
- One case with a perfect tree of 15 nodes. More cases can be added by editing the dataset (it must keep two children per node, or the full-tree check will correctly fail).
- The C++ game is text-based; graphics are in the website only.
- The experiment uses a computer detective for timing; human timing needs you to play and collect your own sessions.
