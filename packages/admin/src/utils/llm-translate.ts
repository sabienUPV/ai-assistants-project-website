import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc from '@markdoc/markdoc';
import { performance } from 'node:perf_hooks'; // Native Node module for precise timing

import { localeEnglishNames, type Locale } from '@languages';
import { PROJECT_NAME } from '@constants';

// LLM Engine Configuration
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_GENERATE_ENDPOINT = '/api/generate';
export const DEFAULT_LLM_MODEL = 'ministral-3:3b'; // Can be swapped with 'llama3.2:1b' or any other model available in your local Ollama instance

// Keys in the YAML frontmatter that should be translated
const keysToTranslate = ['title', 'description'];

// Maximum length of snippets to log for translation feedback
//const MAX_SNIPPET_LENGTH = 20;
const MAX_SNIPPET_LENGTH = -1; // Set to -1 to disable snippet truncation in logs

// Protected patterns include URLs, hashtags, and mentions. These will be ignored by the LLM translation process.
// Note: We use \p{L} and \p{N}, combined with the 'u' flag, to ensure that we capture letters and numbers from any language, including accented characters and special letters like 'ñ'.
const PROTECTED_PATTERNS = [
  /(https?:\/\/[^\s)\]"']+)/g, // URLs
  /(#[\p{L}\p{N}_]+)/gu,        // Hashtags (e.g. #AIforGood, #Inclusion)
  /(@[\p{L}\p{N}_]+)/gu,         // Mentions (e.g. @HURT)
  /([\p{L}\p{N}._-]+@[\p{L}\p{N}._-]+\.[\p{L}\p{N}_-]+)/gu // Email addresses
];

/**
 * Core function to parse, translate, and rebuild the .mdoc file
 */
export async function processDocument(inputPath: string, outputPath: string, sourceLang: Locale, targetLang: Locale,
  ollama_url: string = DEFAULT_OLLAMA_URL, llm_model: string = DEFAULT_LLM_MODEL, useSlidingContext: boolean = true) : Promise<void> {
  // Log URL and model being used for translation
  console.log(`🌐 Using Ollama URL: ${ollama_url}`);
  console.log(`🤖 Using LLM model: ${llm_model}`);
  // Log whether sliding window context is enabled or disabled
  console.log(`🪟  Sliding window context: ${useSlidingContext ? 'Enabled' : 'Disabled'}`);
  
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
      translatedFrontmatter[key] = await translateText(translatedFrontmatter[key], sourceLang, targetLang, ollama_url, llm_model);
    }
  }

  // 3.5 Mark the document as AI-generated (aiGenerated: true), since this script translates the content through an LLM (AI).
  translatedFrontmatter['aiGenerated'] = true;

  // 4. Parse the body into an Abstract Syntax Tree (AST)
  console.log('🌳 Generating Markdoc AST...');
  const ast = Markdoc.parse(mdocContent);

  // 5. Walk the AST and collect text nodes for Sliding Window Context
  console.log('🌳 Collecting text nodes for context window...');
  const nodesData = [];
  // ast.walk() is a generator that yields every node in the tree
  for (const node of ast.walk()) {
    // We strictly target text nodes to prevent the LLM from breaking tags or markup
    if (node.type === 'text' && typeof node.attributes.content === 'string') {
      // Store both the reference to the node itself (so we can mutate it later), and a copy of the original text to send to the LLM as context
      nodesData.push({ node, originalText: node.attributes.content });
    }
  }

  console.log('🤖 Sending text nodes to local LLM with sliding window context...');
  // Regular expression to check if the text contains at least one alphanumeric character
  // \p{L} matches any letter from any language, \p{N} matches any number
  const letterOrNumberRegex = /[\p{L}\p{N}]/u;

  for (let i = 0; i < nodesData.length; i++) {
    const { node, originalText } = nodesData[i];

    // Check if the text actually contains translatable content (letters or numbers)
    // This completely skips standalone emojis (like 🔹), punctuation, or empty blocks
    if (letterOrNumberRegex.test(originalText)) {
      // Extract the context of adjacent text nodes (if any) by using the original texts (not the translated ones!) to provide the LLM with a better understanding of the surrounding content
      const prevContext = (useSlidingContext && i > 0) ? nodesData[i - 1].originalText : '';
      const nextContext = (useSlidingContext && i < nodesData.length - 1) ? nodesData[i + 1].originalText : '';

      const translatedText = await translateText(originalText, sourceLang, targetLang, ollama_url, llm_model, prevContext, nextContext);
      // Mutate the node in place
      node.attributes.content = translatedText;
    } else {
      // Keep the symbol exactly as it was
      console.log(`   ⏩ Skipped structural symbol/emoji: "${originalText}"`);
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
export async function translateText(text: string, sourceLang: Locale, targetLang: Locale,
  ollama_url: string = DEFAULT_OLLAMA_URL, llm_model: string = DEFAULT_LLM_MODEL,
  prevContext: string = '', nextContext: string = ''): Promise<string> {
  // Capture leading and trailing whitespace to preserve formatting after translation
  const leadingSpace = text.match(/^\s*/)?.[0] || '';
  const trailingSpace = text.match(/\s*$/)?.[0] || '';
  
  // Trim the text for processing, but we'll reattach whitespace later
  const coreText = text.trim();

  // Ignore empty strings, whitespace, or single line breaks
  if (!coreText) return text;

  // Check if the text is only composed of protected content (e.g., URLs, hashtags, mentions), without additional text, and skip translation for such cases
  if (isOnlyProtectedContent(coreText)) {
    return text; // Return the original text as-is, including any leading/trailing whitespace
  }

  // Start the high-resolution stopwatch
  const startTime = performance.now();

  // Extract and replace protected content (like URLs) with placeholders to prevent the LLM from altering them
  let protectedText = coreText;
  const protectedTokens: string[] = [];

  for (const pattern of PROTECTED_PATTERNS) {
    protectedText = protectedText.replace(pattern, (match) => {
      protectedTokens.push(match);
      // Note: We use a purely alphanumeric placeholder to avoid any special characters that might confuse the LLM. The index ensures uniqueness for multiple URLs.
      return `TOKENPLACEHOLDER${protectedTokens.length - 1}X`;
    });
  }

  let promptRules = `CRITICAL RULES:
1. PRESERVE PROPER NOUNS: Do not translate project names (like "${PROJECT_NAME}"), countries, or organization names.
2. NO FORMATTING: Output raw text only. No markdown, no asterisks, no bolding.
3. NO CHATTER: Do not include introductory phrases, notes, or explanations (e.g., never output "Translated text:" or "Note:"). Just the exact translation.`;

  let ruleCounter = 4;

  // Add the placeholder rule ONLY if there are protected tokens in this fragment
  if (protectedTokens.length > 0) {
    promptRules += `\n${ruleCounter}. PLACEHOLDERS: Copy placeholders like TOKENPLACEHOLDER0X exactly as they appear.`;
    ruleCounter++;
  }

  let contextBlock = '';
  if (prevContext || nextContext) {
    promptRules += `\n${ruleCounter}. CONTEXT ONLY: Use the <PREVIOUS_NODE> and <NEXT_NODE> strictly to understand grammar and flow (e.g., if a verb should be plural/singular based on the previous word). DO NOT translate and DO NOT output the context nodes.`;
    
    if (prevContext) contextBlock += `<PREVIOUS_NODE>\n${prevContext.trim()}\n</PREVIOUS_NODE>\n\n`;
    if (nextContext) contextBlock += `<NEXT_NODE>\n${nextContext.trim()}\n</NEXT_NODE>\n\n`;
  }

  const prompt = `You are a professional technical translator. Your task is to translate ONLY the text enclosed in <TARGET_TO_TRANSLATE> from ${localeEnglishNames[sourceLang]} to ${localeEnglishNames[targetLang]}. Translate NOTHING ELSE.

${promptRules}

${contextBlock}<TARGET_TO_TRANSLATE>
${protectedText}
</TARGET_TO_TRANSLATE>`;

console.debug('FULL PROMPT SENT TO LLM:\n', prompt);

  try {
    // Send the prompt to the Ollama API
    // (The full URL is the base URL without the trailing slash (/) + and the endpoint (/api/generate))
    const response = await fetch(ollama_url.replace(/\/$/, '') + OLLAMA_GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llm_model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more deterministic translations
          top_k: 10, // Take only the top 10 most likely next words at each step, which helps reduce randomness
          top_p: 0.5 // Consider only the top 50% of the probability mass for the next word (this means, if option 1 has a probability of 0.3 and option 2 has a probability of 0.2, since their sum is 0.5, only those first two options are considered, and the rest are ignored), which also helps reduce randomness
        }
      }),
    });

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response from Ollama API');
    }

    let translatedText = data.response.trim();

    // Restore the original protected tokens back into the translated text
    protectedTokens.forEach((token, index) => {
      translatedText = translatedText.replace(`TOKENPLACEHOLDER${index}X`, token);
    });

    // Stop the stopwatch and calculate elapsed seconds
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const textSnippet = MAX_SNIPPET_LENGTH > 0 && coreText.length > MAX_SNIPPET_LENGTH ? `${coreText.substring(0, MAX_SNIPPET_LENGTH)}...` : coreText;
    const translatedSnippet = MAX_SNIPPET_LENGTH > 0 && translatedText.length > MAX_SNIPPET_LENGTH ? `${translatedText.substring(0, MAX_SNIPPET_LENGTH)}...` : translatedText;

    console.log(`   🔹 [${duration}s] Translated: "${textSnippet}" -> "${translatedSnippet}"`);
    
    if (leadingSpace) console.log(`       🔸 Added back leading whitespace: "${leadingSpace}" (length: ${leadingSpace.length})`);
    if (trailingSpace) console.log(`       🔸 Added back trailing whitespace: "${trailingSpace}" (length: ${trailingSpace.length})`);
    
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

// Generic function to determine if the text should be ignored by the LLM because it contains only protected content (like URLs, hashtags, or mentions) and no translatable text.
function isOnlyProtectedContent(text: string): boolean {
  let tempText = text;

  // We remove all protected patterns from the text
  for (const pattern of PROTECTED_PATTERNS) {
    tempText = tempText.replace(pattern, '');
  }

  // We trim the text to remove any leading or trailing whitespace
  tempText = tempText.trim();
  
  // If after removing URLs, hashtags and mentions, the text is empty 
  // or only contains whitespace and isolated punctuation, we return true
  return tempText.length === 0 || /^[\s\p{P}]+$/u.test(tempText);
}