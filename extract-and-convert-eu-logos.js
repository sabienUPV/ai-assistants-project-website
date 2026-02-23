import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import { optimize } from 'svgo';
import { tmpdir } from 'os';

// 1. Get input path from arguments
const inputDir = process.argv[2];

if (!inputDir) {
  console.error('❌ Please provide a path to the directory containing the zip files.');
  console.error('Usage: node extract-and-convert-eu-logos.js <path-to-zips>');
  process.exit(1);
}

// Ensure the provided directory exists
const absoluteInputDir = resolve(process.cwd(), inputDir);
if (!existsSync(absoluteInputDir)) {
  console.error(`❌ Directory not found: ${absoluteInputDir}`);
  process.exit(1);
}

// 2. Setup output directory
const outputDir = join(process.cwd(), 'src', 'assets', 'images', 'eu');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Setup a temporary directory for intermediate EPS and SVG files
const tempDir = mkdtempSync(join(tmpdir(), 'eu-logos-eps-to-svg-'));

// 3. Process the files
const files = readdirSync(absoluteInputDir);
const zipRegex = /^co-funded_([a-z-]+)\.zip$/;

let processedCount = 0;

files.forEach(file => {
  const match = file.match(zipRegex);
  if (!match) return; // Skip files that don't match the pattern

  const localeLower = match[1];
  const localeUpper = localeLower.toUpperCase();
  const zipFilePath = join(absoluteInputDir, file);
  
  console.log(`\n📦 Processing ${file}...`);

  try {
    // 4. Read the ZIP and find the EPS entry
    const zip = new AdmZip(zipFilePath);
    const expectedEpsPath = `co-funded_${localeUpper}/horizontal/RGB/EPS/${localeUpper}_Co-fundedbytheEU_RGB_NEG.eps`;
    
    const zipEntry = zip.getEntry(expectedEpsPath);
    if (!zipEntry) {
      console.warn(`⚠️  EPS file not found inside ${file} at expected path:\n   ${expectedEpsPath}`);
      return;
    }

    // 5. Extract EPS to temp directory
    const tempEpsPath = join(tempDir, `${localeLower}.eps`);
    const tempSvgPath = join(tempDir, `${localeLower}.svg`);
    
    writeFileSync(tempEpsPath, zipEntry.getData());

    // 6. Convert EPS to SVG using Inkscape CLI
    console.log(`   🎨 Converting EPS to SVG via Inkscape...`);
    // Note: Inkscape 1.0+ uses --export-filename. Older versions use --export-plain-svg
    execSync(`inkscape --export-filename="${tempSvgPath}" "${tempEpsPath}"`, { stdio: 'ignore' });

    // 7. Read the generated SVG and optimize with SVGO
    console.log(`   ✨ Optimizing SVG...`);
    const rawSvgData = readFileSync(tempSvgPath, 'utf8');
    const optimizedSvg = optimize(rawSvgData, {
      path: tempSvgPath,
      multipass: true, // Optimizes multiple times for best results
    });

    // 8. Save the final SVG to src/images/eu
    const finalOutputPath = join(outputDir, `${localeUpper}_Co-fundedbytheEU_RGB_NEG.svg`);
    writeFileSync(finalOutputPath, optimizedSvg.data);
    
    console.log(`   ✅ Saved optimized SVG to src/assets/images/eu/${localeUpper}_Co-fundedbytheEU_RGB_NEG.svg`);
    processedCount++;

  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

// 9. Clean up temporary directory
try {
  rmSync(tempDir, { recursive: true, force: true });
} catch (e) {
  // Silent catch for temp folder deletion failure
}

console.log(`\n🎉 Done! Successfully processed ${processedCount} logos.`);