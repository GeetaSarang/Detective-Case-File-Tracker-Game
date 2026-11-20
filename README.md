# Detective Mystery Game Using Binary Trees
### Case: "Diwali Night at Sharma Haveli"


Advanced DSA project. A detective game where every piece of evidence branches into **exactly two leads**
(left and right child of a binary tree). You may accuse a suspect only after **100% of the leads** are explored.

There are **two versions** of the game. Please do not mix them up:

| | C++ application (`cpp_application/`) | Website (`website/`) |
|---|---|---|
| Language | C++ | HTML + CSS + JavaScript |
| Role | The **real binary tree implementation** (nodes, traversals, full/complete/perfect checks, BST of suspects, experiment) | A **browser re-implementation** of the same game and tree, for play and visualization |
| Runs in | Terminal | Browser |

**The website does NOT run C++.** It has its own JavaScript copy of the tree logic (`website/js/tree.js`).
Both versions use the same case (`dataset/case_haveli.txt` for C++, a generated copy in `website/js/caseData.js`).

## The story
It is Diwali night in Jaipur. At 9:15 PM the power goes off for ten minutes. At 10:30 PM the family finds Adithya Sharma, the owner of Sharma Jewellers, still at his study desk with a glass of milk next to him. His safe is open and his red account book is gone. Five people were in the haveli: Geeta (wife), Advaith (son), Abhinav (shop manager), Rashi (cook) and Neeti (niece). Follow all 15 pieces of evidence, then accuse.

## Folder structure and purpose of each file

```
Detective_Mystery_Game/
├── README.md                    this file
├── PROJECT_DOCUMENTATION.md     full report (design, DSA concepts, experiment, test cases)
├── cpp_application/
│   ├── main.cpp                 menu and command-line options
│   ├── EvidenceTree.h           binary tree node, traversals, counts, height, search, isFull/isComplete/isPerfect
│   ├── SuspectBST.h             Binary SEARCH Tree of suspects keyed by unique id
│   ├── GameLogic.h              game state, lead exploration, 100% rule, accusation checking
│   ├── GameConsole.h            all text screens and the play loop
│   ├── CaseLoader.h             reads dataset/case_haveli.txt and builds the tree
│   ├── Experiment.h             lead-completeness experiment (computer detective + scaling test)
│   ├── TreeDemo.h               Full / Complete / Perfect demonstrations
│   ├── tests.cpp                50 automated checks
│   └── sample_runs/             saved example outputs
├── website/
│   ├── index.html               Home, Play, Tree Visualizer, Tree Lab, Learn DSA, Statistics (one page app)
│   ├── css/style.css            five colour themes (variables) and all animations
│   ├── js/tree.js               tree + traversals + property checks (JavaScript)
│   ├── js/game.js               game rules (100% rule)
│   ├── js/visualizer.js         SVG drawing of trees, ring meter and charts
│   ├── js/fx.js                 colour themes, floating background, scroll reveal, ripple, count-up
│   ├── js/lab.js                Tree Lab: editable tree, BST playground, search race
│   ├── js/experiment.js         in-browser experiment
│   ├── js/app.js                page navigation, play page, traversal player, statistics
│   ├── js/caseData.js           generated case data (do not edit by hand)
│   ├── js/cppResults.js         generated copy of the C++ experiment CSVs
│   ├── tests/logic_test.js      21 automated checks for the JS logic
│   └── assets/                  logo and favicon
├── dataset/
│   ├── case_haveli.txt          the mystery (read by C++)
│   ├── case_haveli.json         readable copy
│   └── make_website_data.py     regenerates the JSON and website data from the .txt
├── experiments/
│   ├── experiment_results.csv   measured by the C++ program
│   ├── scaling_results.csv      measured by the C++ program on large trees
│   ├── human_sessions.csv       created when YOU play (your own attempts)
│   └── export_results_to_website.py   copies the CSVs into the website
└── screenshots/                 27 screenshots of the working website
```

## How to run: C++ (VS Code)

1. Install a C++ compiler. Windows: install **MSYS2** and run `pacman -S mingw-w64-ucrt-x86_64-gcc`, then add `C:\msys64\ucrt64\bin` to PATH. Mac: `xcode-select --install`. Linux: `sudo apt install g++`.
2. Install VS Code, then open the folder **Detective_Mystery_Game** (File > Open Folder).
3. Open the terminal in VS Code (Ctrl + `). Check: `g++ --version`.
4. Compile and run:
   ```
   cd cpp_application
   g++ -std=c++17 -Wall -Wextra main.cpp -o detective
   ./detective            (Windows PowerShell: .\detective.exe)
   ```
5. Run the automated tests:
   ```
   g++ -std=c++17 -Wall -Wextra tests.cpp -o run_tests
   ./run_tests
   ```
Command-line shortcuts: `./detective --experiment`, `--scaling`, `--analysis`, `--demo`.
Run it from `Detective_Mystery_Game` or `cpp_application`; it finds the dataset by itself.
The C++ game is text based. All the pictures and animations are in the website.

## Website themes and animations
Use the round colour buttons at the top right to switch theme: **Lavender Latte** (default), **Mint Matcha**, **Peach Sunset**, **Night Diya** (dark) and **Cream Notebook**. Your choice is remembered by the browser.
Animations: floating shapes and moving colour blobs, a glowing gradient title, words of the story fading in, cards sliding in as you scroll, button shine and ripple, flowing dashed leads in the tree, an animated progress ring and bar, stamps, shaking refused accusations, count-up numbers and confetti. If your computer is set to "reduce motion", they are switched off automatically.

## How to run: website

Double-click `website/index.html`, or in VS Code install the **Live Server** extension, right-click `index.html` > Open with Live Server.
No installation or internet is needed.

## How to play

- You start at the crime scene (evidence #1). Each evidence shows two leads: **L** and **R**.
- C++ commands: `L` / `R` follow a lead, `B` go back, `N` notebook, `T` tree view, `A` accuse, `H` help, `Q` quit.
- Explore all 15 evidence nodes. Accusing earlier is **refused**.
- At 100%, choose a suspect. A wrong guess gives feedback (evidence that clears that person); the right suspect wins the case.
- The final screen shows the statistics (total/explored/unexplored nodes, completeness, steps, time, incorrect accusations).
- Website, Play page: click a lead card or a yellow node in the tree. Watch the **circle meter**, the **suspect board** (red dots = clues against a suspect, green tag = cleared) and the **step chart**. Use **Experiment mode** to be forced to accuse at 25/50/75/100%.
- Website, Tree Visualizer: pick a traversal and press Play or Next step. It shows the **call stack** (or the **queue** for level-order), the visit order and the code line that is running.
- Website, Tree Lab: build your own tree and see why it is or is not Full / Complete / Perfect; insert and search ids in the suspect BST; race a general-tree search against a BST search.

## Sample session (shortened, real output)

```
Command [L/R/B/N/T/A/H/Q] > A
  *** ACCUSATION REFUSED ***
  ... unexplored (case completeness 6%). Finish every lead before accusing
...
  Case progress [####################] 15/15 leads (100.0%)   Steps: 25
  *** INCORRECT ACCUSATION: Geeta Sharma is innocent! ***
...
  CASE CLOSED - YOU SOLVED: Diwali Night at Sharma Haveli
  The culprit: Abhinav Malhotra (Shop manager)
```
Full runs: `cpp_application/sample_runs/`.

## Solution hint
Do not read `dataset/case_haveli.txt` if you want to play fairly: it contains the answer.
