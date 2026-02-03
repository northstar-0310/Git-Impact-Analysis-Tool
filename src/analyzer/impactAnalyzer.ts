/**
 * Main impact analyzer - orchestrates the analysis
 */

import { GitOperations } from '../git/operations';
import { TestParser } from '../parser/testParser';
import { ImportTracker } from '../parser/importTracker';
import { ImpactResult, ChangedFile } from '../types';
import * as path from 'path';

export class ImpactAnalyzer {
    private gitOps: GitOperations;
    private testParser: TestParser;
    private importTracker: ImportTracker;
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
        this.gitOps = new GitOperations(repoPath);
        this.testParser = new TestParser();
        this.importTracker = new ImportTracker(repoPath);
    }

    /**
     * Main analysis method
     */
    async analyzeCommit(commitSha: string): Promise<ImpactResult[]> {
        const impacts: ImpactResult[] = [];

        // Get all changed files
        const changedFiles = await this.gitOps.getChangedFiles(commitSha);

        // Separate test files from helper files
        const testFiles = changedFiles.filter(f => this.isTestFile(f.path));
        const helperFiles = changedFiles.filter(f => !this.isTestFile(f.path) && f.path.endsWith('.ts'));

        // Analyze direct impacts (test files changed)
        for (const testFile of testFiles) {
            const directImpacts = await this.analyzeTestFile(testFile, commitSha);
            impacts.push(...directImpacts);
        }

        // Analyze indirect impacts (helper files changed)
        for (const helperFile of helperFiles) {
            const indirectImpacts = await this.analyzeHelperFile(helperFile);
            impacts.push(...indirectImpacts);
        }

        return impacts;
    }

    /**
     * Analyze a changed test file
     */
    private async analyzeTestFile(changedFile: ChangedFile, commitSha: string): Promise<ImpactResult[]> {
        const impacts: ImpactResult[] = [];
        const filePath = path.join(this.repoPath, changedFile.path);

        if (changedFile.changeType === 'added') {
            // New file - all tests are added
            const currentContent = await this.gitOps.getFileAtCommit(commitSha, changedFile.path);
            if (currentContent) {
                const tests = await this.testParser.parseTestFile(filePath, currentContent);
                for (const test of tests) {
                    impacts.push({
                        testName: test.name,
                        filePath: changedFile.path,
                        impactType: 'added',
                    });
                }
            }
        } else if (changedFile.changeType === 'deleted') {
            // File deleted - all tests are removed
            const beforeContent = await this.gitOps.getFileBeforeCommit(commitSha, changedFile.path);
            if (beforeContent) {
                const tests = await this.testParser.parseTestFile(filePath, beforeContent);
                for (const test of tests) {
                    impacts.push({
                        testName: test.name,
                        filePath: changedFile.path,
                        impactType: 'removed',
                    });
                }
            }
        } else {
            // Modified file - need to check what changed
            const beforeContent = await this.gitOps.getFileBeforeCommit(commitSha, changedFile.path);
            const currentContent = await this.gitOps.getFileAtCommit(commitSha, changedFile.path);

            if (beforeContent && currentContent) {
                const beforeTests = await this.testParser.parseTestFile(filePath, beforeContent);
                const currentTests = await this.testParser.parseTestFile(filePath, currentContent);

                // Find added tests
                for (const test of currentTests) {
                    const existedBefore = beforeTests.some(bt => bt.name === test.name);
                    if (!existedBefore) {
                        // Check if the test is in the added lines
                        const isInAddedLines = this.testParser.hasOverlap(
                            changedFile.addedLines,
                            test.startLine,
                            test.endLine
                        );

                        if (isInAddedLines || !existedBefore) {
                            impacts.push({
                                testName: test.name,
                                filePath: changedFile.path,
                                impactType: 'added',
                            });
                        }
                    }
                }

                // Find removed tests
                for (const test of beforeTests) {
                    const existsNow = currentTests.some(ct => ct.name === test.name);
                    if (!existsNow) {
                        impacts.push({
                            testName: test.name,
                            filePath: changedFile.path,
                            impactType: 'removed',
                        });
                    }
                }

                // Find modified tests
                for (const test of currentTests) {
                    const beforeTest = beforeTests.find(bt => bt.name === test.name);

                    if (beforeTest) {
                        // Test existed before - check if it was modified
                        const hasChangesInTest = this.testParser.hasOverlap(
                            changedFile.addedLines,
                            test.startLine,
                            test.endLine
                        );

                        if (hasChangesInTest) {
                            // Only add if not already marked as added
                            const alreadyAdded = impacts.some(
                                i => i.testName === test.name && i.impactType === 'added'
                            );

                            if (!alreadyAdded) {
                                impacts.push({
                                    testName: test.name,
                                    filePath: changedFile.path,
                                    impactType: 'modified',
                                });
                            }
                        }
                    }
                }
            }
        }

        return impacts;
    }

    /**
     * Analyze impacts from a changed helper file
     */
    private async analyzeHelperFile(changedFile: ChangedFile): Promise<ImpactResult[]> {
        const impacts: ImpactResult[] = [];

        // Find all test files that import this helper
        const importingTestFiles = await this.importTracker.findTestFilesImporting(
            path.join(this.repoPath, changedFile.path)
        );

        // Get all tests from those files
        for (const testFilePath of importingTestFiles) {
            const tests = await this.testParser.parseTestFile(testFilePath);

            // Get relative path from repo root
            const relativePath = path.relative(this.repoPath, testFilePath);

            for (const test of tests) {
                impacts.push({
                    testName: test.name,
                    filePath: relativePath,
                    impactType: 'modified',
                    isIndirect: true,
                });
            }
        }

        return impacts;
    }

    /**
     * Check if a file is a test file
     */
    private isTestFile(filePath: string): boolean {
        return filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts');
    }
}
