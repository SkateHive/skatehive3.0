#!/usr/bin/env node

/**
 * Skatehive Scripts Runner
 * Usage: node scripts/index.js <command>
 * 
 * Available commands:
 * - db:inspect     - Inspect database schema
 * - db:smoke-userbase - Run userbase smoke test
 * - db:snapshot-userbase - Snapshot userbase tables
 * - rewards:claim  - Discover/dry-run/execute Hive reward claims
 * - help          - Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');

const commands = {
  'db:inspect': 'database/inspect-schema.js',
  'db:smoke-userbase': 'database/smoke-userbase.js',
  'db:snapshot-userbase': 'database/snapshot-userbase.js',
  'rewards:claim': 'userbase/claim-rewards.ts',
};

function showHelp() {
  console.log('🛹 Skatehive Scripts Runner\n');
  console.log('Usage: node scripts/index.js <command>\n');
  console.log('Available commands:');
  console.log('  db:inspect     - Inspect database table schemas');
  console.log('  db:smoke-userbase - Run userbase database smoke test');
  console.log('  db:snapshot-userbase - Snapshot userbase tables');
  console.log('  rewards:claim  - Discover/dry-run/execute Hive reward claims');
  console.log('  help          - Show this help message\n');
  console.log('Examples:');
  console.log('  node scripts/index.js db:inspect');
  console.log('  node scripts/index.js rewards:claim dry-run --backups-dir ./exports');
  console.log('  pnpm db:inspect  # Using package.json scripts');
}

function runScript(command) {
  const scriptPath = commands[command];
  
  if (!scriptPath) {
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  const fullPath = path.join(__dirname, scriptPath);
  
  console.log(`🚀 Running: ${command}`);
  console.log(`📁 Script: ${scriptPath}\n`);

  // Determine if it's a shell script or node script
  const isShellScript = scriptPath.endsWith('.sh');
  const isTypeScript = scriptPath.endsWith('.ts');
  const executor = isShellScript ? 'bash' : isTypeScript ? 'pnpm' : 'node';
  const extraArgs = process.argv.slice(3);
  const executorArgs = isShellScript
    ? [fullPath, ...extraArgs]
    : isTypeScript
      ? ['exec', 'tsx', fullPath, ...extraArgs]
      : [fullPath, ...extraArgs];

  const child = spawn(executor, executorArgs, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`\n❌ Script failed with exit code ${code}`);
      process.exit(code);
    }
    console.log(`\n✅ Script completed successfully`);
  });

  child.on('error', (error) => {
    console.error(`\n💥 Failed to run script: ${error.message}`);
    process.exit(1);
  });
}

// Parse command line arguments
const command = process.argv[2];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

runScript(command);
