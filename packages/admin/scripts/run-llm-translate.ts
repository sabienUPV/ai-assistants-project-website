import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // Required to convert URL to path
import { processDocument } from '@utils/llm-translate.js';
import { locales, defaultLocale } from '@languages';

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
      
      await processDocument(inputFile, outputFile, defaultLocale, lang);
    }
  }
};

run();