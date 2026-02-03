/**
 * Git operations module for analyzing commits and diffs
 */

import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import * as path from 'path';
import { ChangedFile, FileChange, Hunk } from '../types';

export class GitOperations {
    private git: SimpleGit;
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
        this.git = simpleGit(repoPath);
    }

    /**
     * Get the diff for a specific commit
     */
    async getCommitDiff(commitSha: string): Promise<string> {
        try {
            // Get diff between commit and its parent
            const diff = await this.git.show([
                commitSha,
                '--unified=0', // No context lines
                '--no-prefix', // Remove a/ b/ prefixes
            ]);
            return diff;
        } catch (error) {
            throw new Error(`Failed to get diff for commit ${commitSha}: ${error}`);
        }
    }

    /**
     * Get changed files with their modification types and line ranges
     */
    async getChangedFiles(commitSha: string): Promise<ChangedFile[]> {
        const diff = await this.getCommitDiff(commitSha);
        return this.parseDiff(diff);
    }

    /**
     * Get file content at a specific commit
     */
    async getFileAtCommit(commitSha: string, filePath: string): Promise<string | null> {
        try {
            const content = await this.git.show([`${commitSha}:${filePath}`]);
            return content;
        } catch (error) {
            // File doesn't exist at this commit
            return null;
        }
    }

    /**
     * Get file content before a commit (parent commit)
     */
    async getFileBeforeCommit(commitSha: string, filePath: string): Promise<string | null> {
        try {
            const content = await this.git.show([`${commitSha}^:${filePath}`]);
            return content;
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse unified diff output to extract changed files and line ranges
     */
    private parseDiff(diff: string): ChangedFile[] {
        const changedFiles: ChangedFile[] = [];
        const lines = diff.split('\n');

        let currentFile: string | null = null;
        let changeType: 'added' | 'modified' | 'deleted' = 'modified';
        let addedLines: number[] = [];
        let deletedLines: number[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // New file header
            if (line.startsWith('diff --git')) {
                // Save previous file if exists
                if (currentFile) {
                    changedFiles.push({
                        path: currentFile,
                        changeType,
                        addedLines: [...addedLines],
                        deletedLines: [...deletedLines],
                    });
                }

                // Reset for new file
                addedLines = [];
                deletedLines = [];
                changeType = 'modified';
                currentFile = null;
            }

            // File path (--- and +++ lines)
            if (line.startsWith('---')) {
                const match = line.match(/^---\s+(.+)$/);
                if (match && match[1] !== '/dev/null') {
                    currentFile = match[1];
                } else if (match && match[1] === '/dev/null') {
                    changeType = 'added';
                }
            }

            if (line.startsWith('+++')) {
                const match = line.match(/^\+\+\+\s+(.+)$/);
                if (match && match[1] !== '/dev/null') {
                    currentFile = match[1];
                } else if (match && match[1] === '/dev/null') {
                    changeType = 'deleted';
                }
            }

            // Hunk header: @@ -old_start,old_count +new_start,new_count @@
            if (line.startsWith('@@')) {
                const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
                if (hunkMatch) {
                    const oldStart = parseInt(hunkMatch[1]);
                    const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
                    const newStart = parseInt(hunkMatch[3]);
                    const newCount = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;

                    // Track deleted lines
                    for (let j = 0; j < oldCount; j++) {
                        deletedLines.push(oldStart + j);
                    }

                    // Track added lines
                    for (let j = 0; j < newCount; j++) {
                        addedLines.push(newStart + j);
                    }
                }
            }
        }

        // Save last file
        if (currentFile) {
            changedFiles.push({
                path: currentFile,
                changeType,
                addedLines: [...addedLines],
                deletedLines: [...deletedLines],
            });
        }

        return changedFiles;
    }

    /**
     * Check if a file exists in the repository
     */
    async fileExists(filePath: string): Promise<boolean> {
        try {
            const fs = await import('fs').then(m => m.promises);
            await fs.access(path.join(this.repoPath, filePath));
            return true;
        } catch {
            return false;
        }
    }
}
