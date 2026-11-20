// ============================================================
// GameConsole.h
// ------------------------------------------------------------
// The text interface of the game: printing screens, reading the player's
// commands and recording every accusation attempt in a CSV file.
// All the actual RULES live in GameLogic.h.
// ============================================================
#ifndef GAME_CONSOLE_H
#define GAME_CONSOLE_H

#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include "GameLogic.h"
using namespace std;

enum PlayResult { PLAY_SOLVED, PLAY_QUIT };

// ---------- small text helpers ----------

// Removes spaces and upper-cases the text, so "  l " becomes "L".
inline string toUpperTrim(const string& text) {
    string result;
    for (size_t i = 0; i < text.size(); i++) {
        char ch = text[i];
        if (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n') continue;
        if (ch >= 'a' && ch <= 'z') ch = (char)(ch - 'a' + 'A');
        result += ch;
    }
    return result;
}

// Prints a long sentence wrapped to a maximum line width.
inline void printWrapped(const string& text, size_t width = 72, const string& indent = "  ") {
    istringstream words(text);
    string word, line = indent;
    while (words >> word) {
        if (line.size() > indent.size() && line.size() + 1 + word.size() > width) {
            cout << line << "\n";
            line = indent;
        }
        if (line.size() > indent.size()) line += " ";
        line += word;
    }
    if (line.size() > indent.size()) cout << line << "\n";
}

inline void printLine() { cout << "------------------------------------------------------------------------\n"; }

inline string formatTime(double seconds) {
    ostringstream out;
    out << fixed << setprecision(1) << seconds << " s";
    return out.str();
}

// ---------- screens ----------

// Lists suspects in id order. inorderSuspects() walks the BST, so they come out sorted.
inline void printSuspects(CaseFile& c) {
    vector<Suspect*> sorted;
    inorderSuspects(c.suspectRoot, sorted);
    for (Suspect* s : sorted) {
        cout << "  [" << s->id << "] " << s->name << " - " << s->role << "\n";
        printWrapped(s->description, 72, "      ");
    }
}

// Shows one evidence card.
inline void printEvidence(EvidenceNode* node, bool fresh) {
    printLine();
    cout << " EVIDENCE #" << node->id << "  [" << node->type << "]  " << node->title
         << (fresh ? "   ** NEW **" : "   (already explored)") << "\n";
    printLine();
    printWrapped(node->description);
}

// Shows the two leads (left child and right child) of the current evidence.
inline void printLeads(const GameState& s) {
    EvidenceNode* here = s.current;
    cout << "\n  Leads from here:\n";
    if (here->left == nullptr && here->right == nullptr) {
        cout << "    This trail ends here: this is a final finding with no further leads.\n";
        cout << "    Use [B] to go back and try another lead.\n";
        return;
    }
    if (here->left != nullptr)
        cout << "    [L] #" << here->left->id << " " << here->left->title << " (" << here->left->type << ") - "
             << (here->left->explored ? "explored" : "UNEXPLORED") << "\n";
    if (here->right != nullptr)
        cout << "    [R] #" << here->right->id << " " << here->right->title << " (" << here->right->type << ") - "
             << (here->right->explored ? "explored" : "UNEXPLORED") << "\n";
}

// One-line status: progress bar, completeness and steps.
inline void printStatus(const GameState& s) {
    int total = s.caseFile->totalNodes;
    int filled = (20 * s.exploredCount) / total;
    cout << "\n  Case progress [";
    for (int i = 0; i < 20; i++) cout << (i < filled ? '#' : '-');
    cout << "] " << s.exploredCount << "/" << total << " leads (" << fixed << setprecision(1)
         << completenessPercent(s) << "%)   Steps: " << s.steps << "\n";
}

// Recursive helper that draws the tree sideways using text characters.
// Explored nodes show a title; visible but unexplored leads show "(unexplored)";
// deeper hidden nodes are not drawn at all.
inline void printTreeRec(EvidenceNode* node, EvidenceNode* current, const string& prefix,
                         bool isLast, bool isRoot) {
    if (node == nullptr) return;
    string label = node->explored
        ? "[x] #" + to_string(node->id) + " " + node->title
        : "[ ] #" + to_string(node->id) + " " + node->title + " (unexplored)";
    if (node == current) label += "    <-- you are here";
    cout << "  " << prefix << (isRoot ? "" : (isLast ? "`-- " : "|-- ")) << label << "\n";
    if (!node->explored) return;                       // do not reveal what lies beyond
    string childPrefix = prefix + (isRoot ? "" : (isLast ? "    " : "|   "));
    printTreeRec(node->left, current, childPrefix, node->right == nullptr, false);
    printTreeRec(node->right, current, childPrefix, true, false);
}

inline void printTreeView(const GameState& s) {
    cout << "\n  INVESTIGATION TREE   ([x] explored, [ ] open lead)\n";
    printTreeRec(s.caseFile->root, s.current, "", true, true);
}

// The notebook: every piece of evidence collected so far (preorder = case-file order).
inline void printNotebook(const GameState& s) {
    cout << "\n  DETECTIVE'S NOTEBOOK\n";
    vector<EvidenceNode*> all;
    preorder(s.caseFile->root, all);
    for (EvidenceNode* node : all) {
        if (!node->explored) continue;
        cout << "  #" << node->id << " [" << node->type << "] " << node->title << "\n";
        printWrapped(node->description, 72, "      ");
    }
    printStatus(s);
    cout << "  Unexplored leads remaining: " << s.caseFile->totalNodes - s.exploredCount << "\n";
}

inline void printHelp() {
    cout << "\n  COMMANDS\n";
    cout << "    L  follow the LEFT lead          R  follow the RIGHT lead\n";
    cout << "    B  go back to previous evidence  N  open your notebook (all evidence so far)\n";
    cout << "    T  show the investigation tree   A  accuse a suspect (only after 100% explored)\n";
    cout << "    H  show this help                Q  quit this investigation\n";
}

// ---------- recording attempts for the experiment ----------

// Appends one line to experiments/human_sessions.csv (creating it with a header if needed).
inline void logAttempt(const string& prefix, const string& mode, const GameState& s,
                       const string& outcome, bool accepted) {
    string path = prefix + "experiments/human_sessions.csv";
    bool isNew = !fileExists(path);
    ofstream out(path.c_str(), ios::app);
    if (!out.good()) {
        cout << "  (note: could not write the log file " << path << ")\n";
        return;
    }
    if (isNew)
        out << "timestamp,mode,lead_completeness_percent,explored_nodes,total_nodes,steps,"
               "elapsed_seconds,outcome,accusation_accepted\n";
    time_t now = time(nullptr);
    char stamp[32];
    strftime(stamp, sizeof stamp, "%Y-%m-%d %H:%M:%S", localtime(&now));
    out << stamp << "," << mode << "," << fixed << setprecision(1) << completenessPercent(s) << ","
        << s.exploredCount << "," << s.caseFile->totalNodes << "," << s.steps << ","
        << setprecision(2) << elapsedSeconds(s) << "," << outcome << "," << (accepted ? "YES" : "NO") << "\n";
}

// ---------- accusation ----------

// Handles the whole "A" command. Returns true if the case was solved.
inline bool accusationFlow(GameState& s, const string& mode, const string& prefix) {
    CaseFile& c = *s.caseFile;

    // RULE: all leads must be explored first.
    if (!allLeadsExplored(s)) {
        attemptAccusation(s, 0);                       // counts the blocked attempt
        int missing = c.totalNodes - s.exploredCount;
        cout << "\n  *** ACCUSATION REFUSED ***\n";
        printWrapped("The Chief Inspector will not sign a warrant. " + to_string(missing) +
                     " of " + to_string(c.totalNodes) + " leads are still unexplored (case completeness " +
                     to_string((int)completenessPercent(s)) + "%). Finish every lead before accusing anyone.");
        cout << "  Open leads you can still follow:\n";
        vector<pair<EvidenceNode*, EvidenceNode*> > open = listOpenLeads(s);
        for (size_t i = 0; i < open.size(); i++)
            cout << "    - #" << open[i].second->id << " " << open[i].second->title
                 << "  (reached from #" << open[i].first->id << " " << open[i].first->title << ")\n";
        logAttempt(prefix, mode, s, "BLOCKED", false);
        return false;
    }

    cout << "\n  All leads explored. Whom do you accuse?\n";
    printSuspects(c);
    cout << "  Enter the suspect number (or 0 to cancel): ";
    string line;
    if (!getline(cin, line)) return false;
    int id = atoi(line.c_str());
    if (id == 0) { cout << "  Accusation cancelled.\n"; return false; }

    Suspect* accused = searchSuspect(c.suspectRoot, id);       // BST search by unique id
    if (accused == nullptr) { cout << "  There is no suspect with number " << id << ".\n"; return false; }

    AccusationResult result = attemptAccusation(s, id);
    if (result == ACC_SOLVED) {
        logAttempt(prefix, mode, s, "SOLVED", true);
        return true;
    }

    // Wrong suspect: explain exactly which evidence contradicts the accusation.
    logAttempt(prefix, mode, s, "WRONG", true);
    cout << "\n  *** INCORRECT ACCUSATION: " << accused->name << " is innocent! ***\n";
    EvidenceNode* proof = findClearingEvidence(s, id);
    if (proof != nullptr) {
        cout << "  Evidence #" << proof->id << " (" << proof->title << ") clears " << accused->name << ":\n";
        printWrapped(proof->description, 72, "      ");
    } else {
        printWrapped("Nothing in your notebook proves " + accused->name + " guilty. Re-read your evidence.");
    }
    cout << "  Study the notebook (N) and try again. Incorrect accusations so far: "
         << s.incorrectAccusations << "\n";
    return false;
}

// ---------- final report ----------

inline void printFinalReport(const GameState& s) {
    CaseFile& c = *s.caseFile;
    Suspect* culprit = searchSuspect(c.suspectRoot, c.culpritId);

    cout << "\n";
    printLine();
    cout << "   CASE CLOSED - YOU SOLVED: " << c.title << "\n";
    printLine();
    cout << "  The culprit: " << culprit->name << " (" << culprit->role << ")\n\n";
    printWrapped(c.solution);

    cout << "\n  How each suspect was dealt with:\n";
    vector<Suspect*> sorted;
    inorderSuspects(c.suspectRoot, sorted);
    for (Suspect* sus : sorted) {
        if (sus->id == c.culpritId) { cout << "    [" << sus->id << "] " << sus->name << ": GUILTY\n"; continue; }
        EvidenceNode* proof = findClearingEvidence(s, sus->id);
        cout << "    [" << sus->id << "] " << sus->name << ": cleared by evidence #"
             << (proof ? to_string(proof->id) + " (" + proof->title + ")" : string("-")) << "\n";
    }

    int total = c.totalNodes;
    cout << "\n  INVESTIGATION STATISTICS\n";
    cout << "    Total evidence nodes ........ " << total << "\n";
    cout << "    Explored leads .............. " << s.exploredCount << "\n";
    cout << "    Unexplored leads ............ " << total - s.exploredCount << "\n";
    cout << "    Lead completeness ........... " << fixed << setprecision(1) << completenessPercent(s) << "%\n";
    cout << "    Steps taken ................. " << s.steps << "\n";
    cout << "    Time to solve ............... " << formatTime(elapsedSeconds(s)) << "\n";
    cout << "    Incorrect accusations ....... " << s.incorrectAccusations << "\n";
    cout << "    Refused accusations ......... " << s.blockedAttempts << "  (made before 100% explored)\n";
    cout << "    Tree height / leaf nodes .... " << treeHeight(c.root) << " / " << countLeaves(c.root) << "\n";
    int minimum = 2 * (total - 1) - treeHeight(c.root);
    cout << "    Fewest possible steps ....... " << minimum
         << "  (a depth-first walk that visits every node and stops on the last one)\n";
    printLine();
}

// ---------- the game loop ----------

// Plays one investigation. targetPercent = 0 means free play. With 25, 50, 75 or 100
// the game forces an accusation attempt as soon as that percentage is explored
// (used for the lead-completeness experiment).
inline PlayResult playGame(CaseFile& c, int targetPercent, const string& prefix) {
    GameState s;
    startInvestigation(s, c);
    string mode = targetPercent == 0 ? "free_play" : "target_" + to_string(targetPercent);

    cout << "\n";
    printLine();
    cout << "   " << c.title << "\n";
    printLine();
    printWrapped(c.intro);
    cout << "\n  THE SUSPECTS\n";
    printSuspects(c);
    cout << "\n  Every piece of evidence branches into TWO leads (L and R). Explore every lead,\n"
         << "  then accuse. Accusations before 100% of the leads are explored are refused.\n";
    if (targetPercent > 0)
        cout << "\n  EXPERIMENT MODE: when " << targetPercent << "% of the leads ("
             << targetNodeCount(targetPercent, c.totalNodes) << " of " << c.totalNodes
             << " nodes) are explored, you will be asked to accuse. The attempt and your time are recorded.\n";
    printHelp();
    cout << "\n  The clock starts now.\n";
    printEvidence(s.current, true);

    bool targetReached = false, announcedReady = false;
    string line;

    while (true) {
        printStatus(s);
        printLeads(s);
        cout << "\n  Command [L/R/B/N/T/A/H/Q] > ";
        if (!getline(cin, line)) return PLAY_QUIT;
        string cmd = toUpperTrim(line);
        bool moved = false;

        if (cmd == "L" || cmd == "R") {
            EvidenceNode* next = (cmd == "L") ? s.current->left : s.current->right;
            if (next == nullptr) {
                cout << "  There is no such lead here. Use B to go back.\n";
            } else {
                bool fresh = !next->explored;
                followLead(s, cmd == "L");
                printEvidence(s.current, fresh);
                moved = true;
            }
        } else if (cmd == "B") {
            if (goBack(s)) {
                cout << "\n  You return to evidence #" << s.current->id << ": " << s.current->title << "\n";
                moved = true;
            } else {
                cout << "  You are already at the crime scene.\n";
            }
        } else if (cmd == "N") {
            printNotebook(s);
        } else if (cmd == "T") {
            printTreeView(s);
        } else if (cmd == "H") {
            printHelp();
        } else if (cmd == "A") {
            if (accusationFlow(s, mode, prefix)) {
                printFinalReport(s);
                return PLAY_SOLVED;
            }
        } else if (cmd == "Q") {
            cout << "  Investigation abandoned.\n";
            return PLAY_QUIT;
        } else if (!cmd.empty()) {
            cout << "  Unknown command. Type H for help.\n";
        }

        if (moved) {
            // Experiment mode: force an accusation attempt when the target is reached.
            if (targetPercent > 0 && !targetReached && s.exploredCount >= targetNodeCount(targetPercent, c.totalNodes)) {
                targetReached = true;
                cout << "\n  >>> EXPERIMENT TARGET REACHED (" << targetPercent << "%). Time to accuse! <<<\n";
                if (accusationFlow(s, mode, prefix)) {
                    printFinalReport(s);
                    return PLAY_SOLVED;
                }
            }
            if (allLeadsExplored(s) && !announcedReady) {
                announcedReady = true;
                cout << "\n  >>> Every lead has been explored. Study your notebook (N), then accuse (A). <<<\n";
            }
        }
    }
}

#endif
