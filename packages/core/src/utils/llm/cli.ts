#!/usr/bin/env node
/**
 * Unified CLI runner for LLM translation.
 *
 * Supports both `.mdoc` and `.csv` files. File format is auto-detected
 * from the extension and routed to the appropriate processor.
 *
 * Usage:
 *   npx tsx packages/core/src/utils/llm/cli.ts -g "*.mdoc" -l es de -i ./content/en/posts
 *   npx tsx packages/core/src/utils/llm/cli.ts -g "ai-solutions_en.csv" -l es pt -i ./content/ai-solutions
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

import { locales, defaultLocale, type Locale } from '@languages';
import { DEFAULT_OLLAMA_URL, DEFAULT_LLM_MODEL } from './translator.js';
import { processMarkdocDocument } from './processors/process-markdoc.js';
import { processCsvDocument } from './processors/process-csv.js';

// ============================================================
// CLI Definition & Types
// ============================================================

export interface CliOptions {
  debug: boolean;
  url: string;
  model: string;
  glob?: string;
  source: Locale;
  locales: Locale[];
  inputDir: string;
  columns?: string[];
  skipColumns?: string[];
}

export interface RunCliOptions {
  defaultInputDir?: string;
}

/** Supported file extensions and their corresponding processors. */
type FileProcessor = (
  inputPath: string,
  outputPath: string,
  sourceLang: Locale,
  targetLang: Locale,
  options: {
    ollamaUrl: string;
    llmModel: string;
    columnsToTranslate?: string[];
    skipColumns?: string[];
  },
) => Promise<void>;

const PROCESSORS: Record<string, FileProcessor> = {
  '.mdoc': processMarkdocDocument,
  '.csv': processCsvDocument,
};

function getProcessor(filePath: string): FileProcessor | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return PROCESSORS[ext];
}

// ============================================================
// Main Runner Function
// ============================================================

export async function runCli(argv: string[] = process.argv, overrides: RunCliOptions = {}): Promise<void> {
  const program = new Command();

  program
    .name('llm-translate')
    .description('Translate .mdoc and .csv files to all supported locales using a local LLM (Ollama).')
    .option('-d, --debug', 'enable debug logs', false)
    .option('--url <url>', 'Ollama API URL', DEFAULT_OLLAMA_URL)
    .option('-m, --model <model>', 'LLM model name', DEFAULT_LLM_MODEL)
    .option('-g, --glob <glob-pattern>', 'glob pattern or filename to match files (optional)')
    .option('-s, --source <source>', `source locale (default: "${defaultLocale}")`, defaultLocale)
    .option(
      '-l, --locales <locales...>',
      '(Optional) Specify target locales separated by spaces (e.g. "-l es de"). Unsupported locales will be ignored.',
      [...locales],
    )
    .option('-i, --input-dir <path>', 'source directory or file containing the files to translate', overrides.defaultInputDir ?? '.')
    .option('--columns <columns...>', 'specific columns to translate for CSV files (optional)')
    .option('--skip-columns <columns...>', 'additional columns to skip/exclude from translation for CSV files (optional)');

  program.parse(argv);

  const options = program.opts<CliOptions>();

  // Filter locales to only include those that are actually supported
  options.locales = options.locales.filter(locale => locales.includes(locale));

  if (options.debug) {
    console.log('🔍 Debug mode enabled');
  } else {
    console.debug = () => {}; // Disable debug logs if not in debug mode
  }

  console.debug('CLI Options:', options);

  // Use the original execution directory (or cwd as a fallback)
  // Note: INIT_CWD is set by npm/yarn when running scripts, but not when running directly with tsx.
  // This ensures that relative paths are resolved correctly regardless of how the script is invoked.
  // (e.g., when running it from the monorepo's root package.json scripts section,
  // INIT_CWD will point to the root, not the package,
  // making relative paths resolve from the root instead of this script's directory)
  const baseDir = process.env.INIT_CWD || process.cwd();
  const targetPath = path.resolve(baseDir, options.inputDir);

  let inputDir: string;
  let candidateFiles: string[];

  try {
    const stat = await fs.stat(targetPath);
    if (stat.isFile()) {
      inputDir = path.dirname(targetPath);
      candidateFiles = [path.basename(targetPath)];
    } else {
      inputDir = targetPath;
      candidateFiles = await fs.readdir(inputDir);
    }
  } catch (err) {
    console.error(`❌ Cannot access path: ${targetPath}`, err);
    return;
  }

  // Convert the glob pattern to a regex pattern (simple glob support)
  let globToRegex: RegExp | undefined;
  if (options.glob) {
    console.log(`🎯 Using glob pattern: ${options.glob}`);
    const escapedPattern = options.glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    globToRegex = new RegExp(`^${escapedPattern}$`, 'i');
  }

  // Filter to supported file types + apply glob
  const supportedExtensions = Object.keys(PROCESSORS);
  const matchedFiles = candidateFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    if (!supportedExtensions.includes(ext)) return false;
    if (globToRegex && !globToRegex.test(file)) return false;
    return true;
  });

  // Log the locales being processed
  console.log(`🌐 Translating from "${options.source}" to locales: [${options.locales.join(', ')}]`);
  console.log(`📄 Found ${matchedFiles.length} file${matchedFiles.length === 1 ? '' : 's'} to process.\n`);

  if (matchedFiles.length === 0) {
    console.warn('⚠️  No matching files found. Check your --input-dir and --glob options.');
    return;
  }

  const sharedOpts = {
    ollamaUrl: options.url,
    llmModel: options.model,
    columnsToTranslate: options.columns,
    skipColumns: options.skipColumns,
  };

  for (const filename of matchedFiles) {
    const inputFile = path.join(inputDir, filename);
    const processor = getProcessor(filename)!;

    for (const lang of options.locales) {
      // Prevent translating the base language into itself
      if (lang === options.source) continue;

      // Build the output path
      const outputFile = resolveOutputPath(inputFile, lang, options.source);

      await processor(inputFile, outputFile, options.source, lang, sharedOpts);
    }
  }
}

/**
 * Determine the output path for a translated file.
 *
 * - `.mdoc` files follow the directory-per-locale convention:
 *   `…/en/posts/file.mdoc` → `…/es/posts/file.mdoc`
 *
 * - `.csv` files follow the filename-suffix convention:
 *   `…/ai-solutions_en.csv` → `…/ai-solutions_es.csv`
 */
export function resolveOutputPath(inputFile: string, targetLocale: Locale, sourceLocale: Locale = defaultLocale): string {
  const ext = path.extname(inputFile).toLowerCase();

  if (ext === '.csv') {
    const dir = path.dirname(inputFile);
    const basename = path.basename(inputFile, ext);
    // Match trailing _<sourceLocale> (e.g., "ai-solutions_en")
    const localePattern = new RegExp(`_${sourceLocale}$`, 'i');
    const newBasename = localePattern.test(basename)
      ? basename.replace(localePattern, `_${targetLocale}`)
      : `${basename}_${targetLocale}`;
    return path.join(dir, `${newBasename}${ext}`);
  }

  // Default (.mdoc): replace the locale directory segment (handles both / and \)
  const sepPattern = new RegExp(`([/\\\\])${sourceLocale}([/\\\\])`);
  if (sepPattern.test(inputFile)) {
    return inputFile.replace(sepPattern, `$1${targetLocale}$2`);
  }

  // Fallback if no locale segment was found in the directory path:
  const dir = path.dirname(inputFile);
  const basename = path.basename(inputFile, ext);
  return path.join(dir, `${basename}_${targetLocale}${ext}`);
}

// ============================================================
// Auto-run if executed directly as a script
// ============================================================

const currentScript = process.argv[1];
if (
  currentScript &&
  (currentScript === fileURLToPath(import.meta.url) ||
    currentScript.endsWith('cli.ts') ||
    currentScript.endsWith('cli.js'))
) {
  runCli();
}
