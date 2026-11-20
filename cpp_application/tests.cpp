// ============================================================
// tests.cpp - automatic test cases
// ------------------------------------------------------------
// Build and run:
//     g++ -std=c++17 -Wall -Wextra tests.cpp -o run_tests
//     ./run_tests            (Windows: run_tests.exe)
//
// Every CHECK(...) prints PASS or FAIL. The program returns 0 only if all pass.
// ============================================================
#include <iostream>
#include <random>
#include <string>
#include <vector>
#include "CaseLoader.h"
#include "GameLogic.h"
#include "TreeDemo.h"
#include "Experiment.h"
using namespace std;

int passed = 0, failed = 0;

// Prints PASS/FAIL for one condition.
void check(bool condition, const string& description) {
    if (condition) { passed++; cout << "  PASS  " << description << "\n"; }
    else           { failed++; cout << "  FAIL  " << description << "\n"; }
}

// Turns a traversal result into "1 2 4 8" so it can be compared with a string.
string idsToString(const vector<EvidenceNode*>& order) {
    string text;
    for (size_t i = 0; i < order.size(); i++) text += (i ? " " : "") + to_string(order[i]->id);
    return text;
}

int main() {
    string prefix = locateProjectPrefix();
    CaseFile c;
    string error;
    if (prefix == "?" || !loadCase(prefix + "dataset/case_haveli.txt", c, error)) {
        cout << "Cannot load the case file (run from the project folder). " << error << "\n";
        return 1;
    }

    cout << "\nTEST GROUP 1: loading and counting\n";
    check(c.totalNodes == 15, "case has 15 evidence nodes");
    check(countNodes(c.root) == 15, "countNodes = 15");
    check(countLeaves(c.root) == 8, "countLeaves = 8");
    check(treeHeight(c.root) == 3, "height = 3 (4 levels)");
    check(c.suspects.size() == 5, "five suspects loaded");
    check(countNodes(nullptr) == 0 && treeHeight(nullptr) == -1, "empty tree: 0 nodes, height -1");

    cout << "\nTEST GROUP 2: traversals\n";
    vector<EvidenceNode*> pre, in, post, level;
    preorder(c.root, pre); inorder(c.root, in); postorder(c.root, post); levelOrder(c.root, level);
    check(idsToString(pre) == "1 2 4 8 9 5 10 11 3 6 12 13 7 14 15", "preorder is correct");
    check(idsToString(in) == "8 4 9 2 10 5 11 1 12 6 13 3 14 7 15", "inorder is correct");
    check(idsToString(post) == "8 9 4 10 11 5 2 12 13 6 14 15 7 3 1", "postorder is correct");
    check(idsToString(level) == "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15", "level-order is correct");

    cout << "\nTEST GROUP 3: search\n";
    EvidenceNode* gate = findById(c.root, 7);
    check(gate != nullptr && gate->title == "Gate Register", "findById(7) is the Gate Register");
    check(findById(c.root, 99) == nullptr, "findById(99) returns nullptr");

    cout << "\nTEST GROUP 4: Full / Complete / Perfect checks\n";
    check(isFull(c.root) && isComplete(c.root) && isPerfect(c.root), "case tree is full, complete AND perfect");
    check(countNodes(c.root) == perfectTreeNodeCount(treeHeight(c.root)), "15 = 2^(3+1) - 1");
    EvidenceNode* a = buildDemoTree(1);
    check(isFull(a) && isComplete(a) && isPerfect(a), "demo A (7 nodes): full, complete, perfect");
    EvidenceNode* b = buildDemoTree(2);
    check(!isFull(b) && isComplete(b) && !isPerfect(b), "demo B (6 nodes): complete only");
    EvidenceNode* d = buildDemoTree(3);
    check(isFull(d) && !isComplete(d) && !isPerfect(d), "demo C (5 nodes): full only");
    EvidenceNode* e = buildDemoTree(4);
    check(!isFull(e) && !isComplete(e) && !isPerfect(e), "demo D (chain): none of the three");
    check(isFull(nullptr) && isComplete(nullptr) && isPerfect(nullptr), "empty tree counts as all three");
    freeTree(a); freeTree(b); freeTree(d); freeTree(e);

    cout << "\nTEST GROUP 5: suspect BST\n";
    vector<Suspect*> sorted;
    inorderSuspects(c.suspectRoot, sorted);
    string suspectIds;
    for (size_t i = 0; i < sorted.size(); i++) suspectIds += (i ? " " : "") + to_string(sorted[i]->id);
    check(suspectIds == "1 2 3 4 5", "BST inorder gives suspects sorted by id");
    Suspect* culpritS = searchSuspect(c.suspectRoot, 4);
    check(culpritS != nullptr && culpritS->name == "Abhinav Malhotra", "searchSuspect(4) = Abhinav Malhotra");
    check(searchSuspect(c.suspectRoot, 9) == nullptr, "searchSuspect(9) = not found");
    check(suspectTreeHeight(c.suspectRoot) == 2, "suspect BST height = 2");

    cout << "\nTEST GROUP 6: game rules\n";
    GameState s;
    startInvestigation(s, c);
    check(s.exploredCount == 1 && s.steps == 0, "game starts with the crime scene explored, 0 steps");
    check(attemptAccusation(s, c.culpritId) == ACC_BLOCKED, "correct suspect is REFUSED at 6.7% completeness");
    check(s.blockedAttempts == 1 && !s.solved, "refused attempt is counted and case stays open");
    check(!goBack(s), "cannot go back from the crime scene");

    // Explore every node with the computer detective's depth-first walk, stopping before the last node.
    mt19937 rng(1);
    int fullTarget = targetNodeCount(100, c.totalNodes);
    while (s.exploredCount < fullTarget - 1) {
        bool l = s.current->left && !s.current->left->explored;
        bool r = s.current->right && !s.current->right->explored;
        if (l) followLead(s, true); else if (r) followLead(s, false); else goBack(s);
    }
    check(s.exploredCount == 14, "14 of 15 leads explored");
    check(attemptAccusation(s, c.culpritId) == ACC_BLOCKED, "correct suspect is STILL refused at 93.3%");
    while (s.exploredCount < fullTarget) {
        bool l = s.current->left && !s.current->left->explored;
        bool r = s.current->right && !s.current->right->explored;
        if (l) followLead(s, true); else if (r) followLead(s, false); else goBack(s);
    }
    check(allLeadsExplored(s) && completenessPercent(s) == 100.0, "100% completeness reached");
    check(s.steps == 25, "full depth-first walk needs 25 steps (2*14 - depth 3)");
    check(attemptAccusation(s, 1) == ACC_WRONG && s.incorrectAccusations == 1, "wrong suspect at 100% = incorrect accusation");
    check(findClearingEvidence(s, 1) != nullptr, "wrong accusation has clearing evidence to show");
    check(attemptAccusation(s, c.culpritId) == ACC_SOLVED && s.solved, "correct suspect at 100% solves the case");
    check(deduceSuspect(s) == 4, "full evidence deduces Abhinav Malhotra (id 4)");
    check(listOpenLeads(s).empty(), "no open leads remain");

    cout << "\nTEST GROUP 7: percentage targets\n";
    check(targetNodeCount(25, 15) == 4, "25% of 15 nodes = 4");
    check(targetNodeCount(50, 15) == 8, "50% of 15 nodes = 8");
    check(targetNodeCount(75, 15) == 12, "75% of 15 nodes = 12");
    check(targetNodeCount(100, 15) == 15, "100% of 15 nodes = 15");

    cout << "\nTEST GROUP 8: automated experiment obeys the 100% rule\n";
    mt19937 rng2(7);
    int percents[] = {25, 50, 75, 100};
    for (int p : percents) {
        BotRun r = runBotOnce(c, targetNodeCount(p, c.totalNodes), false, rng2);
        check(r.explored == targetNodeCount(p, c.totalNodes), to_string(p) + "%: explored the requested number of nodes");
        if (p < 100) check(!r.accepted && !r.solved, to_string(p) + "%: accusation NOT accepted");
        else         check(r.accepted && r.solved, "100%: accusation accepted and case solved");
    }
    BotRun r25 = runBotOnce(c, 4, false, rng2);
    BotRun r100 = runBotOnce(c, 15, false, rng2);
    check(r25.steps < r100.steps, "more leads explored means more steps (DFS)");
    check(r100.timeMicroseconds > 0, "elapsed time is measured (> 0 microseconds)");

    freeCase(c);
    cout << "\nRESULT: " << passed << " passed, " << failed << " failed.\n";
    return failed == 0 ? 0 : 1;
}
