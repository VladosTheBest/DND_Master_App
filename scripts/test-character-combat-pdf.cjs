const fs = require("node:fs"),
  path = require("node:path"),
  { buildSync } = require("esbuild");
const out = "tmp/character-combat-pdf";
fs.mkdirSync(out, { recursive: true });
buildSync({
  entryPoints: ["apps/web/src/features/characters/character-pdf.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(out, "pdf.cjs"),
  define: { "import.meta.env.BASE_URL": '"/"' },
});
const { createCharacterPdf } = require("../" + out + "/pdf.cjs");
const fixtures = JSON.parse(
  fs.readFileSync(
    "apps/server/internal/httpapi/character_catalog.json",
    "utf8",
  ),
).validationFixtures.filter((f) => f.valid);
const fonts = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map((f) =>
  fs.readFileSync("apps/web/public/fonts/" + f).toString("base64"),
);
const groups = new Map();
for (const f of fixtures) {
  const key = f.draft.classId + "-" + f.draft.edition;
  const old = groups.get(key);
  if (!old || Math.abs(f.draft.targetLevel - 5) < Math.abs(old.targetLevel - 5))
    groups.set(key, f.draft);
}
for (const [key, seed] of groups) {
  const d = structuredClone(seed);
  d.name = "Проверка боевого листа";
  d.playerName = "Тест";
  d.personality = {
    backstory: "Путешественник хранит старую клятву. ".repeat(30),
    ideals: "**Верность клятве.** Я защищаю друзей.",
  };
  d.equipment = [
    {
      name: "Боевой посох",
      type: "weapon",
      quantity: 1,
      twoHanded: true,
      equipped: true,
    },
  ];
  const pdf = createCharacterPdf(d, ...fonts);
  fs.writeFileSync(
    path.join(out, key + ".pdf"),
    Buffer.from(pdf.output("arraybuffer")),
  );
  console.log(key, pdf.getNumberOfPages());
}
