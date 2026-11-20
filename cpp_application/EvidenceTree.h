// ============================================================
// EvidenceTree.h
// ------------------------------------------------------------
// The heart of the project: a GENERAL BINARY TREE of evidence.
//
//  * Every node is one piece of evidence.
//  * left  = first investigation lead, right = second investigation lead.
//  * A node with two children is an evidence node that branches into
//    exactly two leads. A node with no children is a "leaf": a final finding.
//
// NOTE: this is NOT a Binary Search Tree. Evidence ids are NOT ordered
// left < parent < right, so searching has to look at every node (O(n)).
// (The suspects, which have unique ids, DO use a BST - see SuspectBST.h.)
//
// Height convention used everywhere in this project:
//   empty tree = -1, a single node = 0, our 15-node case tree = 3.
//   (height counts EDGES on the longest root-to-leaf path)
// ============================================================
#ifndef EVIDENCE_TREE_H
#define EVIDENCE_TREE_H

#include <iostream>
#include <string>
#include <vector>
#include <queue>
using namespace std;

// One node of the evidence tree.
struct EvidenceNode {
    int id;                    // unique evidence number
    string type;               // Physical, Forensic, Testimony, Document, Digital, Surveillance, Scene
    string title;              // short name of the lead
    string description;        // what the detective learns when the lead is explored
    vector<int> pointsTo;      // suspect ids this evidence points towards
    vector<int> clears;        // suspect ids this evidence rules out
    bool explored;             // has the player opened this lead yet?
    EvidenceNode* left;        // first lead
    EvidenceNode* right;       // second lead
};

// ------------------------------------------------------------
// NODE CREATION
// Allocates a new node with no children and "not explored".
// ------------------------------------------------------------
inline EvidenceNode* createNode(int id, const string& type, const string& title,
                                const string& description) {
    EvidenceNode* node = new EvidenceNode;
    node->id = id;
    node->type = type;
    node->title = title;
    node->description = description;
    node->explored = false;
    node->left = nullptr;
    node->right = nullptr;
    return node;
}

// ------------------------------------------------------------
// CONNECTING CHILDREN
// These two functions create the left and right child links.
// ------------------------------------------------------------
inline void attachLeft(EvidenceNode* parent, EvidenceNode* child) { parent->left = child; }
inline void attachRight(EvidenceNode* parent, EvidenceNode* child) { parent->right = child; }

// ------------------------------------------------------------
// RECURSIVE TRAVERSALS (depth-first)
// Each one fills the vector "out" with the nodes in visiting order.
//   Preorder  : Root, Left, Right   -> the order a detective follows leads depth-first
//   Inorder   : Left, Root, Right
//   Postorder : Left, Right, Root   -> children (findings) before the evidence that led to them
// ------------------------------------------------------------
inline void preorder(EvidenceNode* node, vector<EvidenceNode*>& out) {
    if (node == nullptr) return;       // base case: empty subtree
    out.push_back(node);               // visit root
    preorder(node->left, out);         // then everything on the left
    preorder(node->right, out);        // then everything on the right
}

inline void inorder(EvidenceNode* node, vector<EvidenceNode*>& out) {
    if (node == nullptr) return;
    inorder(node->left, out);
    out.push_back(node);
    inorder(node->right, out);
}

inline void postorder(EvidenceNode* node, vector<EvidenceNode*>& out) {
    if (node == nullptr) return;
    postorder(node->left, out);
    postorder(node->right, out);
    out.push_back(node);
}

// ------------------------------------------------------------
// LEVEL-ORDER TRAVERSAL (breadth-first)
// Visits the tree one level at a time using a queue:
// the crime scene, then both first leads, then all second-stage leads...
// ------------------------------------------------------------
inline void levelOrder(EvidenceNode* root, vector<EvidenceNode*>& out) {
    if (root == nullptr) return;
    queue<EvidenceNode*> waiting;
    waiting.push(root);
    while (!waiting.empty()) {
        EvidenceNode* current = waiting.front();
        waiting.pop();
        out.push_back(current);
        if (current->left != nullptr) waiting.push(current->left);
        if (current->right != nullptr) waiting.push(current->right);
    }
}

// ------------------------------------------------------------
// COUNTING FUNCTIONS
// ------------------------------------------------------------
// Total number of evidence nodes: 1 (this node) + nodes on the left + nodes on the right.
inline int countNodes(EvidenceNode* node) {
    if (node == nullptr) return 0;
    return 1 + countNodes(node->left) + countNodes(node->right);
}

// Leaf nodes have no children: they are the final findings of each trail.
inline int countLeaves(EvidenceNode* node) {
    if (node == nullptr) return 0;
    if (node->left == nullptr && node->right == nullptr) return 1;
    return countLeaves(node->left) + countLeaves(node->right);
}

// Height = number of edges on the longest path from this node down to a leaf.
inline int treeHeight(EvidenceNode* node) {
    if (node == nullptr) return -1;
    int leftHeight = treeHeight(node->left);
    int rightHeight = treeHeight(node->right);
    return 1 + (leftHeight > rightHeight ? leftHeight : rightHeight);
}

// How many nodes the player has already explored.
inline int countExploredNodes(EvidenceNode* node) {
    if (node == nullptr) return 0;
    return (node->explored ? 1 : 0) + countExploredNodes(node->left) + countExploredNodes(node->right);
}

// Sets explored = false everywhere (used when a new game or a replay begins).
inline void resetExploration(EvidenceNode* node) {
    if (node == nullptr) return;
    node->explored = false;
    resetExploration(node->left);
    resetExploration(node->right);
}

// ------------------------------------------------------------
// SEARCH / EVIDENCE RETRIEVAL
// Finds the node with a given evidence id. Because this is a general
// binary tree (not a BST) we may have to look in both subtrees.
// Returns nullptr if the id does not exist.
// ------------------------------------------------------------
inline EvidenceNode* findById(EvidenceNode* node, int id) {
    if (node == nullptr) return nullptr;
    if (node->id == id) return node;
    EvidenceNode* inLeft = findById(node->left, id);
    if (inLeft != nullptr) return inLeft;
    return findById(node->right, id);
}

// ------------------------------------------------------------
// PROPERTY CHECK 1: FULL BINARY TREE
// Every node has either 0 children or exactly 2 children.
// Investigation meaning: every piece of evidence offers exactly two leads
// (never just one), and only the final findings are dead ends.
// ------------------------------------------------------------
inline bool isFull(EvidenceNode* node) {
    if (node == nullptr) return true;                              // empty tree is full
    if (node->left == nullptr && node->right == nullptr) return true;   // leaf is fine
    if (node->left != nullptr && node->right != nullptr)           // two children: check below
        return isFull(node->left) && isFull(node->right);
    return false;                                                  // exactly one child: not full
}

// ------------------------------------------------------------
// PROPERTY CHECK 2: COMPLETE BINARY TREE
// Every level is completely filled except possibly the last, and the last
// level is filled from the left with no gaps.
// Method: walk level by level; once we meet a missing child (a "gap"),
// no real node may appear after it.
// Investigation meaning: the case file has no holes - leads are filled
// in order from the crime scene outwards.
// ------------------------------------------------------------
inline bool isComplete(EvidenceNode* root) {
    if (root == nullptr) return true;
    queue<EvidenceNode*> waiting;
    waiting.push(root);
    bool seenGap = false;
    while (!waiting.empty()) {
        EvidenceNode* current = waiting.front();
        waiting.pop();

        if (current->left != nullptr) {
            if (seenGap) return false;          // a node after a gap -> not complete
            waiting.push(current->left);
        } else {
            seenGap = true;
        }

        if (current->right != nullptr) {
            if (seenGap) return false;
            waiting.push(current->right);
        } else {
            seenGap = true;
        }
    }
    return true;
}

// ------------------------------------------------------------
// PROPERTY CHECK 3: PERFECT BINARY TREE
// Every internal node has 2 children AND all leaves are at the same depth.
// A perfect tree of height h has exactly 2^(h+1) - 1 nodes and 2^h leaves.
// Investigation meaning: every trail of evidence is equally deep, so every
// final finding needs the same number of leads to reach.
// ------------------------------------------------------------
inline bool isPerfectHelper(EvidenceNode* node, int depth, int leafDepth) {
    if (node == nullptr) return true;
    if (node->left == nullptr && node->right == nullptr)
        return depth == leafDepth;                   // every leaf must be at the same depth
    if (node->left == nullptr || node->right == nullptr)
        return false;                                // one child only: not even full
    return isPerfectHelper(node->left, depth + 1, leafDepth) &&
           isPerfectHelper(node->right, depth + 1, leafDepth);
}

inline bool isPerfect(EvidenceNode* root) {
    if (root == nullptr) return true;
    int leafDepth = 0;                               // depth of the left-most leaf
    EvidenceNode* walker = root;
    while (walker->left != nullptr) {
        walker = walker->left;
        leafDepth++;
    }
    return isPerfectHelper(root, 0, leafDepth);
}

// Formula for the number of nodes in a perfect tree of height h: 2^(h+1) - 1.
inline int perfectTreeNodeCount(int height) { return (1 << (height + 1)) - 1; }

// ------------------------------------------------------------
// MEMORY CLEAN-UP
// Deletes the whole tree (postorder: children first, then the node).
// ------------------------------------------------------------
inline void freeTree(EvidenceNode* node) {
    if (node == nullptr) return;
    freeTree(node->left);
    freeTree(node->right);
    delete node;
}

#endif
