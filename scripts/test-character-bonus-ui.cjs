const { build } = require("esbuild");
const fs = require("fs");
const assert = require("assert/strict");
const {
  chromium,
} = require("C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  fs.mkdirSync("tmp", { recursive: true });
  const c = JSON.parse(
    fs.readFileSync(
      "apps/server/internal/httpapi/character_catalog.json",
      "utf8",
    ),
  );
  const d = structuredClone(
    c.validationFixtures.find(
      (f) =>
        f.valid &&
        f.draft.edition === "2014" &&
        f.draft.speciesId === "dragonborn",
    ).draft,
  );
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{CharacterBuilder}from'./apps/web/src/features/characters/CharacterBuilder';import'./apps/web/src/features/characters/characters.css';createRoot(document.getElementById('root')).render(<CharacterBuilder initialDraft={${JSON.stringify(d)}} storageKey="bonus-test" onComplete={()=>{}}/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: "tmp/bonus-ui",
    jsx: "automatic",
    define: {
      "import.meta.env.VITE_API_BASE_URL": '""',
      "import.meta.env.BASE_URL": '"/"',
    },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".ttf": "dataurl" },
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
    await page.route("https://bonus.test/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      const file = bundle.outputFiles.find((f) =>
        f.path.replaceAll(String.fromCharCode(92), "/").endsWith(path),
      );
      return route.fulfill({
        contentType: path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : "text/html",
        body: file
          ? file.text
          : '<meta charset="utf-8"><div id="root" class="ch-public" style="font-family:system-ui"></div><link rel="stylesheet" href="/stdin.css"><script src="/stdin.js"></script>',
      });
    });
    await page.goto("https://bonus.test/");
    await page
      .getByRole("button", { name: "Шаг 3: Характеристики", exact: true })
      .click();
    const toggle = page.getByRole("switch");
    await toggle.check();
    const dimensions = await toggle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { width: r.width, height: r.height, padding: s.padding };
    });
    assert.deepEqual(dimensions, { width: 44, height: 26, padding: "0px" });
    await page
      .locator(".ch-bonus-section")
      .screenshot({ path: "tmp/bonus-ui-fixed.png" });
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bonus-test")).draft
            .freeAbilityBonuses,
      ),
      true,
    );
    for (const index of [0, 0, 10, 9, 9, 5])
      await page.locator(".ch-bonus-section button").nth(index).click();
    assert.deepEqual(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bonus-test")).draft.abilityBonuses,
      ),
      { str: 0, dex: 0, con: 1, int: 0, wis: 2, cha: 0 },
    );
    await toggle.uncheck();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bonus-test")).draft.abilityBonuses
            .str,
      ),
      2,
    );
    await toggle.focus();
    await page.keyboard.press("Space");
    assert.equal(await toggle.isChecked(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator(".ch-bonus-section")
      .screenshot({ path: "tmp/bonus-ui-mobile.png" });
    assert.equal(
      await page
        .locator(".ch-public")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Шаг 5: 1 уровень", exact: true })
      .click();
    const gold = page.getByRole("button", { name: /^Золотой — огонь/ });
    await gold.scrollIntoViewIfNeeded();
    const card = gold;
    assert.match(await card.innerText(), /2d6 урона, конус 15 футов/);
    await card.screenshot({ path: "tmp/dragon-ancestry-mobile.png" });
    console.log(
      "Desktop/mobile dimensions, keyboard, allocation, persistence and ancestry description passed",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
