/**
 * Test file parser using TypeScript AST
 */

import { Project, SyntaxKind, Node, CallExpression, SourceFile } from 'ts-morph';
import { TestInfo } from '../types';
import * as path from 'path';

export class TestParser {
    private project: Project;

    constructor() {
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
        });
    }

    /**
     * Parse a test file and extract all test definitions
     */
    async parseTestFile(filePath: string, content?: string): Promise<TestInfo[]> {
        let sourceFile: SourceFile;

        if (content) {
            // Parse from content string (for historical versions)
            sourceFile = this.project.createSourceFile(`temp_${Date.now()}.ts`, content, { overwrite: true });
        } else {
            // Parse from file system
            sourceFile = this.project.addSourceFileAtPath(filePath);
        }

        const tests = this.extractTests(sourceFile, filePath);

        // Clean up temporary source file
        if (content) {
            sourceFile.forget();
        }

        return tests;
    }

    /**
     * Extract test definitions from AST
     */
    private extractTests(sourceFile: SourceFile, filePath: string): TestInfo[] {
        const tests: TestInfo[] = [];

        // Find all call expressions
        const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

        for (const callExpr of callExpressions) {
            const expression = callExpr.getExpression();
            const expressionText = expression.getText();

            // Look for test() or test.skip() or test.only() calls
            if (this.isTestCall(expressionText)) {
                const testInfo = this.extractTestInfo(callExpr, filePath);
                if (testInfo) {
                    tests.push(testInfo);
                }
            }
        }

        return tests;
    }

    /**
     * Check if a call expression is a test definition
     */
    private isTestCall(expressionText: string): boolean {
        return (
            expressionText === 'test' ||
            expressionText === 'test.skip' ||
            expressionText === 'test.only' ||
            expressionText === 'test.describe' ||
            expressionText === 'test.fixme'
        );
    }

    /**
     * Extract test information from a call expression
     */
    private extractTestInfo(callExpr: CallExpression, filePath: string): TestInfo | null {
        const args = callExpr.getArguments();

        if (args.length < 2) {
            return null;
        }

        // First argument should be the test name (string literal)
        const nameArg = args[0];
        let testName: string;

        if (Node.isStringLiteral(nameArg)) {
            testName = nameArg.getLiteralValue();
        } else {
            // Template literal or other expression
            testName = nameArg.getText().replace(/['"]/g, '');
        }

        // Get the function body (second argument)
        const functionArg = args[1];

        // Get line range for the entire test block
        const startLine = callExpr.getStartLineNumber();
        const endLine = callExpr.getEndLineNumber();

        return {
            name: testName,
            filePath,
            startLine,
            endLine,
        };
    }

    /**
     * Check if line ranges overlap
     */
    isLineInRange(line: number, startLine: number, endLine: number): boolean {
        return line >= startLine && line <= endLine;
    }

    /**
     * Check if any lines in a set overlap with a range
     */
    hasOverlap(lines: number[], startLine: number, endLine: number): boolean {
        return lines.some(line => this.isLineInRange(line, startLine, endLine));
    }
}
