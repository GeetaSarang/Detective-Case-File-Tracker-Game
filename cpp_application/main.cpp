// ============================================================
// main.cpp - Detective Mystery Game Using Binary Trees
// ------------------------------------------------------------
// Start-up and the main menu. Build with ONE command:
//     g++ -std=c++17 -Wall -Wextra main.cpp -o detective
//
// Extra command-line options (handy for demos and testing):
//     detective --experiment   run the automated lead-completeness experiment
//     detective --scaling      run the experiment again on much bigger trees
//     detective --analysis     print traversals, counts, height and searches
//     detective --demo         show Full / Complete / Perfect examples
// ============================================================
#include <iostream>
#include <string>
#include "CaseLoader.h"
#include "GameConsole.h"
#include "Experiment.h"
#include "TreeDemo.h"
using namespace std;

// Asks a yes/no question. Returns false at end of input.
bool askYesNo(const string& question) {
    cout << question << " (Y/N): ";
    string line;
    if (!getline(cin, line)) return false;
    return toUpperTrim(line) == "Y";
}

// Plays investigations until the player stops.
void playLoop(CaseFile& c, int targetPercent, const string& prefix) {
    while (true) {
        PlayResult result = playGame(c, targetPercent, prefix);
        if (result == PLAY_QUIT) return;
        if (!askYesNo("\nPlay again?")) return;
    }
}

// Menu option 2: choose a completeness target for the human experiment.
void guidedExperiment(CaseFile& c, const string& prefix) {
    cout << "\nGUIDED EXPERIMENT: choose how much of the case you explore before accusing.\n";
    cout << "  1) 25%   2) 50%   3) 75%   4) 100%\n  Choice: ";
    string line;
    if (!getline(cin, line)) return;
    int choice = atoi(line.c_str());
    if (choice < 1 || choice > 4) { cout << "Not a valid choice.\n"; return; }
    int percents[] = {0, 25, 50, 75, 100};
    playLoop(c, percents[choice], prefix);
    cout << "Your attempts are saved in " << prefix << "experiments/human_sessions.csv\n";
}

int main(int argc, char* argv[]) {
    string prefix = locateProjectPrefix();
    if (prefix == "?") {
        cout << "Could not find dataset/case_haveli.txt.\n"
             << "Open a terminal in the Detective_Mystery_Game folder (or its cpp_application folder)\n"
             << "and run the program from there.\n";
        return 1;
    }

    CaseFile theCase;
    string error;
    if (!loadCase(prefix + "dataset/case_haveli.txt", theCase, error)) {
        cout << "Problem reading the case file: " << error << "\n";
        return 1;
    }

    // Command-line shortcuts.
    if (argc > 1) {
        string option = argv[1];
        if (option == "--experiment") runExperiment(theCase, prefix);
        else if (option == "--scaling") runScalingExperiment(prefix);
        else if (option == "--analysis") runTreeAnalysis(theCase);
        else if (option == "--demo") runPropertyDemo(theCase);
        else cout << "Unknown option. Use --experiment, --scaling, --analysis or --demo.\n";
        freeCase(theCase);
        return 0;
    }

    // Main menu.
    while (true) {
        cout << "\n========================================================\n";
        cout << "   DETECTIVE MYSTERY GAME USING BINARY TREES\n";
        cout << "   Case loaded: " << theCase.title << "\n";
        cout << "========================================================\n";
        cout << "  1) Play the mystery\n";
        cout << "  2) Guided experiment (you play, the game records your time)\n";
        cout << "  3) Automated lead-completeness experiment (computer detective)\n";
        cout << "  4) Scaling experiment (same test on much bigger trees)\n";
        cout << "  5) Binary tree analysis: traversals, counts, height, search\n";
        cout << "  6) Full / Complete / Perfect binary tree demo\n";
        cout << "  7) Quit\n";
        cout << "  Choice: ";
        string line;
        if (!getline(cin, line)) break;
        string choice = toUpperTrim(line);

        if (choice == "1") playLoop(theCase, 0, prefix);
        else if (choice == "2") guidedExperiment(theCase, prefix);
        else if (choice == "3") runExperiment(theCase, prefix);
        else if (choice == "4") runScalingExperiment(prefix);
        else if (choice == "5") runTreeAnalysis(theCase);
        else if (choice == "6") runPropertyDemo(theCase);
        else if (choice == "7" || choice == "Q") break;
        else cout << "Please type a number from 1 to 7.\n";
    }

    cout << "\nGoodbye, detective.\n";
    freeCase(theCase);
    return 0;
}
