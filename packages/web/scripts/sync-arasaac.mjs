import fs from 'node:fs';
import path from 'node:path';
import Markdoc from '@markdoc/markdoc';

// --- CONFIGURATION ---
// Adjust CONTENT_DIR to the folder where Keystatic saves your .mdoc files
const CONTENT_DIR = path.join(process.cwd(), '..', 'admin', 'src', 'content');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'arasaac');
const API_BASE = 'https://api.arasaac.org/api/pictograms';
const API_DEFAULT_SIZE = 500; // Default size for pictograms if not specified in the content (if size is bigger, we will download the 2500px high-res version)

// Detect a "--force-download" flag (or a "FORCE_DOWNLOAD" environment variable) to force re-download of all pictograms
// Usage: `node sync-arasaac.mjs --force-download` or `FORCE_DOWNLOAD=true node sync-arasaac.mjs`
// (NOTE: If running npm run scripts with parameters/flags, you may need to use `--` to pass the flag, e.g., `npm run sync:arasaac -- --force-download`,
// and if you do it from the monorepo root, you need to use it twice, e.g., `npm run web:sync-arasaac -- -- --force-download`)
const FORCE_DOWNLOAD = process.argv.includes('--force-download') || process.env.FORCE_DOWNLOAD === 'true';

if (FORCE_DOWNLOAD) {
  console.log('⚠️  Force download enabled: All pictograms will be re-downloaded.');
}

console.log(`📂 Scanning content directory: ${CONTENT_DIR}`);
console.log(`📥 Downloading pictograms to: ${OUTPUT_DIR}`);

// Ensure the destination folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Recursive function to find all .mdoc files
function findMdocFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findMdocFiles(filePath, fileList);
    } else if (filePath.endsWith('.mdoc')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Function to download the image
async function downloadImage(id, size = API_DEFAULT_SIZE) {
  const filePath = path.join(OUTPUT_DIR, `${id}.png`);
  
  // If it already exists locally, skip it (or re-download if FORCE_DOWNLOAD is true)
  if (fs.existsSync(filePath)) {
    if (FORCE_DOWNLOAD) {
      console.log(`🔄 Force downloading: #${id}...`);
    } else {
      console.log(`✅ Pictogram #${id} already exists.`);
      return false;
    }
  }

  const downloadHighRes = size > API_DEFAULT_SIZE;
  console.log(`⏳ Downloading new pictogram: #${id}... (${downloadHighRes ? 'high-res' : 'default size'})`);
  try {
    // Download the high-resolution version (2500px) ONLY if max used size is larger than default (500px) to save bandwidth and storage
    const response = await fetch(`${API_BASE}/${id}${size > API_DEFAULT_SIZE ? '?resolution=2500' : ''}`);
    
    if (!response.ok) {
      console.error(`❌ Error downloading #${id}: ${response.statusText}`);
      return false;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Pictogram #${id} saved successfully.`);
    return true;
  } catch (error) {
    console.error(`❌ Exception downloading #${id}:`, error.message);
    return false;
  }
}

// Main function
async function run() {
  console.log('🔍 Scanning content files for ARASAAC pictograms...');
  const files = findMdocFiles(CONTENT_DIR);
  const pictogramIds = new Map(); // HashMap to avoid duplicates (key: id, value: max size used in any content)

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // Parse the AST with Markdoc
    const ast = Markdoc.parse(content);
    
    // Walk through the AST nodes
    for (const node of ast.walk()) {
      // Look for our custom tag {% arasaac %}
      if (!(node.type === 'tag' && node.tag === 'arasaac')) {
        continue;
      }
      // In Markdoc, the #1234 shortcut is automatically injected into the 'id' attribute
      const id = node.attributes.id;
      if (!id) {
        console.warn(`⚠️  Found arasaac tag without ID in file: ${file}`);
        continue;
      }
      const idStr = id.toString();
      const size = node.attributes.size || API_DEFAULT_SIZE;
      if (!pictogramIds.has(idStr) || size > pictogramIds.get(idStr)) {
        pictogramIds.set(idStr, size);
      }
    }
  }

  console.log(`📊 Found ${pictogramIds.size} unique pictograms in the content.`);
  
  let downloadedCount = 0;
  for (const [id, size] of pictogramIds) {
    const wasDownloaded = await downloadImage(id, size);
    if (wasDownloaded) downloadedCount++;
  }

  console.log('---');
  console.log(`🚀 Synchronization complete. Downloaded ${downloadedCount} new pictograms.`);
}

run();