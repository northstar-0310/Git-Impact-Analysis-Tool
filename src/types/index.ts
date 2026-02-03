/**
 * Type definitions for the Test Impact Analyzer
 */

export interface TestInfo {
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
}

export type ImpactType = 'added' | 'removed' | 'modified';

export interface ImpactResult {
    testName: string;
    filePath: string;
    impactType: ImpactType;
    isIndirect?: boolean; // true if impact is from helper method changes
}

export interface ChangedFile {
    path: string;
    changeType: 'added' | 'modified' | 'deleted';
    addedLines: number[];
    deletedLines: number[];
}

export interface DiffInfo {
    changedFiles: ChangedFile[];
    commit: string;
}

export interface FileChange {
    file: string;
    hunks: Hunk[];
}

export interface Hunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
}
