import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc, { type Node as MarkdocNode } from '@markdoc/markdoc';
import { performance } from 'node:perf_hooks';

import { localeEnglishNames, type Locale } from '@languages';
import {
  translateText,
  containsAnyLetterOrNumberRegex,
  DEFAULT_OLLAMA_URL,
  DEFAULT_LLM_MODEL,
  type TranslateOptions,
} from '../translator.js';

// Keys in the YAML frontmatter that should be translated
const keysToTranslate = ['title', 'description'];

// ============================================================
// Public API
// ============================================================

/**
 * Core function to parse, translate, and rebuild a `.mdoc` (Markdoc) file.
 *
 * This is the Markdoc-specific processing logic that was formerly the
 * `processDocument` function in the admin package.
 */
export async function processMarkdocDocument(
  inputPath: string,
  outputPath: string,
  sourceLang: Locale,
  targetLang: Locale,
  options: TranslateOptions = {},
): Promise<void> {
  const ollamaUrl = options.ollamaUrl ?? DEFAULT_OLLAMA_URL;
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL;

  // Log URL and model being used for translation
  console.log(`🌐 Using Ollama URL: ${ollamaUrl}`);
  console.log(`🤖 Using LLM model: ${llmModel}`);

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
      translatedFrontmatter[key] = await translateText(translatedFrontmatter[key], sourceLang, targetLang, ollamaUrl, llmModel);
    }
  }

  // 3.5 Mark the document as AI-generated (aiGenerated: true), since this script translates the content through an LLM (AI).
  translatedFrontmatter['aiGenerated'] = true;

  // 4. Parse the body into an Abstract Syntax Tree (AST)
  console.log('🌳 Generating Markdoc AST...');
  const ast = Markdoc.parse(mdocContent);

  console.log('🤖 Sending block nodes to local LLM...');

  // 5. Recursively process the AST nodes, translating text and safe blocks
  await processNode(ast, sourceLang, targetLang, ollamaUrl, llmModel);

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

// ============================================================
// Internal Helpers — AST Traversal
// ============================================================

// Helper function to get both slots and children of a Markdoc node, since some nodes may have content in either or both.
// Note: logic for processing both slots and children in for loop comes directly from the Markdoc Node class's walk() method, which yields all child nodes in both slots and children arrays, with added null checks just in case
function getSlotsAndChildren(node: MarkdocNode): MarkdocNode[] {
  const slots = node.slots ? Object.values(node.slots) : [];
  const children = node.children || [];
  return [...slots, ...children];
}

async function processNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollamaUrl: string, llmModel: string): Promise<void> {
  // Special case: If the node is a "tag" type with the custom name "notranslate", we skip translating this node and all its children, since it's explicitly marked to be ignored by the LLM translation process.
  if (node.type === 'tag' && node.tag === 'notranslate') {
    console.debug(`   ⛔ Skipping translation for {% notranslate %} tag and its children` + (node.location ? ` at line ${node.location.start.line}` : ''));
    return;
  }

  // First, check if the node is a safe block node (like a paragraph or heading) that can be translated as a whole
  if (isSafeMarkdownBlockNode(node)) {
    await processSafeMarkdownBlockNode(node, sourceLang, targetLang, ollamaUrl, llmModel);
    return;
  }

  // If the node is not a safe block, we check if it's a text node that can be translated individually
  if (isTextNode(node)) {
    await processTextNode(node, sourceLang, targetLang, ollamaUrl, llmModel);
    return;
  }

  // If the node is neither a safe block nor a text node, we recursively process its slots and children (if any)
  const childNodes = getSlotsAndChildren(node);
  for (const child of childNodes) {
    await processNode(child, sourceLang, targetLang, ollamaUrl, llmModel);
  }
}

// Safe nodes for flattening and translating entire blocks (like paragraphs and headings) without risking the loss of inline formatting or Markdoc components.
const safeMarkdownBlockTypes = ['paragraph', 'heading'];
function isSafeMarkdownBlockNode(node: MarkdocNode): boolean {
  return safeMarkdownBlockTypes.includes(node.type) // Ensure the node is a recognized safe block type
    && !containsUnsafeNode(node) // Ensure the node does not contain any custom tags (like {% flag country="eu" /%});
}

// Recursive search to find any unsafe nodes, such as custom tags, links (URLs), images, and code blocks, hidden in the hierarchy (e.g. {% flag country="eu" /%}, [link](https://ai4pid.eu), ![](image.jpg)).
// We consider these nodes "unsafe" because the LLM may not understand them and could potentially remove or alter them during translation, which would break the document's structure or meaning.
const unsafeNodeTypes: MarkdocNode['type'][] = ['tag', 'link', 'image', 'code'];
function containsUnsafeNode(node: MarkdocNode): boolean {
  if (unsafeNodeTypes.includes(node.type)) return true;
  return getSlotsAndChildren(node).some(child => containsUnsafeNode(child));
}

async function processSafeMarkdownBlockNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollamaUrl: string, llmModel: string): Promise<void> {
  // Convert the sub-tree to Markdown (preserving **bold**, _italics_, etc.)
  const rawMarkdown = Markdoc.format(node).trim();

  if (!containsAnyLetterOrNumberRegex.test(rawMarkdown)) {
    return; // Skip translation if the text doesn't contain any letters or numbers
  }

  const translatedMarkdown = await translateText(rawMarkdown, sourceLang, targetLang, ollamaUrl, llmModel);

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
async function processTextNode(node: MarkdocNode, sourceLang: Locale, targetLang: Locale, ollamaUrl: string, llmModel: string): Promise<void> {
  const originalText = node.attributes.content;

  if (!containsAnyLetterOrNumberRegex.test(originalText)) {
    return; // Skip translation if the text doesn't contain any letters or numbers
  }

  const translatedText = await translateText(originalText, sourceLang, targetLang, ollamaUrl, llmModel);

  // Update the node's content with the translated text
  node.attributes.content = translatedText;
}
