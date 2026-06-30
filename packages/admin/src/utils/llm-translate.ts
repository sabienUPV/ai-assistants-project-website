import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc from '@markdoc/markdoc';
import { performance } from 'node:perf_hooks'; // Native Node module for precise timing

import { localeEnglishNames, type Locale } from '@languages';

// LLM Engine Configuration
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const LLM_MODEL = 'ministral-3:3b'; // Can be swapped with 'llama3.2:1b' or any other model available in your local Ollama instance

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
  const keysToTranslate = ['title', 'description'];
  
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
  // Ignore empty strings, whitespace, or single line breaks
  if (!text.trim()) return text;

  // Start the high-resolution stopwatch
  const startTime = performance.now();

  const prompt = `You are an expert technical translator. Translate the following text from ${localeEnglishNames[sourceLang]} to ${localeEnglishNames[targetLang]}. 
Return ONLY the translation, without any markdown formatting, quotes, or introductory text.
Original text: ${text}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        prompt: prompt,
        stream: false,
      }),
    });

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response from Ollama API');
    }

    // Stop the stopwatch and calculate elapsed seconds
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const translatedText = data.response.trim();
    console.log(`   🔹 [${duration}s] Translated: "${text.substring(0, 20)}..." -> "${translatedText.substring(0, 20)}..."`);
    return translatedText;
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const textSnippet = text.length > 20 ? `${text.substring(0, 20)}...` : text;
    console.error(`❌ [${duration}s] Ollama translation error for: "${textSnippet}"`, error);
    return text; // Fallback: return original text if the request fails
  }
}