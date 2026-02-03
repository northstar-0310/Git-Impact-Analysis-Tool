#!/usr/bin/env node

/**
 * CLI entry point for Test Impact Analyzer
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ImpactAnalyzer } from './analyzer/impactAnalyzer';
import { ImpactResult } from './types';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
    .name('test-impact-analyzer')
    .description('Analyze git commits to identify impacted Playwright tests')
    .version('1.0.0')
    .requiredOption('-c, --commit <sha>', 'Git commit SHA to analyze')
    .requiredOption('-r, --repo <path>', 'Path to the repository')
    .parse(process.argv);

const options = program.opts();

async function main() {
    const { commit, repo } = options;

    // Validate repository path
    const repoPath = path.resolve(repo);
    if (!fs.existsSync(repoPath)) {
        console.error(chalk.red(`Error: Repository path does not exist: ${repoPath}`));
        process.exit(1);
    }

    // Check if it's a git repository
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
        console.error(chalk.red(`Error: Not a git repository: ${repoPath}`));
        process.exit(1);
    }

    console.log(chalk.blue(`\n Analyzing commit: ${chalk.bold(commit)}`));
    console.log(chalk.gray(`Repository: ${repoPath}\n`));

    try {
        const analyzer = new ImpactAnalyzer(repoPath);
        const impacts = await analyzer.analyzeCommit(commit);

        if (impacts.length === 0) {
            console.log(chalk.yellow('No test impacts found for this commit.'));
            return;
        }

        // Group impacts by type
        const added = impacts.filter(i => i.impactType === 'added');
        const removed = impacts.filter(i => i.impactType === 'removed');
        const modified = impacts.filter(i => i.impactType === 'modified');

        // Display results
        displayImpacts('Added', added, 'green', '✅');
        displayImpacts('Removed', removed, 'red', '❌');
        displayImpacts('Modified', modified, 'yellow', '⚠️');

        // Summary
        console.log(chalk.bold(`\n Summary:`));
        console.log(`   Total impacts: ${chalk.bold(impacts.length)}`);
        console.log(`   Added: ${chalk.green(added.length)}`);
        console.log(`   Removed: ${chalk.red(removed.length)}`);
        console.log(`   Modified: ${chalk.yellow(modified.length)}`);

        const indirectCount = impacts.filter(i => i.isIndirect).length;
        if (indirectCount > 0) {
            console.log(`   Indirect (via helpers): ${chalk.cyan(indirectCount)}\n`);
        } else {
            console.log('');
        }

    } catch (error) {
        console.error(chalk.red(`\n Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
}

function displayImpacts(
    title: string,
    impacts: ImpactResult[],
    color: 'green' | 'red' | 'yellow',
    icon: string
) {
    if (impacts.length === 0) return;

    console.log(chalk.bold(`\n${icon} ${title} Tests (${impacts.length}):`));

    // Create a type-safe color map
    const colorMap = {
        green: chalk.green,
        red: chalk.red,
        yellow: chalk.yellow
    };

    for (const impact of impacts) {
        const indirect = impact.isIndirect ? chalk.cyan(' (indirect)') : '';
        console.log(
            colorMap[color](`   • "${impact.testName}"`) +
            chalk.gray(` in ${impact.filePath}`) +
            indirect
        );
    }
}

main().catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
});
