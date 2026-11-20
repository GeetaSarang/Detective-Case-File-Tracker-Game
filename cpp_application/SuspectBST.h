// ============================================================
// SuspectBST.h
// ------------------------------------------------------------
// A BINARY SEARCH TREE (BST) of suspects, ordered by unique suspect id.
//
// This is where a BST is the RIGHT tool:
//   * suspect ids are unique numbers,
//   * we often need "find suspect number 3" quickly,
//   * an inorder walk gives the suspects sorted by id for free.
//
// BST rule: for every node, all ids in the LEFT subtree are smaller and
// all ids in the RIGHT subtree are larger.
// Search/insert cost is O(h) where h is the height (O(log n) when balanced).
//
// The evidence tree is deliberately NOT a BST (see EvidenceTree.h).
// ============================================================
#ifndef SUSPECT_BST_H
#define SUSPECT_BST_H

#include <string>
#include <vector>
using namespace std;

// Plain data about one suspect.
struct Suspect {
    int id;
    string name;
    string role;
    string description;
};

// One node of the suspect BST.
struct SuspectNode {
    Suspect data;
    SuspectNode* left;
    SuspectNode* right;
};

// Inserts a suspect, keeping the BST rule. Returns the (possibly new) root.
inline SuspectNode* insertSuspect(SuspectNode* root, const Suspect& s) {
    if (root == nullptr) {                       // found the empty spot: create the node here
        SuspectNode* node = new SuspectNode;
        node->data = s;
        node->left = nullptr;
        node->right = nullptr;
        return node;
    }
    if (s.id < root->data.id)       root->left = insertSuspect(root->left, s);    // smaller -> go left
    else if (s.id > root->data.id)  root->right = insertSuspect(root->right, s);  // larger  -> go right
    // equal ids are ignored because ids must be unique
    return root;
}

// Looks a suspect up by id. Returns nullptr if there is no such suspect.
inline Suspect* searchSuspect(SuspectNode* root, int id) {
    if (root == nullptr) return nullptr;
    if (id == root->data.id) return &root->data;
    if (id < root->data.id) return searchSuspect(root->left, id);
    return searchSuspect(root->right, id);
}

// Inorder walk of a BST = suspects sorted by id (smallest first).
inline void inorderSuspects(SuspectNode* root, vector<Suspect*>& out) {
    if (root == nullptr) return;
    inorderSuspects(root->left, out);
    out.push_back(&root->data);
    inorderSuspects(root->right, out);
}

// Height of the BST (empty = -1, single node = 0).
inline int suspectTreeHeight(SuspectNode* root) {
    if (root == nullptr) return -1;
    int l = suspectTreeHeight(root->left);
    int r = suspectTreeHeight(root->right);
    return 1 + (l > r ? l : r);
}

// Frees the BST.
inline void freeSuspects(SuspectNode* root) {
    if (root == nullptr) return;
    freeSuspects(root->left);
    freeSuspects(root->right);
    delete root;
}

#endif
