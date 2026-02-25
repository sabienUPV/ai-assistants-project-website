import { join } from 'path';
import * as XLSX from 'xlsx/xlsx.mjs';

/* load 'fs' for readFile and writeFile support */
import * as fs from 'fs';
XLSX.set_fs(fs);

// --- Configuration ---
const outputDir = join(process.cwd(), 'src', 'content');

// Get input file path from arguments
const inputExcelFile = process.argv[2];

if (!inputExcelFile) {
  console.error('❌ Please provide a path to the the excel file.');
  console.error('Usage: node import-i18n-content-from-excel-to-csv.js <path-to-excel-file>');
  process.exit(1);
}

// Ensure the provided file exists
if (!fs.existsSync(inputExcelFile)) {
  console.error(`❌ File not found: ${inputExcelFile}`);
  process.exit(1);
}

// 1. Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
}

try {
    // 2. Load the Excel file
    console.log(`Loading Excel file: ${inputExcelFile}...`);
    const workbook = XLSX.readFile(inputExcelFile);

    // 3. Loop through every sheet in the workbook
    workbook.SheetNames.forEach(sheetName => {
        console.log(`Processing sheet: "${sheetName}"`);
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to CSV
        // 'FS' is the Field Separator. We force it to a comma.
        // It automatically handles wrapping inner commas with double quotes!
        const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: ',' });
        
        // 4. Save the file
        // Note: You might want to sanitize the sheetName here if it has weird characters
        const outputFile = join(outputDir, `${sheetName}.csv`);
        fs.writeFileSync(outputFile, csvContent, 'utf-8');
        
        console.log(`✅ Saved: src/content/${sheetName}.csv`);
    });

    console.log('🎉 All sheets exported successfully!');

} catch (error) {
    console.error('❌ Error processing the file:', error.message);
}