# Git Impact Analysis Tool

A CLI tool that analyzes git commits in Playwright test repositories to identify all impacted tests. Built with Node.js and TypeScript.

## Features

- ✅ **Direct Impact Detection**: Identifies tests that were directly added, removed, or modified
- 🔗 **Indirect Impact Detection**: Finds tests affected by changes to helper methods and page objects
- 📊 **Clear Output**: Color-coded results with detailed test names and file paths
- 🚀 **Fast Analysis**: Uses TypeScript AST parsing for accurate code analysis
- 🎯 **Precise Line Tracking**: Detects exactly which tests overlap with changed code

## Installation

```bash
# Clone or download this repository
cd git-impact-analysis-tool

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Basic Command

```bash
node dist/cli.js --commit <commit-sha> --repo <path-to-repo>
```

### Using with npx (after publishing)

```bash
npx git-impact-analysis-tool --commit <commit-sha> --repo <path-to-repo>
```

### Options

- `-c, --commit <sha>` (required): Git commit SHA to analyze
- `-r, --repo <path>` (required): Path to the repository to analyze
- `-V, --version`: Display version information
- `-h, --help`: Display help information

## Examples

### Example 1: Detecting Added Tests

```bash
node dist/cli.js --commit 75cdcc5 --repo ./flash-tests
```

**Output:**
```
🔍 Analyzing commit: 75cdcc5
Repository: /path/to/flash-tests

✅ Added Tests (1):
   • "safeBash tool execution to get commit SHA" in tests/tool-execution/session.spec.ts

📊 Summary:
   Total impacts: 1
   Added: 1
   Removed: 0
   Modified: 0
```

### Example 2: Detecting Modified Tests

```bash
node dist/cli.js --commit 5df7e4d --repo ./flash-tests
```

**Output:**
```
🔍 Analyzing commit: 5df7e4d
Repository: /path/to/flash-tests

📝 Modified Tests (2):
   • "Subscribe to session and verify in Subscribed sessions list" in tests/sessions.spec.ts
   • "Filter sessions list by users" in tests/sessions.spec.ts

📊 Summary:
   Total impacts: 2
   Added: 0
   Removed: 0
   Modified: 2
```

### Example 3: Detecting Removed Tests

```bash
node dist/cli.js --commit 6d8159d --repo ./flash-tests
```

**Output:**
```
🔍 Analyzing commit: 6d8159d
Repository: /path/to/flash-tests

❌ Removed Tests (1):
   • "Sort sessions by title" in tests/sessions.spec.ts

📊 Summary:
   Total impacts: 1
   Added: 0
   Removed: 1
   Modified: 0
```

### Example 4: Detecting Indirect Impacts (Helper Changes)

```bash
node dist/cli.js --commit 45433fd --repo ./flash-tests
```

**Output:**
```
🔍 Analyzing commit: 45433fd
Repository: /path/to/flash-tests

📝 Modified Tests (36):
   • "trigger a new test run and monitor through completion" in tests/test-runs.spec.ts (indirect)
   • "create and cancel a test run" in tests/test-runs.spec.ts (indirect)
   ... (32 more tests)

📊 Summary:
   Total impacts: 36
   Added: 0
   Removed: 0
   Modified: 36
   Indirect (via helpers): 36
```

## How It Works

The tool uses a multi-step process to analyze commit impacts:

### 1. Git Diff Analysis
- Retrieves the diff for the specified commit
- Parses changed files and identifies added/modified/deleted line ranges
- Separates test files (*.spec.ts) from helper files

### 2. TypeScript AST Parsing
- Uses `ts-morph` to parse TypeScript test files
- Extracts all `test()` and `test.describe()` blocks
- Records test names and their line number ranges

### 3. Direct Impact Detection
- **Added Tests**: Compares file versions, identifies new test blocks
- **Removed Tests**: Finds tests present in the old version but not in the new
- **Modified Tests**: Checks if changed line ranges overlap with test block ranges

### 4. Indirect Impact Detection
- Identifies changed files that are not test files (helpers, page objects)
- Analyzes import statements to find which test files use these helpers
- Marks all tests in importing files as indirectly impacted

### 5. Output Formatting
- Groups impacts by type (added, removed, modified)
- Color-codes results for easy reading
- Displays summary statistics

## Architecture

```
src/
├── cli.ts                      # CLI entry point and output formatting
├── types/                      # TypeScript type definitions
│   └── index.ts
├── git/                        # Git operations
│   └── operations.ts           # Commit diff retrieval and parsing
├── parser/                     # Code analysis
│   ├── testParser.ts           # Test extraction using AST
│   └── importTracker.ts        # Import dependency analysis
└── analyzer/                   # Impact analysis
    └── impactAnalyzer.ts       # Main orchestration logic
```

## Requirements

- **Node.js**: v16 or higher
- **Git**: The repository must be a valid git repository
- **TypeScript/Playwright**: Designed for TypeScript-based Playwright test suites

## Development

### Build

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev -- --commit <sha> --repo <path>
```

## Limitations & Known Issues

1. **TypeScript Only**: Currently only supports TypeScript test files (*.spec.ts)
2. **Playwright Focus**: Optimized for Playwright test structure
3. **Import Resolution**: Relative imports are resolved; module imports are not fully supported
4. **Test.describe Blocks**: Describe blocks are also reported when their content changes

## Future Enhancements

- Support for JavaScript test files
- More sophisticated import resolution
- Filter to exclude describe blocks from output
- Support for other test frameworks (Jest, Mocha)
- Performance optimizations for very large repositories

## Testing with Flash-Tests

To test with the flash-tests repository mentioned in the assignment:

```bash
# Clone the repository
git clone https://github.com/empirical-run/flash-tests.git

# Test with specific commits
node dist/cli.js --commit 75cdcc5 --repo ./flash-tests
node dist/cli.js --commit 5df7e4d --repo ./flash-tests
node dist/cli.js --commit 6d8159d --repo ./flash-tests
node dist/cli.js --commit 45433fd --repo ./flash-tests
```

## License

MIT

## Author

Built for the Empirical AI Engineer assignment
