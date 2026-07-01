import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // Required to convert URL to path
import { DEFAULT_LLM_MODEL, DEFAULT_OLLAMA_URL, processDocument } from '@utils/llm-translate.js';
import { locales, defaultLocale } from '@languages';
import { Command } from 'commander';

const program = new Command();

interface CliOptions {
  debug: boolean;
  url: string;
  model: string;
  context: boolean; // Commander is smart enough to invert the boolean value of --no-context automatically and store it in this property as 'context'
}

program
  .name('llm-translate')
  .description('Translate all .mdoc files in the posts directory to all supported locales using LLM.')
  .option('-d, --debug', 'enable debug logs', false)
  .option('--url <url>', 'ollama api url', DEFAULT_OLLAMA_URL)
  .option('-m, --model <model>', 'llm model name', DEFAULT_LLM_MODEL)
  .option('--no-context', 'disable sliding window context', true) // Default is true, because Commander understands that it's the default value of the inverted "context" property, so --no-context will be false. This means that by default, the sliding window context is ENABLED.

program.parse(process.argv);

const options = program.opts<CliOptions>();

if (options.debug) {
  console.log('🔍 Debug mode enabled');
}
else {
  console.debug = () => {}; // Disable debug logs if not in debug mode
}

console.debug('CLI Options:', options);

// Get the directory name of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// SCRIPT EXECUTION
// ==========================================
const run = async () => {
  // Resolve relative to the current script's location
  // to the posts directory in the default locale
  const postsDir = path.resolve(__dirname, '..', 'src', 'content', defaultLocale, 'posts');
  
  // Read the directory using native Node.js fs module
  const files = await fs.readdir(postsDir);
  
  // Filter the results to keep only the .mdoc files
  const mdocFiles = files.filter(file => file.endsWith('.mdoc'));

  for (const filename of mdocFiles) {
    const inputFile = path.join(postsDir, filename);

    for (const lang of locales) {
      // Prevent translating the base language into itself and overwriting the original file
      if (lang === defaultLocale) continue; 

      // Replace the locale segment in the file path (e.g., /en/ -> /es/)
      // using the OS-specific path separator (path.sep) to ensure cross-platform compatibility
      const outputFile = inputFile.replace(
        `${path.sep}${defaultLocale}${path.sep}`, 
        `${path.sep}${lang}${path.sep}`
      );
      
      await processDocument(inputFile, outputFile, defaultLocale, lang, options.url, options.model, options.context);
    }
  }
};

run();