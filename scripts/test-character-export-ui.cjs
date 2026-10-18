const { build } = require("esbuild");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { unzipSync, strFromU8 } = require("fflate");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
(async () => {
  await fs.mkdir("tmp/character-export-qa", { recursive: true });
  const catalog = JSON.parse(
    await fs.readFile(
      "apps/server/internal/httpapi/character_catalog.json",
      "utf8",
    ),
  );
  const fixtures = catalog.validationFixtures;
  assert(fixtures);
  const draft =
    fixtures.find(
      (f) =>
        f.valid &&
        f.draft.edition === "2014" &&
        f.draft.classId === "fighter" &&
        f.draft.targetLevel === 3,
    )?.draft ||
    fixtures.find(
      (f) =>
        f.valid && f.draft.edition === "2014" && f.draft.classId === "fighter",
    ).draft;
  draft.name = "Владикаp";
  draft.playerName = "Тестовый игрок";
  draft.personality = {
    backstory:
      "Наследник древней клятвы. " +
      "Герой ищет своё место в мире. ".repeat(55),
    appearance: "Тёмный плащ, серебряные доспехи и шрам над левым глазом.",
    ideals: "Верность клятве",
    bonds: "Друзья",
    flaws: "Гордыня",
  };
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{CharacterSheet}from'./apps/web/src/features/characters/CharacterSheet';import{CharacterPortrait}from'./apps/web/src/features/characters/CharacterPortrait';import{CharacterEquipment}from'./apps/web/src/features/characters/CharacterEquipment';import{createCharacterPdf,characterPdfFile}from'./apps/web/src/features/characters/character-pdf';import{characterFoundryActor,characterFoundryMacro}from'./apps/web/src/features/characters/character-foundry';import'./apps/web/src/features/characters/characters.css';window.exports={createCharacterPdf,characterPdfFile,characterFoundryActor,characterFoundryMacro};function Test(){const[d,setD]=React.useState(${JSON.stringify(draft)});window.draft=d;return <main className="ch-public" style={{padding:24}}><CharacterEquipment draft={d} onChange={equipment=>setD({...d,equipment})}/><CharacterPortrait draft={d} onChange={portrait=>setD({...d,portrait})}/><CharacterSheet draft={d}/></main>}createRoot(document.getElementById('root')).render(<Test/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: "tmp/character-export-qa",
    jsx: "automatic",
    define: {
      "import.meta.env.VITE_API_BASE_URL": '""',
      "import.meta.env.BASE_URL": '"/"',
    },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".ttf": "dataurl" },
  });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const portrait = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#58346f" },
    })
      .jpeg()
      .toBuffer();
    let generationRequests = 0;
    let generationDescription = "";
    await page.route("http://character.test/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/api/characters/portrait") {
        generationRequests++;
        generationDescription = route.request().postDataJSON().description;
        return route.fulfill({
          json: {
            data: {
              image: "data:image/jpeg;base64," + portrait.toString("base64"),
            },
          },
        });
      }
      if (u.pathname === "/fonts/DejaVuSans.ttf")
        return route.fulfill({
          body: await fs.readFile("apps/web/public/fonts/DejaVuSans.ttf"),
          contentType: "font/ttf",
        });
      if (u.pathname === "/")
        return route.fulfill({
          contentType: "text/html",
          body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/test.css"><script src="/test.js"></script>',
        });
      return route.fulfill({
        contentType: u.pathname.endsWith(".css")
          ? "text/css"
          : "application/javascript",
        body: bundle.outputFiles.find((f) =>
          f.path.endsWith(u.pathname.endsWith(".css") ? ".css" : ".js"),
        ).text,
      });
    });
    await page.goto("http://character.test/");
    await page
      .getByRole("textbox", { name: "Предмет", exact: true })
      .fill("Longsword");
    await page
      .getByRole("button", { name: "Добавить предмет", exact: true })
      .click();
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "portrait.jpg",
        mimeType: "image/jpeg",
        buffer: portrait,
      });
    await page.waitForFunction(() =>
      window.draft?.portrait?.startsWith("data:image/jpeg;base64,"),
    );
    await page
      .getByRole("textbox", { name: "Описание для генерации (необязательно)" })
      .fill("Суровый взгляд");
    await page
      .getByRole("button", { name: "Сгенерировать портрет", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Сгенерировать портрет", exact: true })
      .waitFor();
    assert.equal(generationRequests, 1);
    assert(generationDescription.includes("Суровый взгляд"));
    assert(generationDescription.includes(draft.personality.appearance));
    const font = (
      await fs.readFile("apps/web/public/fonts/DejaVuSans.ttf")
    ).toString("base64");
    const result = await page.evaluate((font) => {
      const pdf = window.exports.createCharacterPdf(window.draft, font);
      const actor = window.exports.characterFoundryActor(window.draft);
      const macro = window.exports.characterFoundryMacro(window.draft);
      return {
        pdf: pdf.output("datauristring").split(",")[1],
        pages: pdf.getNumberOfPages(),
        actor,
        macro,
      };
    }, font);
    assert(result.pages >= 4);
    assert.equal(
      result.actor.system.attributes.hp.value,
      result.actor.system.attributes.hp.max,
    );
    assert(
      result.actor.items.some(
        (i) => i.type === "weapon" && i.name === "Longsword",
      ),
    );
    assert(result.macro.command.includes("Actor.create(data)"));
    await fs.writeFile(
      "tmp/character-export-qa/character-book.pdf",
      Buffer.from(result.pdf, "base64"),
    );
    await fs.writeFile(
      "tmp/character-export-qa/actor.json",
      JSON.stringify(result.actor),
    );
    await fs.writeFile(
      "tmp/character-export-qa/import-macro.json",
      JSON.stringify(result.macro),
    );
    for (const edition of ["2014", "2024"]) {
      const wizard =
        fixtures.find(
          (f) =>
            f.valid &&
            f.draft.edition === edition &&
            f.draft.classId === "wizard" &&
            f.draft.targetLevel === 5,
        )?.draft ||
        fixtures.find(
          (f) =>
            f.valid &&
            f.draft.edition === edition &&
            f.draft.classId === "wizard",
        ).draft;
      const exported = await page.evaluate(
        (d) => ({
          actor: window.exports.characterFoundryActor(d),
          macro: window.exports.characterFoundryMacro(d),
        }),
        wizard,
      );
      await fs.writeFile(
        `tmp/character-export-qa/wizard-${edition}.json`,
        JSON.stringify(exported),
      );
    }
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Экспорт в Foundry", exact: true })
      .click();
    const zipDownload = await downloaded;
    const archive = unzipSync(await fs.readFile(await zipDownload.path()));
    assert(archive["actor.json"]);
    assert(archive["import-macro.json"]);
    assert(archive["README.txt"]);
    assert.equal(JSON.parse(strFromU8(archive["actor.json"])).name, draft.name);
    // Execute the actual downloadable macro with a deterministic same-edition compendium.
    const macro = JSON.parse(strFromU8(archive["import-macro.json"]));
    const execution = await page.evaluate(async (macro) => {
      window.game = {
        world: { id: "test" },
        user: { isGM: true },
        system: { id: "dnd5e", version: "6.0.6" },
        packs: new Map([
          [
            "test",
            {
              documentName: "Item",
              metadata: { packageName: "dnd5e", name: "items" },
              getIndex: async () => [
                { _id: "sword", type: "weapon", name: "Longsword" },
              ],
              getDocument: async () => ({
                toObject: () => ({
                  name: "Longsword",
                  type: "weapon",
                  system: {
                    activities: { attack: { type: "attack" } },
                    quantity: 1,
                  },
                }),
              }),
            },
          ],
        ]),
      };
      window.foundry = {
        utils: { randomID: () => "testportrait" },
        applications: {
          apps: {
            FilePicker: {
              implementation: {
                upload: async () => ({ path: "worlds/test/portrait.jpg" }),
              },
            },
          },
        },
      };
      window.ui = { notifications: { warn() {}, error() {}, info() {} } };
      let data;
      window.Actor = {
        create: async (value) => {
          data = value;
          return { ...value, sheet: { render() {} } };
        },
      };
      window.Dialog = class {
        render() {}
      };
      await new (Object.getPrototypeOf(async function () {}).constructor)(
        macro.command,
      )();
      return data;
    }, macro);
    assert(
      execution.items.find((i) => i.name === "Longsword").system.activities
        .attack,
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.sharedFile = {
            name: data.files[0].name,
            type: data.files[0].type,
            size: data.files[0].size,
          };
        },
      });
    });
    await page
      .getByRole("button", { name: "Поделиться PDF", exact: true })
      .click();
    await page.waitForFunction(() => window.sharedFile);
    const shared = await page.evaluate(() => window.sharedFile);
    assert.equal(shared.type, "application/pdf");
    assert(shared.size > 1000);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      });
    });
    const fallback = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Поделиться PDF", exact: true })
      .click();
    assert((await fallback).suggestedFilename().endsWith(".pdf"));
    await page.screenshot({
      path: "tmp/character-export-qa/desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    );
    await page.screenshot({
      path: "tmp/character-export-qa/mobile.png",
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        pages: result.pages,
        zipFiles: Object.keys(archive),
        generationContext: true,
        share: true,
        fallback: true,
        macroWeaponActivity: true,
        mobile: true,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
