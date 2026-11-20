// ============================================================
// CaseLoader.h
// ------------------------------------------------------------
// Reads the mystery from dataset/case_haveli.txt and builds:
//   * the evidence tree (a general binary tree of EvidenceNode), and
//   * the suspect BST (ordered by suspect id).
//
// The text file has one record per line, fields separated by '|'.
// See the comment at the top of the dataset file for the format.
// ============================================================
#ifndef CASE_LOADER_H
#define CASE_LOADER_H

#include <cstdlib>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>
#include "EvidenceTree.h"
#include "SuspectBST.h"
using namespace std;

// Everything the game needs to know about one case.
struct CaseFile {
    string title;
    string victim;
    string intro;
    string solution;
    int culpritId = 0;
    vector<Suspect> suspects;          // suspects exactly as read from the file
    SuspectNode* suspectRoot = nullptr; // the same suspects organised as a BST
    EvidenceNode* root = nullptr;       // root of the evidence tree (the crime scene)
    int totalNodes = 0;                 // number of evidence nodes in the tree
};

// Splits "a|b|c" into {"a","b","c"}.
inline vector<string> splitFields(const string& line, char separator) {
    vector<string> parts;
    string piece;
    stringstream stream(line);
    while (getline(stream, piece, separator)) parts.push_back(piece);
    return parts;
}

// Turns "3,5" into {3,5} and "-" into {}.
inline vector<int> parseIdList(const string& text) {
    vector<int> ids;
    if (text == "-" || text.empty()) return ids;
    for (const string& piece : splitFields(text, ',')) ids.push_back(atoi(piece.c_str()));
    return ids;
}

// Does a file exist and can we open it?
inline bool fileExists(const string& path) {
    ifstream file(path.c_str());
    return file.good();
}

// The program may be started from cpp_application/, from the project folder or
// from a build folder. We try a few prefixes until we find the dataset.
// Returns the prefix ("", "../" or "../../") or "?" if the dataset was not found.
inline string locateProjectPrefix() {
    const char* prefixes[] = {"", "../", "../../", "../../../"};
    for (const char* p : prefixes) {
        string candidate = string(p) + "dataset/case_haveli.txt";
        if (fileExists(candidate)) return p;
    }
    return "?";
}

// Loads the case from "path". Returns true on success; otherwise puts a
// human-readable problem description in "error".
inline bool loadCase(const string& path, CaseFile& c, string& error) {
    ifstream file(path.c_str());
    if (!file.good()) {
        error = "Cannot open case file: " + path;
        return false;
    }

    map<int, EvidenceNode*> nodeById;   // quick way to find a parent while linking
    string line;
    int lineNumber = 0;

    while (getline(file, line)) {
        lineNumber++;
        if (!line.empty() && line[line.size() - 1] == '\r') line.erase(line.size() - 1); // Windows line ends
        if (line.empty() || line[0] == '#') continue;                                   // skip comments

        vector<string> f = splitFields(line, '|');
        const string& kind = f[0];

        if (kind == "CASE" && f.size() >= 4) {
            c.title = f[1]; c.victim = f[2]; c.intro = f[3];
        } else if (kind == "SOLUTION" && f.size() >= 2) {
            c.solution = f[1];
        } else if (kind == "CULPRIT" && f.size() >= 2) {
            c.culpritId = atoi(f[1].c_str());
        } else if (kind == "SUSPECT" && f.size() >= 5) {
            Suspect s;
            s.id = atoi(f[1].c_str()); s.name = f[2]; s.role = f[3]; s.description = f[4];
            c.suspects.push_back(s);
            c.suspectRoot = insertSuspect(c.suspectRoot, s);   // build the BST while reading
        } else if (kind == "NODE" && f.size() >= 9) {
            int id = atoi(f[1].c_str());
            int parentId = atoi(f[2].c_str());
            string side = f[3];

            EvidenceNode* node = createNode(id, f[4], f[5], f[6]);   // node creation
            node->pointsTo = parseIdList(f[7]);
            node->clears = parseIdList(f[8]);
            nodeById[id] = node;
            c.totalNodes++;

            if (side == "ROOT") {
                c.root = node;
            } else {
                if (nodeById.find(parentId) == nodeById.end()) {
                    error = "Line " + to_string(lineNumber) + ": parent " + to_string(parentId) +
                            " must be listed before child " + to_string(id);
                    return false;
                }
                EvidenceNode* parent = nodeById[parentId];
                if (side == "L") attachLeft(parent, node);          // left child link
                else             attachRight(parent, node);         // right child link
            }
        } else {
            error = "Line " + to_string(lineNumber) + ": cannot understand: " + line.substr(0, 40);
            return false;
        }
    }

    if (c.root == nullptr) { error = "The case file has no ROOT node."; return false; }
    if (c.culpritId == 0)  { error = "The case file has no CULPRIT line."; return false; }
    return true;
}

// Frees everything owned by the case.
inline void freeCase(CaseFile& c) {
    freeTree(c.root);
    freeSuspects(c.suspectRoot);
    c.root = nullptr;
    c.suspectRoot = nullptr;
}

#endif
