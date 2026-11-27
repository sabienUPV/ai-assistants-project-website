// src/pages/llms.txt.ts

/**
 * NOTE:
 * This file is named llms.txt using the .txt extension (instead of .md) to enforce the text/plain MIME type and prevent visual rendering,
 * which is the industry standard for LLM documentation (see llmstxt.org).
 */

import Markdoc from '@markdoc/markdoc';
import { markdocTagAttributes, type MarkdocTagDefinition } from '@markdoc-tags';

export async function GET() {
  // 1. Fetch all raw .mdoc files from your content directories
  // The '?raw' query tells Vite to import the files as pure strings
  const mdocFiles = import.meta.glob('/../admin/src/content/**/*.mdoc', { 
    query: '?raw', 
    import: 'default', 
    eager: true 
  }) as Record<string, string>;

  // Store the most complex example for each tag
  const bestExamples: Record<string, { attrCount: number; rawSnippet: string }> = {};

  // 2. Parse every file and walk its AST
  for (const rawContent of Object.values(mdocFiles)) {
    const ast = Markdoc.parse(rawContent);
    const textLines = rawContent.split('\n');

    for (const node of ast.walk()) {
      // Check if it's a custom tag defined in our schema
      if (node.type === 'tag' && typeof node.tag === 'string' && markdocTagAttributes[node.tag as keyof typeof markdocTagAttributes]) {
        const attrCount = Object.keys(node.attributes).length;
        const currentBest = bestExamples[node.tag]?.attrCount ?? -1;

        // 3. Keep the one with the most attributes to provide maximum context
        if (attrCount > currentBest) {
          // Check if it's a wrapper tag (has internal content)
          const isBlock = node.children && node.children.length > 0;
          let endLine = node.lines[1]; 

          if (isBlock) {
            let depth = 0;
            // \b ensures we match "slide" but not "slideshow"
            const openRegex = new RegExp(`\\{%\\s*${node.tag}\\b`);
            const closeRegex = new RegExp(`\\{%\\s*/${node.tag}\\s*%\\}`);

            // Scan downwards from the opening tag to find the matching closing tag
            for (let i = node.lines[0]; i < textLines.length; i++) {
              if (openRegex.test(textLines[i])) depth++;
              if (closeRegex.test(textLines[i])) depth--;
              
              if (depth === 0) {
                endLine = i + 1;
                break;
              }
            }
          }

          const snippetLines = textLines.slice(node.lines[0], endLine);
          
          bestExamples[node.tag] = {
            attrCount,
            rawSnippet: snippetLines.join('\n')
          };
        }
      }
    }
  }

  // 4. Build the JSON Schema Context dynamically
  const tagsSchema = Object.entries<MarkdocTagDefinition>(markdocTagAttributes).map(([tag, config]) => {
    return {
      tag,
      description: config.description,
      contextForLLM: config.contextForLLM,
      attributes: 'attributes' in config ? config.attributes : undefined
    };
  });

  // 5. Construct the final llms.txt Markdown
  let markdownContent = `
# AI4PID Markdoc Content Schema & System Prompt

You are an expert AI assistant tasked with converting raw educational content into our Markdoc (.mdoc) format with custom tags.

## 1. Custom Tags Schema
Below is the JSON representation of all valid custom tags. You must strictly adhere to these definitions.

\`\`\`json
${JSON.stringify(tagsSchema, null, 2)}
\`\`\`

## 2. Formatting Rules & Syntax Examples
When generating content, use standard Markdown for basic text. For interactive components, use the custom tags below based on real production examples.
`;

  // Append dynamically extracted examples
  for (const [tag, example] of Object.entries(bestExamples)) {
    markdownContent += `\n### \`${tag}\`\n`;
    markdownContent += `\`\`\`mdoc\n${example.rawSnippet}\n\`\`\`\n`;
  }

  return new Response(markdownContent.trim(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}