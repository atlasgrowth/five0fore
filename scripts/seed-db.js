#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname);

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Running ${scriptPath}...`);
    const process = spawn('tsx', [scriptPath], {
      stdio: 'inherit',
      cwd: rootDir
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });
  });
}

async function seedDatabase() {
  try {
    await runScript('scripts/seedBays.ts');
    await runScript('scripts/seedMenu.ts');
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Database seeding failed:', error.message);
    process.exit(1);
  }
}

seedDatabase();