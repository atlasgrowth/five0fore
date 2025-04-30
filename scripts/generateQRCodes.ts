import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { db } from '../server/db';
import { bays } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Convert ESM URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../client/src/assets/qr-codes');

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function generateQRCodeForBay(id: number, number: number, floor: number) {
  // The URL format will be: /customer?bay=ID
  const url = `/customer?bay=${id}`;
  const outputPath = path.join(OUTPUT_DIR, `bay-${number}.png`);
  
  try {
    await QRCode.toFile(outputPath, url, {
      color: {
        dark: '#000',  // Black dots
        light: '#FFF', // Transparent background
      },
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'H', // High error correction
    });
    
    console.log(`QR code for Bay #${number} (Floor ${floor}) generated at ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Error generating QR code for Bay #${number}:`, error);
    throw error;
  }
}

async function generateAllQRCodes() {
  console.log('Generating QR codes for all bays...');
  await ensureOutputDir();
  
  try {
    const allBays = await db.select().from(bays);
    
    for (const bay of allBays) {
      await generateQRCodeForBay(bay.id, bay.number, bay.floor);
    }
    
    console.log(`Successfully generated ${allBays.length} QR codes in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error generating QR codes:', error);
  }
}

// Generate QR code for a specific bay
async function generateQRCodeForBayNumber(bayNumber: number) {
  await ensureOutputDir();
  
  try {
    const [bay] = await db.select().from(bays).where(eq(bays.number, bayNumber));
    
    if (!bay) {
      console.error(`Bay #${bayNumber} not found`);
      return;
    }
    
    const outputPath = await generateQRCodeForBay(bay.id, bay.number, bay.floor);
    console.log(`QR code generated for Bay #${bayNumber} at ${outputPath}`);
  } catch (error) {
    console.error(`Error generating QR code for Bay #${bayNumber}:`, error);
  }
}

// Check if we're running this script directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const bayNumber = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  
  if (bayNumber) {
    // Generate QR code for a specific bay
    generateQRCodeForBayNumber(bayNumber)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    // Generate QR codes for all bays
    generateAllQRCodes()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}

export { generateQRCodeForBayNumber, generateAllQRCodes };