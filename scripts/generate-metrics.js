#!/usr/bin/env node

/**
 * Spellbook Metrics Generator
 * 
 * Generates .kiro/metrics.json from:
 * - .kiro/conversations/ (Kiro chat logs)
 * - .kiro/timesheet.md (time tracking)
 * - Source files with // kiro-generated comments
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

const ROOT = resolve(process.cwd());
const KIRO_DIR = join(ROOT, '.kiro');
const CONVERSATIONS_DIR = join(KIRO_DIR, 'conversations');
const TIMESHEET_PATH = join(KIRO_DIR, 'timesheet.md');
const OUTPUT_PATH = join(KIRO_DIR, 'metrics.json');

async function countKiroFeatures(conversationsDir) {
  const features = {
    specs: 0,
    steering: 0,
    vibe_coding: 0,
    context_file: 0,
    context_folder: 0,
    mcp_tools: 0,
    hooks: 0
  };

  try {
    const files = await readdir(conversationsDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await readFile(join(conversationsDir, file), 'utf-8');
      
      // Count feature mentions
      features.specs += (content.match(/spec|requirements\.md|design\.md|tasks\.md/gi) || []).length;
      features.steering += (content.match(/steering|spell-architect/gi) || []).length;
      features.vibe_coding += (content.match(/vibe|generate|create.*component/gi) || []).length;
      features.context_file += (content.match(/#File|#file/g) || []).length;
      features.context_folder += (content.match(/#Folder|#folder/g) || []).length;
      features.mcp_tools += (content.match(/mcp|tool|spellbook/gi) || []).length;
      features.hooks += (content.match(/hook|automat/gi) || []).length;
    }
  } catch (e) {
    // Directory might not exist yet
  }

  return features;
}

async function countCodeLines(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let total = 0;
  let kiroGenerated = 0;

  async function walk(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('dist')) {
          await walk(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          const content = await readFile(fullPath, 'utf-8');
          const lines = content.split('\n').length;
          total += lines;
          if (content.includes('// kiro-generated') || content.includes('/* kiro-generated */')) {
            kiroGenerated += lines;
          }
        }
      }
    } catch (e) {
      // Directory might not exist
    }
  }

  await walk(dir);
  return { total, kiroGenerated, manual: total - kiroGenerated };
}

async function parseTimesheet(timesheetPath) {
  try {
    const content = await readFile(timesheetPath, 'utf-8');
    const timeMatches = content.match(/(\d+(?:\.\d+)?)\s*h/gi) || [];
    const totalHours = timeMatches.reduce((sum, match) => {
      const num = parseFloat(match);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    return { totalHours, manualEstimate: totalHours * 4 }; // Assume 4x without Kiro
  } catch (e) {
    return { totalHours: 0, manualEstimate: 0 };
  }
}

async function generateMetrics() {
  console.log('🔮 Generating Spellbook metrics...\n');

  const kiroFeatures = await countKiroFeatures(CONVERSATIONS_DIR);
  const codeMetrics = await countCodeLines(ROOT);
  const timeMetrics = await parseTimesheet(TIMESHEET_PATH);

  const metrics = {
    generated_at: new Date().toISOString(),
    kiro_features_used: kiroFeatures,
    code_metrics: {
      total_lines: codeMetrics.total,
      kiro_generated: codeMetrics.kiroGenerated,
      manual_written: codeMetrics.manual,
      kiro_percentage: codeMetrics.total > 0 
        ? Math.round((codeMetrics.kiroGenerated / codeMetrics.total) * 100) 
        : 0
    },
    time_metrics: {
      total_hours: timeMetrics.totalHours,
      manual_estimate: timeMetrics.manualEstimate,
      time_saved: timeMetrics.manualEstimate - timeMetrics.totalHours,
      efficiency_gain: timeMetrics.manualEstimate > 0
        ? Math.round(((timeMetrics.manualEstimate - timeMetrics.totalHours) / timeMetrics.manualEstimate) * 100)
        : 0
    }
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(metrics, null, 2));

  console.log('📊 Metrics Summary:');
  console.log(`   Total lines: ${metrics.code_metrics.total_lines}`);
  console.log(`   Kiro generated: ${metrics.code_metrics.kiro_percentage}%`);
  console.log(`   Time saved: ${metrics.time_metrics.time_saved}h (${metrics.time_metrics.efficiency_gain}%)`);
  console.log(`\n✅ Saved to ${OUTPUT_PATH}`);
}

generateMetrics().catch(console.error);
