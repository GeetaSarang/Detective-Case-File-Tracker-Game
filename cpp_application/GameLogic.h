// ============================================================
// GameLogic.h
// ------------------------------------------------------------
// The RULES of the game, with no printing and no keyboard input.
// Keeping the rules separate means the same code is used by
//   * the interactive game (GameConsole.h),
//   * the automated "computer detective" experiment (Experiment.h), and
//   * the test program (tests.cpp).
//
// THE KEY RULE: attemptAccusation() refuses every accusation until 100% of
// the evidence nodes have been explored.
// ============================================================
#ifndef GAME_LOGIC_H
#define GAME_LOGIC_H

#include <chrono>
#include <map>
#include <set>
#include <string>
#include <vector>
#include "CaseLoader.h"
using namespace std;

// Everything that changes while the player investigates.
struct GameState {
    CaseFile* caseFile = nullptr;
    EvidenceNode* current = nullptr;     // where the detective is standing now
    vector<EvidenceNode*> trail;         // path from the crime scene to "current" (used for going back)
    vector<int> walkLog;                 // every evidence id visited, in order (the path taken)
    int steps = 0;                       // number of moves (following a lead or going back)
    int exploredCount = 0;               // evidence nodes explored so far (the crime scene counts)
    int incorrectAccusations = 0;        // accusations accepted for judging but wrong
    int blockedAttempts = 0;             // accusations refused because leads were unexplored
    bool solved = false;
    chrono::steady_clock::time_point startTime;
    chrono::steady_clock::time_point endTime;
};

// The three possible answers to an accusation.
enum AccusationResult {
    ACC_BLOCKED,   // refused: not every lead has been explored yet
    ACC_WRONG,     // accepted for judging, but this is not the culprit
    ACC_SOLVED     // accepted and correct: case closed
};

// Starts (or restarts) an investigation: resets the tree, stands at the crime scene.
inline void startInvestigation(GameState& s, CaseFile& c) {
    resetExploration(c.root);
    s.caseFile = &c;
    s.current = c.root;
    s.current->explored = true;          // the player starts by examining the crime scene
    s.trail.clear();
    s.trail.push_back(c.root);
    s.walkLog.clear();
    s.walkLog.push_back(c.root->id);
    s.steps = 0;
    s.exploredCount = 1;
    s.incorrectAccusations = 0;
    s.blockedAttempts = 0;
    s.solved = false;
    s.startTime = chrono::steady_clock::now();
    s.endTime = s.startTime;
}

// Follow the left lead (goLeft = true) or the right lead (goLeft = false).
// Returns false if that lead does not exist (we are standing on a leaf).
inline bool followLead(GameState& s, bool goLeft) {
    EvidenceNode* next = goLeft ? s.current->left : s.current->right;
    if (next == nullptr) return false;
    if (!next->explored) {               // first visit: this is new evidence
        next->explored = true;
        s.exploredCount++;
    }
    s.current = next;
    s.trail.push_back(next);
    s.walkLog.push_back(next->id);
    s.steps++;
    return true;
}

// Walk back to the evidence that led here. Returns false at the crime scene.
inline bool goBack(GameState& s) {
    if (s.trail.size() <= 1) return false;
    s.trail.pop_back();
    s.current = s.trail.back();
    s.walkLog.push_back(s.current->id);
    s.steps++;
    return true;
}

// Lead completeness = explored nodes / total nodes, as a percentage.
inline double completenessPercent(const GameState& s) {
    return 100.0 * s.exploredCount / s.caseFile->totalNodes;
}

inline bool allLeadsExplored(const GameState& s) {
    return s.exploredCount == s.caseFile->totalNodes;
}

// Seconds since the investigation began (or until it was solved).
inline double elapsedSeconds(const GameState& s) {
    chrono::steady_clock::time_point end = s.solved ? s.endTime : chrono::steady_clock::now();
    return chrono::duration<double>(end - s.startTime).count();
}

// ------------------------------------------------------------
// THE ACCUSATION RULE
// 1. If any lead is still unexplored -> BLOCKED (the suspect is not even considered).
// 2. Otherwise, the right suspect solves the case, a wrong one counts as incorrect.
// ------------------------------------------------------------
inline AccusationResult attemptAccusation(GameState& s, int suspectId) {
    if (!allLeadsExplored(s)) {
        s.blockedAttempts++;
        return ACC_BLOCKED;
    }
    if (suspectId == s.caseFile->culpritId) {
        s.solved = true;
        s.endTime = chrono::steady_clock::now();
        return ACC_SOLVED;
    }
    s.incorrectAccusations++;
    return ACC_WRONG;
}

// ------------------------------------------------------------
// EVIDENCE ANALYSIS
// Looks only at EXPLORED evidence. For each suspect it counts how many clues
// point to them and records whether any clue clears them.
// ------------------------------------------------------------
inline void analyseEvidence(const GameState& s, map<int, int>& pointCount, set<int>& cleared) {
    vector<EvidenceNode*> all;
    preorder(s.caseFile->root, all);                       // visit every node once
    for (EvidenceNode* node : all) {
        if (!node->explored) continue;                     // unexplored evidence tells us nothing
        for (int id : node->pointsTo) pointCount[id]++;
        for (int id : node->clears) cleared.insert(id);
    }
}

// The detective's best deduction from the evidence found so far:
// the one suspect who is not cleared and has the most clues pointing at them.
// Returns 0 if the evidence is inconclusive (no clues yet, or a tie).
inline int deduceSuspect(const GameState& s) {
    map<int, int> pointCount;
    set<int> cleared;
    analyseEvidence(s, pointCount, cleared);

    int best = 0, bestScore = 0;
    bool tie = false;
    for (const Suspect& sus : s.caseFile->suspects) {
        if (cleared.count(sus.id)) continue;               // cleared suspects are out
        int score = pointCount[sus.id];
        if (score > bestScore) { best = sus.id; bestScore = score; tie = false; }
        else if (score == bestScore && score > 0) tie = true;
    }
    if (bestScore == 0 || tie) return 0;
    return best;
}

// If the deduction is inconclusive, the computer detective still has to name
// someone: the lowest-numbered suspect who has not been cleared.
inline int fallbackSuspect(const GameState& s) {
    map<int, int> pointCount;
    set<int> cleared;
    analyseEvidence(s, pointCount, cleared);
    vector<Suspect*> ordered;
    inorderSuspects(s.caseFile->suspectRoot, ordered);     // BST inorder = sorted by id
    for (Suspect* sus : ordered)
        if (!cleared.count(sus->id)) return sus->id;
    return ordered.empty() ? 0 : ordered[0]->id;
}

// Finds the explored evidence that clears a suspect (nullptr if none yet).
inline EvidenceNode* findClearingEvidence(const GameState& s, int suspectId) {
    vector<EvidenceNode*> all;
    preorder(s.caseFile->root, all);
    for (EvidenceNode* node : all) {
        if (!node->explored) continue;
        for (int id : node->clears)
            if (id == suspectId) return node;
    }
    return nullptr;
}

// Leads that are visible but not yet explored: the unexplored children of explored nodes.
// Each pair is (evidence that offers the lead, the lead itself).
inline vector<pair<EvidenceNode*, EvidenceNode*> > listOpenLeads(const GameState& s) {
    vector<pair<EvidenceNode*, EvidenceNode*> > open;
    vector<EvidenceNode*> all;
    preorder(s.caseFile->root, all);
    for (EvidenceNode* node : all) {
        if (!node->explored) continue;
        if (node->left != nullptr && !node->left->explored) open.push_back(make_pair(node, node->left));
        if (node->right != nullptr && !node->right->explored) open.push_back(make_pair(node, node->right));
    }
    return open;
}

// Converts a percentage target (25, 50, 75, 100) to a number of nodes.
// Rounds UP so that 25% of 15 nodes means 4 nodes (3.75 -> 4).
inline int targetNodeCount(int percent, int totalNodes) {
    return (percent * totalNodes + 99) / 100;
}

#endif
