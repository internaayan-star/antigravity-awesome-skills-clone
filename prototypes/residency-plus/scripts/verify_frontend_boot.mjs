import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
const logFile = path.join(LOG_DIR, `verify_frontend_boot_${timestamp}.log`);

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  fs.appendFileSync(logFile, text);
  process.stdout.write(text);
}

async function main() {
  log("Starting frontend boot verification...");

  let playwright;
  try {
    playwright = await import("playwright");
  } catch (err) {
    log("Playwright not available. Install 'playwright' to enable frontend smoke tests.");
    process.exitCode = 1;
    return;
  }

  const { chromium } = playwright;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      const text = msg.text();
      consoleErrors.push(text);
      log(`Console error: ${text}`);
    }
  });

  try {
    log("Navigating to http://localhost:8888/ ...");
    await page.goto("http://localhost:8888/", { waitUntil: "load", timeout: 30000 });

    // Wait for the main shell to appear
    await page.waitForSelector(".shell", { timeout: 15000 });

    // Check for parse/runtime errors
    const fatalError = consoleErrors.find(t =>
      /uncaught/i.test(t) && /(syntaxerror|referenceerror)/i.test(t)
    );
    if (fatalError) {
      log("Detected fatal console error during boot.");
      process.exitCode = 1;
      return;
    }

    // Check that the current result/title area is not blank/placeholder
    const trackTitle = await page.$("#trackTitle");
    const titleText = trackTitle ? (await trackTitle.textContent() || "").trim() : "";
    if (!titleText || titleText === "—") {
      log("Track title is still blank/placeholder after boot.");
      process.exitCode = 1;
      return;
    }
    log(`Track title after boot: "${titleText}"`);

    // Verify theme toggle changes body[data-theme]
    const themeBefore = await page.evaluate(() => document.body.getAttribute("data-theme"));
    const themeBtn = await page.$("#themeBtn");
    if (!themeBtn) {
      log("Theme button not found.");
      process.exitCode = 1;
      return;
    }
    await themeBtn.click();
    await page.waitForTimeout(500);
    const themeAfter = await page.evaluate(() => document.body.getAttribute("data-theme"));
    if (themeBefore === themeAfter) {
      log(`Theme did not change after toggle (still '${themeAfter}').`);
      process.exitCode = 1;
      return;
    }
    log(`Theme changed from '${themeBefore}' to '${themeAfter}'.`);

    log("Frontend boot verification PASS.");
    process.exitCode = 0;
  } catch (err) {
    log(`Frontend verification failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();

