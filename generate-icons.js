import { execSync } from 'node:child_process';
import os from 'node:os';

console.log('✨ Optimizing source SVG with SVGO...');
try {
    // --multipass tells SVGO to run multiple times until fully optimized
    // By default, SVGO overwrites the input file with the optimized version
    execSync('npx svgo public/favicon.svg --multipass', { stdio: 'inherit' });
} catch (error) {
    console.warn('\n⚠️ SVGO failed. Is it installed? Skipping optimization.');
    // We don't use process.exit(1) here because failing to optimize 
    // shouldn't stop the rest of the script from generating the PNGs/ICOs.
}

console.log('🎨 Generating PNGs with Inkscape...');
try {
    execSync('inkscape -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png', { stdio: 'inherit' });
    execSync('inkscape -w 192 -h 192 public/favicon.svg -o public/icon-192.png', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Inkscape failed. Make sure it is installed and in your PATH.');
    process.exit(1);
}

console.log('📦 Generating multi-size ICO...');

const isWindows = os.platform() === 'win32';
const icoArgs = '-background none public/favicon.svg -define icon:auto-resize=256,128,64,48,32,16 public/favicon.ico';

try {
    // Try the modern v7 command first (Works on Windows Scoop and newer Linux setups)
    execSync(`magick ${icoArgs}`, { stdio: 'inherit' });
} catch (error) {
    if (isWindows) {
        // We are on Windows and 'magick' failed. Do NOT run 'convert'.
        console.error('\n❌ ImageMagick "magick" command failed.');
        console.error('Skipping "convert" fallback to avoid the Windows FAT-to-NTFS utility.');
        console.error('Please ensure ImageMagick v7 is installed via Scoop and in your PATH.');
        console.error('Recommended minimal installation: scoop install imagemagick-lean');
        process.exit(1);
    } else {
        // We are on Linux/macOS. It's safe to fallback to v6 'convert'.
        console.log('⚠️  Magick not found, falling back to convert...');
        try {
            execSync(`convert ${icoArgs}`, { stdio: 'inherit' });
        } catch (fallbackError) {
            console.error('\n❌ Both "magick" and "convert" failed. Is ImageMagick installed?');
            process.exit(1);
        }
    }
}

console.log('✅ All icons generated successfully!');