import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTECTED_PATTERNS,
  DEFAULT_SKIP_COLUMNS,
} from '../src/utils/llm/index.js';
import { processCsvDocument } from '../src/utils/llm/processors/process-csv.js';
import { processMarkdocDocument } from '../src/utils/llm/processors/process-markdoc.js';
import { resolveOutputPath } from '../src/utils/llm/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'test-temp');

async function testAll() {
  console.log('🧪 Starting LLM Translation Architecture Verification Tests...');

  // 1. Verify PROTECTED_PATTERNS
  console.log('\n--- Test 1: PROTECTED_PATTERNS ---');
  const sample = 'Check out https://ai4pid.eu and #Inclusion by @HURT for AI-ASSISTANTS 4PID at UPV';
  let matches: string[] = [];
  for (const pattern of PROTECTED_PATTERNS) {
    const found = sample.match(pattern);
    if (found) matches.push(...found);
  }
  console.log('Protected matches found:', matches);
  assert(matches.some(m => m.includes('https://ai4pid.eu')), 'URL should be protected');
  assert(matches.some(m => m.includes('#Inclusion')), 'Hashtag should be protected');
  assert(matches.some(m => m.includes('@HURT')), 'Mention should be protected');
  assert(matches.some(m => m.includes('AI-ASSISTANTS 4PID')), 'Project name should be protected');
  assert(matches.some(m => m.includes('UPV')), 'Partner name should be protected');
  console.log('✅ Test 1 Passed: Protected patterns match expected tokens.');

  // 2. Verify Output Path Resolution
  console.log('\n--- Test 2: resolveOutputPath ---');
  // CSV path resolution
  const csvOut = resolveOutputPath('packages/web/src/content/ai-solutions/ai-solutions_en.csv', 'es');
  console.log('CSV resolved output:', csvOut);
  assert(csvOut.endsWith('ai-solutions_es.csv'), 'CSV output should end with ai-solutions_es.csv');

  // Markdoc path resolution
  const mdocOut = resolveOutputPath('packages/admin/src/content/en/posts/post-1.mdoc', 'de');
  console.log('Markdoc resolved output:', mdocOut);
  assert(mdocOut.replace(/\\/g, '/').includes('de/posts'), 'Markdoc output should have de/posts segment');
  console.log('✅ Test 2 Passed: Output paths resolve correctly for both formats.');

  // 3. Verify CSV Processing (with simulated offline/fallback)
  console.log('\n--- Test 3: CSV Processing ---');
  await fs.mkdir(testDir, { recursive: true });
  const testCsvInput = path.join(testDir, 'test_en.csv');
  const testCsvOutput = path.join(testDir, 'test_es.csv');

  const csvContent = `"ID","Name","Link/URL","Brief Description","Registration Required","Costs/Monetization"
"1","Test Tool","https://example.com","A wonderful tool for learning","no","Free"
`;
  await fs.writeFile(testCsvInput, csvContent, 'utf-8');

  // Since Ollama might not be running locally, translateText falls back to original text on error
  await processCsvDocument(testCsvInput, testCsvOutput, 'en', 'es', {
    ollamaUrl: 'http://localhost:9999', // dummy port to test graceful fallback
    llmModel: 'dummy',
  });

  const generatedCsv = await fs.readFile(testCsvOutput, 'utf-8');
  console.log('Generated CSV content:\n', generatedCsv);
  assert(generatedCsv.includes('"ID","Name","Link/URL","Brief Description","Registration Required","Costs/Monetization"'), 'Headers preserved');
  assert(generatedCsv.includes('"Test Tool"'), 'Row values preserved');
  console.log('✅ Test 3 Passed: CSV processing handles parsing, structure, quoting, and fallback.');

  // 4. Verify Markdoc Processing (with fallback)
  console.log('\n--- Test 4: Markdoc Processing ---');
  const testMdocInput = path.join(testDir, 'test_post.mdoc');
  const testMdocOutput = path.join(testDir, 'test_post_out.mdoc');

  const mdocContent = `---
title: Original Title
description: Original Description
---

# Welcome

This is a test paragraph with **bold** text.

{% notranslate %}
Keep this text exactly as is.
{% /notranslate %}
`;
  await fs.writeFile(testMdocInput, mdocContent, 'utf-8');

  await processMarkdocDocument(testMdocInput, testMdocOutput, 'en', 'es', {
    ollamaUrl: 'http://localhost:9999',
    llmModel: 'dummy',
  });

  const generatedMdoc = await fs.readFile(testMdocOutput, 'utf-8');
  console.log('Generated Markdoc content:\n', generatedMdoc);
  assert(generatedMdoc.includes('aiGenerated: true'), 'Frontmatter contains aiGenerated: true');
  assert(generatedMdoc.includes('title: Original Title'), 'Frontmatter keys preserved on fallback');
  assert(generatedMdoc.includes('Keep this text exactly as is'), 'notranslate block preserved');
  console.log('✅ Test 4 Passed: Markdoc processing handles AST, frontmatter, notranslate, and fallback.');

  // Cleanup test directory
  await fs.rm(testDir, { recursive: true, force: true });
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testAll().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
