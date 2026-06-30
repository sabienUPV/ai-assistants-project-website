import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc from '@markdoc/markdoc';
import { performance } from 'node:perf_hooks'; // Native Node module for precise timing

import { localeEnglishNames, type Locale } from '@languages';
import { PROJECT_NAME } from '@constants';

// LLM Engine Configuration
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const LLM_MODEL = 'llama3.2:1b'; // Can be swapped with 'ministral-3:3b' or any other model available in your local Ollama instance

// Keys in the YAML frontmatter that should be translated
const keysToTranslate = ['title', 'description'];

// Maximum length of snippets to log for translation feedback
//const MAX_SNIPPET_LENGTH = 20;
const MAX_SNIPPET_LENGTH = -1; // Set to -1 to disable snippet truncation in logs

/**
 * Core function to parse, translate, and rebuild the .mdoc file
 */
export async function processDocument(inputPath: string, outputPath: string, sourceLang: Locale, targetLang: Locale) {
  const fileStart = performance.now();
  console.log(`\n📄 Processing: ${path.basename(inputPath)} -> Target: ${targetLang.toUpperCase()} (${localeEnglishNames[targetLang]})`);
  
  // 1. Read the original file
  const rawFile = await fs.readFile(inputPath, 'utf-8');

  // 2. Separate YAML Frontmatter from the Markdoc body
  const { data: frontmatter, content: mdocContent } = matter(rawFile);

  // 3. Translate specific Frontmatter values
  console.log('🔄 Translating YAML Frontmatter...');
  const translatedFrontmatter = { ...frontmatter };
  
  for (const key of keysToTranslate) {
    if (translatedFrontmatter[key]) {
      translatedFrontmatter[key] = await translateText(translatedFrontmatter[key], sourceLang, targetLang);
    }
  }

  // 4. Parse the body into an Abstract Syntax Tree (AST)
  console.log('🌳 Generating Markdoc AST...');
  const ast = Markdoc.parse(mdocContent);

  // 5. Walk the AST and mutate ONLY the text nodes
  console.log('🤖 Sending text nodes to local LLM...');
  
  // ast.walk() is a generator that yields every node in the tree
  for (const node of ast.walk()) {
    // We strictly target text nodes to prevent the LLM from breaking tags or markup
    if (node.type === 'text' && typeof node.attributes.content === 'string') {
      const originalText = node.attributes.content;
      
      // Avoid API calls for standalone punctuation or spacing
      if (originalText.trim().length > 1) {
        const translatedText = await translateText(originalText, sourceLang, targetLang);
        // Mutate the node in place
        node.attributes.content = translatedText;
      }
    }
  }

  // 5.5 Fix Date objects formatting
  // gray-matter parses standard dates into JS Date objects, which stringify to full ISO strings.
  // We manually convert any Date objects back to 'YYYY-MM-DD' strings.
  for (const key in translatedFrontmatter) {
    if (translatedFrontmatter[key] instanceof Date) {
      translatedFrontmatter[key] = (translatedFrontmatter[key] as Date).toISOString().split('T')[0];
    }
  }

  // 6. Rebuild (Unparse) the document
  console.log('🏗️ Rebuilding the document...');
  // Markdoc.format() converts the mutated AST back to a markdown string
  const translatedMdocContent = Markdoc.format(ast);

  // Re-attach the translated YAML Frontmatter to the top
  const finalFileContent = matter.stringify(translatedMdocContent, translatedFrontmatter);

  // 7. Save the output file to the localized directory
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, finalFileContent, 'utf-8');
  
  const fileEnd = performance.now();
  const fileDuration = ((fileEnd - fileStart) / 1000).toFixed(2);
  console.log(`✅ File successfully saved to: ${outputPath} (Total time: ${fileDuration}s)`);
}

/**
 * Calls the local Ollama API to translate plain text nodes.
 */
export async function translateText(text: string, sourceLang: Locale, targetLang: Locale): Promise<string> {
  // Capture leading and trailing whitespace to preserve formatting after translation
  const leadingSpace = text.match(/^\s*/)?.[0] || '';
  const trailingSpace = text.match(/\s*$/)?.[0] || '';
  
  // Trim the text for processing, but we'll reattach whitespace later
  const coreText = text.trim();

  // Ignore empty strings, whitespace, or single line breaks
  if (!coreText) return text;

  // Start the high-resolution stopwatch
  const startTime = performance.now();

  // Use a URL regex to find and temporarily replace URLs in the text to prevent them from being altered during translation
  const urlRegex = /(https?:\/\/[^\s)\]"']+)/g;
  const urls: string[] = [];
  
  const protectedText = coreText.replace(urlRegex, (match) => {
    urls.push(match);
    // Note: We use a purely alphanumeric placeholder to avoid any special characters that might confuse the LLM. The index ensures uniqueness for multiple URLs.
    return `URLPLACEHOLDER${urls.length - 1}X`; // Turns into URLPLACEHOLDER0X, URLPLACEHOLDER1X, etc.
  });

  let promptRules = `CRITICAL RULES:
1. DO NOT translate proper nouns, acronyms, or project names (e.g., "${PROJECT_NAME}"). Keep them exactly as they appear.
2. Return ONLY plain text. Do not add asterisks (*), bolding, quotes, or any markdown syntax.`;

  // Add the placeholder rule ONLY if there are URLs in this fragment
  if (urls.length > 0) {
    promptRules += `\n3. Keep placeholders like URLPLACEHOLDER0X exactly as they are.`;
  }

  const prompt = `You are an expert technical translator. Translate the text from ${localeEnglishNames[sourceLang]} to ${localeEnglishNames[targetLang]}.

${promptRules}

Original text:
${protectedText}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.2, // Lower temperature for more deterministic translations
      }),
    });

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response from Ollama API');
    }

    let translatedText = data.response.trim();

    // Restore the original URLs back into the translated text
    urls.forEach((url, index) => {
      translatedText = translatedText.replace(`URLPLACEHOLDER${index}X`, url);
    });

    // Stop the stopwatch and calculate elapsed seconds
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const textSnippet = MAX_SNIPPET_LENGTH > 0 && coreText.length > MAX_SNIPPET_LENGTH ? `${coreText.substring(0, MAX_SNIPPET_LENGTH)}...` : coreText;
    const translatedSnippet = MAX_SNIPPET_LENGTH > 0 && translatedText.length > MAX_SNIPPET_LENGTH ? `${translatedText.substring(0, MAX_SNIPPET_LENGTH)}...` : translatedText;

    console.log(`   🔹 [${duration}s] Translated: "${textSnippet}" -> "${translatedSnippet}"`);
    
    if (leadingSpace) console.log(`Added back leading whitespace: "${leadingSpace}" (length: ${leadingSpace.length})`);
    if (trailingSpace) console.log(`Added back trailing whitespace: "${trailingSpace}" (length: ${trailingSpace.length})`);
    
    // Return the translated text with the original leading and trailing whitespace preserved
    return `${leadingSpace}${translatedText}${trailingSpace}`;
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const textSnippet = MAX_SNIPPET_LENGTH > 0 && coreText.length > MAX_SNIPPET_LENGTH ? `${coreText.substring(0, MAX_SNIPPET_LENGTH)}...` : coreText;
    console.error(`❌ [${duration}s] Ollama translation error for: "${textSnippet}"`, error);
    return text; // Fallback: return original text if the request fails (it already includes original whitespace)
  }
}