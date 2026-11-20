// ============================================================
// TreeDemo.h
// ------------------------------------------------------------
// Teaching helpers:
//   * showTreeProperties()  prints counts, height and the Full / Complete /
//                           Perfect results for any tree.
//   * buildDemoTree()       builds small example trees to show how the three
//                           property checks differ.
//   * runTreeAnalysis()     runs every tree operation on the real case tree.
// ============================================================
#ifndef TREE_DEMO_H
#define TREE_DEMO_H

#include <iostream>
#include <string>
#include <vector>
#include "CaseLoader.h"
using namespace std;

inline string yesNo(bool value) { return value ? "YES" : "no"; }

// Prints the ids of a traversal result on one line, e.g. "1 2 4 8 ...".
inline void printIds(const string& label, const vector<EvidenceNode*>& order) {
    cout << "  " << label;
    for (size_t i = 0; i < order.size(); i++) cout << order[i]->id << (i + 1 < order.size() ? " " : "");
    cout << "\n";
}

// Prints node count, leaf count, height and the three property checks.
inline void showTreeProperties(const string& name, EvidenceNode* root) {
    int nodes = countNodes(root);
    int height = treeHeight(root);
    cout << "  " << name << "\n";
    cout << "     nodes = " << nodes << ", leaves = " << countLeaves(root) << ", height = " << height << "\n";
    cout << "     Full: " << yesNo(isFull(root)) << "   Complete: " << yesNo(isComplete(root))
         << "   Perfect: " << yesNo(isPerfect(root)) << "\n";
}

// Builds a small example tree. Node ids are just labels 1, 2, 3 ...
//  shape 1: PERFECT   7 nodes   (all three properties true)
//  shape 2: COMPLETE  6 nodes   (complete, but node 3 has one child, so NOT full)
//  shape 3: FULL      5 nodes   (every node has 0 or 2 children, but a gap appears, so NOT complete)
//  shape 4: SKEWED    4 nodes   (a chain: none of the three)
inline EvidenceNode* buildDemoTree(int shape) {
    EvidenceNode* n[8];
    for (int i = 1; i <= 7; i++) n[i] = createNode(i, "Demo", "Node " + to_string(i), "");
    if (shape == 1) {                       //        1
        attachLeft(n[1], n[2]);             //      2   3
        attachRight(n[1], n[3]);            //     4 5 6 7
        attachLeft(n[2], n[4]); attachRight(n[2], n[5]);
        attachLeft(n[3], n[6]); attachRight(n[3], n[7]);
        return n[1];
    }
    if (shape == 2) {                       //        1
        attachLeft(n[1], n[2]);             //      2   3
        attachRight(n[1], n[3]);            //     4 5 6
        attachLeft(n[2], n[4]); attachRight(n[2], n[5]);
        attachLeft(n[3], n[6]);
        delete n[7];
        return n[1];
    }
    if (shape == 3) {                       //        1
        attachLeft(n[1], n[2]);             //      2   3
        attachRight(n[1], n[3]);            //         4 5
        attachLeft(n[3], n[4]); attachRight(n[3], n[5]);
        delete n[6]; delete n[7];
        return n[1];
    }
    // shape 4: skewed chain 1 -> 2 -> 3 -> 4 (each node has only a left child)
    attachLeft(n[1], n[2]); attachLeft(n[2], n[3]); attachLeft(n[3], n[4]);
    delete n[5]; delete n[6]; delete n[7];
    return n[1];
}

// Demonstrates Full / Complete / Perfect on four small trees and on the case tree.
inline void runPropertyDemo(CaseFile& c) {
    cout << "\n=== FULL vs COMPLETE vs PERFECT binary trees ===\n";
    cout << "  Full     : every node has 0 or 2 children.\n";
    cout << "  Complete : all levels full except maybe the last, which fills from the left.\n";
    cout << "  Perfect  : full AND every leaf on the same level (2^(h+1)-1 nodes).\n\n";

    const char* names[] = {"", "Example A (7 nodes, balanced pyramid)", "Example B (6 nodes, last level half filled)",
                           "Example C (5 nodes, one leaf early)", "Example D (4 nodes, a straight chain)"};
    for (int shape = 1; shape <= 4; shape++) {
        EvidenceNode* demo = buildDemoTree(shape);
        showTreeProperties(names[shape], demo);
        freeTree(demo);
    }
    cout << "\n  THE INVESTIGATION TREE (" << c.title << ")\n";
    showTreeProperties("Case tree loaded from the dataset", c.root);
    int h = treeHeight(c.root);
    cout << "     A perfect tree of height " << h << " must have 2^" << (h + 1) << " - 1 = "
         << perfectTreeNodeCount(h) << " nodes; ours has " << countNodes(c.root) << ".\n";
    cout << "\n  What this means for the investigation:\n";
    cout << "   - FULL    : each piece of evidence gives exactly two leads; only final findings are dead ends.\n";
    cout << "   - COMPLETE: the case file has no holes - every level is filled from the left.\n";
    cout << "   - PERFECT : every trail is equally deep (" << h << " leads from the crime scene to any finding),\n";
    cout << "               so no lead is easier or harder to reach than another.\n";
}

// Runs every binary tree operation on the real case tree and on the suspect BST.
inline void runTreeAnalysis(CaseFile& c) {
    cout << "\n=== BINARY TREE ANALYSIS OF THE CASE: " << c.title << " ===\n";
    cout << "  Total evidence nodes : " << countNodes(c.root) << "\n";
    cout << "  Leaf nodes           : " << countLeaves(c.root) << "\n";
    cout << "  Internal nodes       : " << countNodes(c.root) - countLeaves(c.root) << "\n";
    cout << "  Height               : " << treeHeight(c.root) << "  (levels = height + 1 = " << treeHeight(c.root) + 1 << ")\n";

    vector<EvidenceNode*> pre, in, post, level;
    preorder(c.root, pre);
    inorder(c.root, in);
    postorder(c.root, post);
    levelOrder(c.root, level);

    cout << "\n  Traversals (evidence ids):\n";
    printIds("Preorder   (Root,Left,Right): ", pre);
    printIds("Inorder    (Left,Root,Right): ", in);
    printIds("Postorder  (Left,Right,Root): ", post);
    printIds("Level-order (by level)      : ", level);

    cout << "\n  Level-order with titles:\n";
    for (EvidenceNode* node : level)
        cout << "    #" << node->id << " [" << node->type << "] " << node->title << "\n";

    cout << "\n  Search / evidence retrieval:\n";
    int ids[] = {9, 15, 42};
    for (int id : ids) {
        EvidenceNode* found = findById(c.root, id);
        if (found) cout << "    findById(" << id << ") -> " << found->title << " [" << found->type << "]\n";
        else       cout << "    findById(" << id << ") -> not found\n";
    }

    cout << "\n  Properties:\n";
    cout << "    isFull    = " << yesNo(isFull(c.root)) << "\n";
    cout << "    isComplete= " << yesNo(isComplete(c.root)) << "\n";
    cout << "    isPerfect = " << yesNo(isPerfect(c.root)) << "\n";

    cout << "\n  Suspect BST (ordered by unique id - a real use of a Binary SEARCH Tree):\n";
    vector<Suspect*> sorted;
    inorderSuspects(c.suspectRoot, sorted);
    cout << "    Inorder (sorted by id): ";
    for (size_t i = 0; i < sorted.size(); i++) cout << sorted[i]->id << (i + 1 < sorted.size() ? ", " : "\n");
    cout << "    BST height: " << suspectTreeHeight(c.suspectRoot) << "\n";
    Suspect* s = searchSuspect(c.suspectRoot, 4);
    cout << "    searchSuspect(4) -> " << (s ? s->name : string("not found")) << "\n";
    s = searchSuspect(c.suspectRoot, 9);
    cout << "    searchSuspect(9) -> " << (s ? s->name : string("not found")) << "\n";
}

#endif
