#!/usr/bin/env node

/**
 * Pretext.js Performance Benchmark Script
 * 
 * Automatically tests performance with/without Pretext.js virtual scrolling
 * and generates comparison screenshots.
 * 
 * Usage:
 *   node scripts/benchmark-pretext.js
 * 
 * Output:
 *   - benchmark-without-pretext.png
 *   - benchmark-with-pretext.png
 *   - benchmark-report.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TEST_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../benchmark-results');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runBenchmark(enablePretext) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`\n🧪 Testing ${enablePretext ? 'WITH' : 'WITHOUT'} Pretext.js...\n`);

  // Navigate to page
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // Set feature flag
  await page.evaluate((enabled) => {
    if (enabled) {
      localStorage.setItem('feature_PRETEXT_VIRTUAL_SCROLL', 'true');
    } else {
      localStorage.removeItem('feature_PRETEXT_VIRTUAL_SCROLL');
    }
  }, enablePretext);

  // Reload with flag applied
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for posts to render

  // Start performance profiling
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');

  // Start tracing
  await page.evaluate(() => performance.mark('scroll-start'));

  // Scroll behavior
  const scrollMetrics = await page.evaluate(async () => {
    const scrollContainer = document.querySelector('#scrollableDiv');
    if (!scrollContainer) throw new Error('Scroll container not found');

    const startTime = performance.now();
    let frameCount = 0;
    let totalFrameTime = 0;
    const frameTimes = [];

    return new Promise((resolve) => {
      let lastTime = startTime;
      let scrollTop = 0;
      const scrollStep = 100; // Pixels per frame
      const duration = 5000; // 5 seconds

      const scrollInterval = setInterval(() => {
        const now = performance.now();
        const frameTime = now - lastTime;
        frameTimes.push(frameTime);
        totalFrameTime += frameTime;
        frameCount++;
        lastTime = now;

        scrollTop += scrollStep;
        scrollContainer.scrollTop = scrollTop;

        if (now - startTime > duration) {
          clearInterval(scrollInterval);
          
          const avgFPS = frameCount / (totalFrameTime / 1000);
          const minFrameTime = Math.min(...frameTimes);
          const maxFrameTime = Math.max(...frameTimes);
          const avgFrameTime = totalFrameTime / frameCount;

          resolve({
            avgFPS,
            minFPS: 1000 / maxFrameTime,
            maxFPS: 1000 / minFrameTime,
            avgFrameTime,
            totalFrames: frameCount,
          });
        }
      }, 16); // ~60fps target
    });
  });

  await page.evaluate(() => performance.mark('scroll-end'));

  // Get performance metrics
  const performanceMetrics = await session.send('Performance.getMetrics');
  
  // Take screenshot
  const screenshotPath = path.join(
    OUTPUT_DIR,
    `benchmark-${enablePretext ? 'with' : 'without'}-pretext.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log(`✅ Screenshot saved: ${screenshotPath}`);
  console.log(`📊 Metrics:`, scrollMetrics);

  await browser.close();

  return {
    enabled: enablePretext,
    ...scrollMetrics,
    metrics: performanceMetrics.metrics,
    screenshot: screenshotPath,
  };
}

async function main() {
  console.log('🚀 Starting Pretext.js Performance Benchmark\n');
  console.log(`Testing URL: ${URL}\n`);

  // Test without Pretext.js
  const withoutPretext = await runBenchmark(false);
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test with Pretext.js
  const withPretext = await runBenchmark(true);

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    url: URL,
    without: withoutPretext,
    with: withPretext,
    improvement: {
      fpsGain: ((withPretext.avgFPS - withoutPretext.avgFPS) / withoutPretext.avgFPS * 100).toFixed(2) + '%',
      frameTimeReduction: ((withoutPretext.avgFrameTime - withPretext.avgFrameTime) / withoutPretext.avgFrameTime * 100).toFixed(2) + '%',
    }
  };

  const reportPath = path.join(OUTPUT_DIR, 'benchmark-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📄 Report saved:', reportPath);
  console.log('\n📊 Summary:');
  console.log('─────────────────────────────────────────');
  console.log(`Without Pretext.js: ${withoutPretext.avgFPS.toFixed(2)} FPS avg`);
  console.log(`With Pretext.js:    ${withPretext.avgFPS.toFixed(2)} FPS avg`);
  console.log(`Improvement:        ${report.improvement.fpsGain}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(console.error);
