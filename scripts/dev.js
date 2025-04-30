#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname);

// Start the server
const server = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  cwd: rootDir,
  env: { ...process.env, NODE_ENV: 'development' }
});

// Start Vite dev server
const vite = spawn('vite', ['--port', '5173'], {
  stdio: 'inherit',
  cwd: rootDir
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Terminating processes...');
  server.kill('SIGINT');
  vite.kill('SIGINT');
  process.exit(0);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  vite.kill('SIGINT');
  process.exit(code);
});

vite.on('close', (code) => {
  console.log(`Vite process exited with code ${code}`);
  server.kill('SIGINT');
  process.exit(code);
});