/**
 * Import tracker for finding dependencies and usages
 */

import { Project, SyntaxKind, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

export class ImportTracker {
    private project: Project;
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
        });
    }

    /**
     * Find all test files that import a given helper file
     */
    async findTestFilesImporting(helperPath: string): Promise<string[]> {
        const testFiles: string[] = [];
        const specFiles = await this.findAllSpecFiles();

        for (const specFile of specFiles) {
            const imports = await this.extractImports(specFile);

            // Normalize paths for comparison
            const normalizedHelperPath = this.normalizePath(helperPath);

            for (const importPath of imports) {
                const resolvedImport = this.resolveImportPath(specFile, importPath);
                const normalizedImport = this.normalizePath(resolvedImport);

                if (normalizedImport === normalizedHelperPath) {
                    testFiles.push(specFile);
                    break;
                }
            }
        }

        return testFiles;
    }

    /**
     * Extract all import paths from a TypeScript file
     */
    private async extractImports(filePath: string): Promise<string[]> {
        const imports: string[] = [];

        try {
            const sourceFile = this.project.addSourceFileAtPath(filePath);

            // Get import declarations
            const importDeclarations = sourceFile.getImportDeclarations();

            for (const importDecl of importDeclarations) {
                const moduleSpecifier = importDecl.getModuleSpecifierValue();
                imports.push(moduleSpecifier);
            }

            sourceFile.forget();
        } catch (error) {
            // Ignore files that can't be parsed
        }

        return imports;
    }

    /**
     * Find all .spec.ts files in the repository
     */
    private async findAllSpecFiles(): Promise<string[]> {
        const specFiles: string[] = [];

        const findFiles = (dir: string) => {
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Skip node_modules and hidden directories
                    if (!file.startsWith('.') && file !== 'node_modules') {
                        findFiles(fullPath);
                    }
                } else if (file.endsWith('.spec.ts')) {
                    specFiles.push(fullPath);
                }
            }
        };

        findFiles(this.repoPath);
        return specFiles;
    }

    /**
     * Resolve a relative import path to an absolute path
     */
    private resolveImportPath(fromFile: string, importPath: string): string {
        if (importPath.startsWith('.')) {
            // Relative import
            const fromDir = path.dirname(fromFile);
            let resolved = path.resolve(fromDir, importPath);

            // Try adding .ts extension if file doesn't exist
            if (!fs.existsSync(resolved)) {
                if (fs.existsSync(resolved + '.ts')) {
                    resolved = resolved + '.ts';
                } else if (fs.existsSync(path.join(resolved, 'index.ts'))) {
                    resolved = path.join(resolved, 'index.ts');
                }
            }

            return resolved;
        }

        // Absolute or module import - not handled for now
        return importPath;
    }

    /**
     * Normalize path for comparison
     */
    private normalizePath(filePath: string): string {
        return path.resolve(this.repoPath, filePath);
    }
}
