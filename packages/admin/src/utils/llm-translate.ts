import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc, { type Node as MarkdocNode } from '@markdoc/markdoc';
import { performance } from 'node:perf_hooks'; // Native Node module for precise timing

import { localeEnglishNames, type Locale } from '@languages';
import { PROJECT_NAME } from '@constants';

// LLM Engine Configuration
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_GENERATE_ENDPOINT = '/api/generate';
export const DEFAULT_LLM_MODEL = 'translategemma:4b'; // A model optimized for translation tasks

// Keys in the YAML frontmatter that should be translated
const keysToTranslate = ['title', 'description'];

// Maximum length of snippets to log for translation feedback
//const MAX_SNIPPET_LENGTH = 20;
const MAX_SNIPPET_LENGTH = -1; // Set to -1 to disable snippet truncation in logs

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const escapedProjectNameRegex = escapeRegExp(PROJECT_NAME).replace(/\s+/g, '\\s+');

const PROJECT_NAME_WORDS = PROJECT_NAME.split(/\s+/);

// Protected patterns include URLs, hashtags, and mentions. These will be ignored by the LLM translation process.
// Note: We use \p{L} and \p{N}, combined with the 'u' flag, to ensure that we capture letters and numbers from any language, including accented characters and special letters like 'ñ'.
const PROTECTED_PATTERNS = [
  /(https?:\/\/[^\s)\]"']+)/g, // URLs
  /(#[\p{L}\p{N}_]+)/gu,        // Hashtags (e.g. #AIforGood, #Inclusion)
  /(@[\p{L}\p{N}_]+)/gu,         // Mentions (e.g. @HURT)
  /([\p{L}\p{N}._-]+@[\p{L}\p{N}._-]+\.[\p{L}\p{N}_-]+)/gu, // Email addresses
  /(&[a-zA-Z0-9#]+;)/g,          // HTML entities (e.g., &nbsp;, &amp;, &#160;)
  new RegExp(`(${escapedProjectNameRegex})`, 'gi'), // Project name (e.g., "AI-ASSISTANTS 4PID") in any case (lowercase, uppercase, etc.), with flexible whitespace (note: order is important! This regex should come before the individual words of the project name, to avoid partial matches)
  ...(PROJECT_NAME_WORDS.length > 1 ? [new RegExp(`(${PROJECT_NAME_WORDS.map(word => escapeRegExp(word)).join('|')})`, 'gi')] : []), // Individual words of the project name (e.g., "AI-ASSISTANTS" and "4PID") in any case, with flexible whitespace
];

/**
 * Core function to parse, translate, and rebuild the .mdoc file
 */
export async function processDocument(inputPath: string, outputPath: string, sourceLang: Locale, targetLang: Locale,
  ollama_url: string = DEFAULT_OLLAMA_URL, llm_model: string = DEFAULT_LLM_MODEL) : Promise<void> {
  // Log URL and model being used for translation
  console.log(`🌐 Using Ollama URL: ${ollama_url}`);
  console.log(`🤖 Using LLM model: ${llm_model}`);
  
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

  console.log('🤖 Sending block nodes to local LLM...');

  // 5. Recursively process the AST nodes, translating text and safe blocks
  await processNode(ast, sourceLang, targetLang, ollama_url, llm_model);

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

// Regular expression to check if the text contains at least one alphanumeric character
// \p{L} matches any letter from any language, \p{N} matches any number
const containsAnyletterOrNumberRegex = /[\p{L}\p{N}]/u;

async function processNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollama_url: string, llm_model: string): Promise<void> {
  // First, check if the node is a safe block node (like a paragraph or heading) that can be translated as a whole
  if (isSafeMarkdownBlockNode(node)) {
    await processSafeMarkdownBlockNode(node, sourceLang, targetLang, ollama_url, llm_model);
    return;
  }

  // If the node is not a safe block, we check if it's a text node that can be translated individually
  if (isTextNode(node)) {
    await processTextNode(node, sourceLang, targetLang, ollama_url, llm_model);
    return;
  }

  // If the node is neither a safe block nor a text node, we recursively process its slots and children (if any)
  // (Note: logic for processing both slots and children in for loop comes directly from the Markdoc Node class's walk() method, which yields all child nodes in both slots and children arrays, with added null checks just in case)
  const slots = node.slots ? Object.values(node.slots) : [];
  const children = node.children || [];
  for (const child of [...slots, ...children]) {
    await processNode(child, sourceLang, targetLang, ollama_url, llm_model);
  }
}

// Safe nodes for flattening and translating entire blocks (like paragraphs and headings) without risking the loss of inline formatting or Markdoc components.
const safeMarkdownBlockTypes = ['paragraph', 'heading'];
function isSafeMarkdownBlockNode(node: MarkdocNode): boolean {
  return safeMarkdownBlockTypes.includes(node.type) // Ensure the node is a recognized safe block type
    && !(node.children?.some(child => child.type === 'tag')); // Ensure there are no custom Markdoc tags in the children
}
async function processSafeMarkdownBlockNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollama_url: string, llm_model: string): Promise<void> {
  // Convert the sub-tree to Markdown (preserving **bold**, _italics_, etc.)
  const rawMarkdown = Markdoc.format(node).trim();

  if (!containsAnyletterOrNumberRegex.test(rawMarkdown)) {
    return; // Skip translation if the text doesn't contain any letters or numbers
  }

  const translatedMarkdown = await translateText(rawMarkdown, sourceLang, targetLang, ollama_url, llm_model);
    
  // Parse the translated markdown back into a sub-tree AST
  const translatedAst = Markdoc.parse(translatedMarkdown);

  // Markdoc.parse() returns Document -> Paragraph/Heading -> [inline children]
  // We replace the children of the original node with the new translated children
  if (translatedAst.children.length > 0) {
    node.children = translatedAst.children[0].children;
  }
}

function isTextNode(node: MarkdocNode): boolean {
  return node.type === 'text' && typeof node.attributes.content === 'string';
}
async function processTextNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollama_url: string, llm_model: string): Promise<void> {
  const originalText = node.attributes.content;
  
  if (!containsAnyletterOrNumberRegex.test(originalText)) {
    return; // Skip translation if the text doesn't contain any letters or numbers
  }

  const translatedText = await translateText(originalText, sourceLang, targetLang, ollama_url, llm_model);

  // Update the node's content with the translated text
  node.attributes.content = translatedText;
}

/**
 * Calls the local Ollama API to translate plain text nodes.
 */
export async function translateText(text: string, sourceLang: Locale, targetLang: Locale,
  ollama_url: string = DEFAULT_OLLAMA_URL, llm_model: string = DEFAULT_LLM_MODEL): Promise<string> {
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

  const sourceLangName = localeEnglishNames[sourceLang];
  const targetLangName = localeEnglishNames[targetLang];

  // Strict user prompt for TranslateGemma (with the two required line breaks)
  // (see prompt guide here: https://ollama.com/library/translategemma)
  // (Note: This prompt is straight from the TranslateGemma documentation, so we cannot really change it without risking the quality of the translation, since the model was trained with this prompt in mind.)
  const prompt = `You are a professional ${sourceLangName} (${sourceLang}) to ${targetLangName} (${targetLang}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceLangName} text while adhering to ${targetLangName} grammar, vocabulary, and cultural sensitivities. Produce only the ${targetLangName} translation, without any additional explanations or commentary. Please translate the following ${sourceLangName} text into ${targetLangName}:


${protectedText}`;

  try {
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
    if (!data.response) throw new Error('No response from Ollama API');

    let translatedText = data.response.trim();

    // Restore the protected tokens (like URLs, project names, etc.) back into the translated text
    protectedTokens.forEach((token, index) => {
      translatedText = translatedText.replace(`TOKENPLACEHOLDER${index}X`, token);
    });

    // Stop the stopwatch and calculate elapsed seconds
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const textSnippet = MAX_SNIPPET_LENGTH > 0 && coreText.length > MAX_SNIPPET_LENGTH ? `${coreText.substring(0, MAX_SNIPPET_LENGTH)}...` : coreText;
    const translatedSnippet = MAX_SNIPPET_LENGTH > 0 && translatedText.length > MAX_SNIPPET_LENGTH ? `${translatedText.substring(0, MAX_SNIPPET_LENGTH)}...` : translatedText;

    console.log(`   🔹 [${duration}s] Translated: "${textSnippet}" -> "${translatedSnippet}"`);
    
    if (leadingSpace) console.debug(`       🔸 Added back leading whitespace: "${leadingSpace}" (length: ${leadingSpace.length})`);
    if (trailingSpace) console.debug(`       🔸 Added back trailing whitespace: "${trailingSpace}" (length: ${trailingSpace.length})`);
    
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