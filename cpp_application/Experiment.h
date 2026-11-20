// ============================================================
// Experiment.h
// ------------------------------------------------------------
// LEAD COMPLETENESS vs SOLVE TIME - automated experiment.
//
// A "computer detective" investigates the real evidence tree until a target
// percentage of the leads (25%, 50%, 75% or 100%) is explored, then tries to
// accuse a suspect through the SAME attemptAccusation() rule the human game uses.
//
// For every condition we measure, with std::chrono::steady_clock:
//   * explored nodes and lead completeness,
//   * steps (moves, including walking back),
//   * the real elapsed time of the whole investigation + accusation,
//   * whether the game accepted the accusation (only possible at 100%).
//
// Nothing here is typed in by hand: every number comes from running the code.
//
// Two strategies:
//   DFS    : always take the left lead first, then the right, going back when stuck.
//   Random : take a random unexplored lead; go back only when both leads are done.
// Each condition is repeated "runs" times (default 2000) and averaged because a
// single run takes only a few microseconds on a modern computer.
// ============================================================
#ifndef EXPERIMENT_H
#define EXPERIMENT_H

#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <string>
#include <vector>
#include "GameLogic.h"
using namespace std;

// Result of one single run of the computer detective.
struct BotRun {
    int explored = 0;
    int steps = 0;
    double timeMicroseconds = 0;
    bool accepted = false;          // did the game accept the accusation for judging?
    bool solved = false;            // was it also the correct suspect?
    bool deductionCorrect = false;  // would the evidence-based deduction have named the culprit?
};

// Runs ONE investigation until "targetNodes" are explored, then accuses.
inline BotRun runBotOnce(CaseFile& c, int targetNodes, bool randomOrder, mt19937& rng) {
    GameState s;
    startInvestigation(s, c);                              // setup is not timed

    chrono::steady_clock::time_point t0 = chrono::steady_clock::now();   // ---- clock starts

    while (s.exploredCount < targetNodes) {
        bool canLeft = s.current->left != nullptr && !s.current->left->explored;
        bool canRight = s.current->right != nullptr && !s.current->right->explored;
        bool moved;
        if (canLeft && canRight) moved = followLead(s, randomOrder ? (rng() % 2 == 0) : true);
        else if (canLeft)        moved = followLead(s, true);
        else if (canRight)       moved = followLead(s, false);
        else                     moved = goBack(s);        // both leads done: step back
        if (!moved) break;                                 // safety: cannot happen on a valid tree
    }

    int suspect = deduceSuspect(s);                        // analyse the evidence collected
    bool deductionCorrect = (suspect == c.culpritId);
    if (suspect == 0) suspect = fallbackSuspect(s);        // inconclusive: name someone anyway
    AccusationResult result = attemptAccusation(s, suspect);

    chrono::steady_clock::time_point t1 = chrono::steady_clock::now();   // ---- clock stops

    BotRun run;
    run.explored = s.exploredCount;
    run.steps = s.steps;
    run.timeMicroseconds = chrono::duration<double, micro>(t1 - t0).count();
    run.accepted = (result != ACC_BLOCKED);
    run.solved = (result == ACC_SOLVED);
    run.deductionCorrect = deductionCorrect;
    return run;
}

// Averages over many runs of one condition.
struct ConditionSummary {
    string strategy;
    int percent = 0;
    int runs = 0;
    int totalNodes = 0;
    double avgExplored = 0, avgCompleteness = 0, avgSteps = 0;
    double avgTimeUs = 0, minTimeUs = 0, maxTimeUs = 0;
    double acceptedPercent = 0, solvedPercent = 0, deductionCorrectPercent = 0;
};

inline ConditionSummary runCondition(CaseFile& c, int percent, bool randomOrder, int runs, unsigned seed) {
    mt19937 rng(seed + (unsigned)percent);                 // fixed seed -> repeatable random order
    int target = targetNodeCount(percent, c.totalNodes);

    for (int i = 0; i < 200; i++) runBotOnce(c, target, randomOrder, rng);   // warm-up, not recorded

    ConditionSummary sum;
    sum.strategy = randomOrder ? "random" : "dfs";
    sum.percent = percent;
    sum.runs = runs;
    sum.totalNodes = c.totalNodes;
    sum.minTimeUs = 1e18;
    double exploredTotal = 0, stepsTotal = 0, timeTotal = 0;
    int accepted = 0, solved = 0, deductionOk = 0;

    for (int i = 0; i < runs; i++) {
        BotRun r = runBotOnce(c, target, randomOrder, rng);
        exploredTotal += r.explored;
        stepsTotal += r.steps;
        timeTotal += r.timeMicroseconds;
        if (r.timeMicroseconds < sum.minTimeUs) sum.minTimeUs = r.timeMicroseconds;
        if (r.timeMicroseconds > sum.maxTimeUs) sum.maxTimeUs = r.timeMicroseconds;
        if (r.accepted) accepted++;
        if (r.solved) solved++;
        if (r.deductionCorrect) deductionOk++;
    }
    sum.avgExplored = exploredTotal / runs;
    sum.avgCompleteness = 100.0 * sum.avgExplored / c.totalNodes;
    sum.avgSteps = stepsTotal / runs;
    sum.avgTimeUs = timeTotal / runs;
    sum.acceptedPercent = 100.0 * accepted / runs;
    sum.solvedPercent = 100.0 * solved / runs;
    sum.deductionCorrectPercent = 100.0 * deductionOk / runs;
    return sum;
}

// Runs all 8 conditions (2 strategies x 4 percentages), prints a table and saves the CSV.
inline void runExperiment(CaseFile& c, const string& prefix, int runs = 2000) {
    const int percents[] = {25, 50, 75, 100};
    vector<ConditionSummary> results;
    for (int strategy = 0; strategy < 2; strategy++)
        for (int p : percents) results.push_back(runCondition(c, p, strategy == 1, runs, 2026));

    cout << "\n=== LEAD COMPLETENESS vs SOLVE TIME (measured, " << runs << " runs per row) ===\n";
    cout << left << setw(8) << "order" << right << setw(7) << "target" << setw(9) << "nodes" << setw(11) << "complete%"
         << setw(9) << "steps" << setw(11) << "avg us" << setw(10) << "min us" << setw(10) << "max us"
         << setw(11) << "accepted%" << setw(9) << "solved%" << setw(11) << "deduce%" << "\n";
    cout << fixed;
    for (const ConditionSummary& r : results) {
        cout << left << setw(8) << r.strategy << right << setw(6) << r.percent << "%"
             << setw(9) << setprecision(2) << r.avgExplored << setw(11) << setprecision(1) << r.avgCompleteness
             << setw(9) << setprecision(2) << r.avgSteps << setw(11) << setprecision(3) << r.avgTimeUs
             << setw(10) << setprecision(3) << r.minTimeUs << setw(10) << setprecision(3) << r.maxTimeUs
             << setw(11) << setprecision(1) << r.acceptedPercent << setw(9) << r.solvedPercent
             << setw(11) << r.deductionCorrectPercent << "\n";
    }
    cout << "\n  accepted% = share of runs where the game accepted the accusation (needs 100% completeness)\n"
         << "  solved%   = accepted AND correct suspect\n"
         << "  deduce%   = how often the evidence found so far would already identify the culprit\n"
         << "  Times are the real elapsed time of one investigation on THIS computer (microseconds).\n";

    string path = prefix + "experiments/experiment_results.csv";
    ofstream out(path.c_str());
    if (!out.good()) {
        cout << "  (could not write " << path << " - run the program from inside the project folder)\n";
        return;
    }
    out << "strategy,target_percent,runs,avg_explored_nodes,total_nodes,avg_lead_completeness_percent,"
           "avg_steps,avg_solve_time_us,min_solve_time_us,max_solve_time_us,"
           "accusation_accepted_percent,case_solved_percent,deduction_correct_percent\n";
    out << fixed;
    for (const ConditionSummary& r : results) {
        out << r.strategy << "," << r.percent << "," << r.runs << "," << setprecision(2) << r.avgExplored << ","
            << r.totalNodes << "," << setprecision(1) << r.avgCompleteness << "," << setprecision(2) << r.avgSteps
            << "," << setprecision(3) << r.avgTimeUs << "," << r.minTimeUs << "," << r.maxTimeUs << ","
            << setprecision(1) << r.acceptedPercent << "," << r.solvedPercent << "," << r.deductionCorrectPercent << "\n";
    }
    cout << "  Saved: " << path << "\n";
}

// ============================================================
// SCALING EXPERIMENT
// The real case has only 15 nodes, so one investigation takes a few
// microseconds and timing noise hides the trend. To see how explored-lead
// count affects TIME, we repeat the experiment on much bigger PERFECT trees
// (made by buildPerfectTree) using the same walk and the same accusation rule.
// The synthetic trees carry no clues; only the walk and the rule are timed.
// ============================================================

// Builds a perfect binary tree of the given height. Ids follow level order.
inline EvidenceNode* buildPerfectTree(int id, int depth, int height) {
    EvidenceNode* node = createNode(id, "Synthetic", "Node " + to_string(id), "");
    if (depth < height) {
        attachLeft(node, buildPerfectTree(2 * id, depth + 1, height));
        attachRight(node, buildPerfectTree(2 * id + 1, depth + 1, height));
    }
    return node;
}

inline void runScalingExperiment(const string& prefix) {
    const int heights[] = {10, 14, 17};
    const int percents[] = {25, 50, 75, 100};

    cout << "\n=== SCALING EXPERIMENT: bigger perfect trees, same walk, same rule ===\n";
    cout << right << setw(7) << "height" << setw(9) << "nodes" << setw(8) << "target" << setw(10) << "explored"
         << setw(10) << "steps" << setw(12) << "avg ms" << setw(12) << "ns/step" << setw(11) << "accepted%" << "\n";

    string path = prefix + "experiments/scaling_results.csv";
    ofstream out(path.c_str());
    if (out.good())
        out << "tree_height,total_nodes,target_percent,explored_nodes,steps,runs,avg_time_ms,ns_per_step,accusation_accepted_percent\n";

    for (int h : heights) {
        CaseFile big;
        big.root = buildPerfectTree(1, 0, h);
        big.totalNodes = perfectTreeNodeCount(h);
        Suspect only;
        only.id = 1; only.name = "Synthetic suspect"; only.role = ""; only.description = "";
        big.suspects.push_back(only);
        big.suspectRoot = insertSuspect(big.suspectRoot, only);
        big.culpritId = 1;
        int runs = (h >= 17) ? 20 : 100;

        for (int p : percents) {
            int target = targetNodeCount(p, big.totalNodes);
            double totalMs = 0;
            int steps = 0, exploredNow = 0, accepted = 0;

            for (int i = -1; i < runs; i++) {                     // run -1 is an untimed warm-up
                GameState s;
                startInvestigation(s, big);                       // setup is not timed
                chrono::steady_clock::time_point t0 = chrono::steady_clock::now();
                while (s.exploredCount < target) {
                    bool canLeft = s.current->left != nullptr && !s.current->left->explored;
                    bool canRight = s.current->right != nullptr && !s.current->right->explored;
                    if (canLeft) followLead(s, true);
                    else if (canRight) followLead(s, false);
                    else if (!goBack(s)) break;
                }
                AccusationResult r = attemptAccusation(s, big.culpritId);
                chrono::steady_clock::time_point t1 = chrono::steady_clock::now();
                if (i < 0) continue;
                totalMs += chrono::duration<double, milli>(t1 - t0).count();
                steps = s.steps;
                exploredNow = s.exploredCount;
                if (r != ACC_BLOCKED) accepted++;
            }
            double avgMs = totalMs / runs;
            double nsPerStep = avgMs * 1e6 / steps;
            double acceptedPct = 100.0 * accepted / runs;
            cout << fixed << setw(7) << h << setw(9) << big.totalNodes << setw(7) << p << "%" << setw(10) << exploredNow
                 << setw(10) << steps << setw(12) << setprecision(4) << avgMs << setw(12) << setprecision(1) << nsPerStep
                 << setw(11) << acceptedPct << "\n";
            if (out.good())
                out << h << "," << big.totalNodes << "," << p << "," << exploredNow << "," << steps << "," << runs << ","
                    << fixed << setprecision(4) << avgMs << "," << setprecision(1) << nsPerStep << "," << acceptedPct << "\n";
        }
        freeCase(big);
    }
    cout << "\n  Time grows in proportion to the number of steps (about constant ns/step),\n"
         << "  and the accusation is accepted only at 100% completeness.\n";
    if (out.good()) cout << "  Saved: " << path << "\n";
}

#endif
