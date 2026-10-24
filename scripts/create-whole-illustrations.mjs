import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { finishIllustration } from "./illustration-finishing.mjs";
import { body, face, p, eye } from "./animal-parts.mjs";
const cache = {};
function load(f) {
  f = path.resolve(f);
  if (f.endsWith(".json"))
    return { default: JSON.parse(fs.readFileSync(f, "utf8")) };
  if (cache[f]) return cache[f];
  const ex = {};
  cache[f] = ex;
  new Function(
    "exports",
    "require",
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(ex, (q) =>
    load(path.resolve(path.dirname(f), q.endsWith(".json") ? q : q + ".ts")),
  );
  return ex;
}
const { tasks } = load("src/content/tasks.ts");
const { profiles } = load("src/content/profiles.ts");
const { fullBodyLayouts } = load("src/content/fullBodyLayouts.ts");
const ink = "#665b50",
  cream = "#fbf4e6";
const wrap = (id, s) => {
  const { x, y, scale } = fullBodyLayouts[id];
  return `<g transform="translate(${x} ${y}) scale(${scale})">${s}</g>`;
};
const sitting = (color) =>
  p(
    "M207 290Q300 265 393 290L433 452Q405 501 300 497Q195 501 167 452Z",
    color,
  ) +
  p(
    "M202 328Q145 354 113 483Q105 510 140 512L200 430M398 328Q455 354 487 483Q495 510 460 512L400 430",
    color,
    14,
  ) +
  p(
    "M207 456Q160 472 153 540Q202 576 260 547L272 483M393 456Q440 472 447 540Q398 576 340 547L328 483",
    color,
  );
const hoof = (x, y, w = 45) => p(`M${x} ${y}l-5 26h${w + 10}l-5 -26Z`, ink, 4);
function goat(sheep = false) {
  const wool = sheep
    ? p(
        "M260 305Q245 270 282 265Q285 230 325 250Q350 225 376 250Q411 230 430 260Q470 245 480 280Q519 281 505 319Q530 350 503 376Q516 412 478 423Q466 457 431 438Q400 465 375 442Q342 461 320 437Q283 448 279 412Q246 402 262 367Q239 340 260 305",
        "#eee1c3",
      )
    : p(
        "M250 300C314 261 394 262 465 291Q520 325 490 416Q386 462 277 413Q264 370 250 300Z",
        "#e4cba6",
      );
  const legs =
    p(
      "M288 397L278 548L316 548L333 423M433 416L453 548L490 548L474 393",
      "#d3b790",
    ) +
    p(
      "M332 417L340 521L369 521L367 431M407 432L415 522L444 522L439 415",
      "#cdb38f",
      4,
    ) +
    hoof(276, 543, 42) +
    hoof(450, 543, 42) +
    hoof(337, 516, 31) +
    hoof(411, 517, 33);
  const horns = sheep
    ? p(
        "M99 143Q56 80 113 64Q170 55 153 131M288 143Q339 78 288 62Q247 49 236 122",
        "#d1bc94",
      )
    : p(
        "M125 145Q93 61 150 36L155 125M250 130Q249 49 284 31L282 147",
        "#c9b78d",
      );
  const ears = p(
    "M108 165Q59 116 35 153Q48 203 108 200M289 160Q345 113 367 155Q348 197 300 201",
    "#e1c49a",
  );
  const head = p(
    "M113 130Q197 91 281 139Q297 201 305 270Q270 341 167 340Q94 324 86 254Q99 192 113 130Z",
    sheep ? "#ded1b5" : "#e8d0ad",
  );
  const mane = sheep
    ? p(
        "M105 146Q74 122 101 96Q96 62 131 69Q151 38 177 67Q203 42 224 70Q260 51 276 82Q310 76 310 108Q333 141 290 159",
        "#eee1c3",
        5,
      )
    : "";
  return (
    legs +
    p("M481 319Q548 283 555 321Q535 345 494 353", "#dfc49e") +
    wool +
    horns +
    ears +
    head +
    mane +
    `<ellipse cx="220" cy="220" rx="70" ry="47" fill="#dfb85e" stroke="${ink}" stroke-width="5"/>` +
    p("M100 280Q148 264 167 301Q163 329 129 324", "#efdcb7", 4) +
    p("M113 291L119 291M132 315Q145 324 156 313", "none", 4) +
    (!sheep ? p("M165 335L181 379L195 341", "#c8ad85", 4) : "")
  );
}
const zebraBase =
  p(
    "M195 304Q319 246 477 296L493 408Q392 450 253 417L223 518L178 518L189 372Z",
    "#eee5d2",
  ) +
  p(
    "M266 410L275 557L312 557L309 420M438 415L437 556L477 556L480 405M475 405L503 540L534 540L514 386",
    "#e8dfcc",
  ) +
  hoof(272, 553, 40) +
  hoof(435, 552, 42) +
  hoof(500, 535, 35) +
  p(
    "M188 314L139 256L91 235Q53 216 80 177L143 162L156 110Q190 85 209 140L240 232L244 305Z",
    "#f3ead6",
  ) +
  eye(137, 199) +
  p("M91 217L104 217M480 309Q546 340 540 398", "none", 7) +
  p("M177 125L181 93M206 150L227 116", "none", 12) +
  p(
    "M162 174L208 196M153 216L224 240M182 265L230 279M276 285L293 415M336 278L349 423M398 282L417 422M453 297L472 404M198 422L225 434M191 476L226 485",
    "none",
    10,
  );
const giraffeBase =
  p("M234 306Q329 272 436 313L457 422Q372 460 266 421Z", "#e5c488") +
  p(
    "M255 412L255 519L311 519L307 425M395 429L402 562L437 562L435 414M431 413L468 548L502 548L470 399M280 421L299 547L328 547L320 423",
    "#dfbc7f",
  ) +
  hoof(399, 556, 42) +
  hoof(466, 543, 38) +
  hoof(297, 542, 34) +
  p(
    "M231 327L167 306L169 173L157 122Q190 79 257 106L327 148Q353 171 329 194L254 190L259 305Z",
    "#e8cb91",
  ) +
  p("M181 116L170 75M248 110L254 66", "none", 11) +
  p(
    "M178 113Q129 76 117 110L161 145M258 120Q297 82 314 113L278 142",
    "#e0bb80",
    4,
  ) +
  eye(222, 143) +
  p("M315 166L327 166M436 332Q486 331 499 391", "none", 5) +
  p(
    "M187 202L216 193L228 222L194 233ZM196 256L229 247L235 279L202 288ZM275 333L304 318L325 348L295 363ZM346 330L380 320L390 350L357 365ZM401 376L429 369L440 396L411 410ZM261 461L285 456L291 483L263 490Z",
    "#b98454",
    3,
  );
const hippoBase =
  p(
    "M189 310Q232 217 375 232Q485 225 512 322L515 427Q373 478 215 425Z",
    "#c9b1b2",
  ) +
  p(
    "M234 423L224 549L271 549L291 442M431 443L450 549L498 549L487 419M284 442L305 525L335 525L325 452M393 454L407 523L438 523L427 444",
    "#bfa7aa",
  ) +
  p("M488 345Q546 350 552 390", "none", 8) +
  p(
    "M95 275Q81 230 116 228Q147 228 151 270M187 267Q196 223 225 242Q248 264 220 291",
    "#b99fa4",
  ) +
  p(
    "M77 287Q155 250 229 291L242 368Q224 405 146 408Q63 405 57 367Z",
    "#d3bcb7",
  ) +
  eye(112, 292) +
  eye(203, 292) +
  p("M77 377Q147 395 223 376", "none", 4);
const foxBase =
  p("M183 327Q282 284 392 340L401 448Q321 486 218 438Z", "#e1c49c") +
  p(
    "M174 432L174 471L222 471L237 443M327 458L340 540L376 540L376 440M229 437L247 529L278 529L272 451M376 439L403 523L433 523L417 421",
    "#dbbc91",
  ) +
  p(
    "M129 294L77 150Q76 115 101 127L175 244L232 126Q252 107 259 149L225 297Q208 338 163 338Q132 335 129 294Z",
    "#ead0a8",
  ) +
  p("M103 159L142 245L119 234ZM235 159L205 249L222 224Z", "#d4a98e", 3) +
  eye(154, 281) +
  eye(206, 281) +
  p("M172 306L187 306L180 315ZM180 315V327M164 328Q180 340 196 328", ink, 3);
const paw =
  p("M174 471Q156 501 165 532L235 532Q242 500 222 471", "#e4cba6") +
  p("M188 517V532M214 517V532", "none", 3);
const foxTail =
  p("M352 364Q459 401 547 469Q479 532 409 483Q366 452 338 416", "#e2c59a") +
  p("M510 444L547 469Q529 489 511 493L494 467Z", "#8f7964", 3);
const bases = {
  goat: goat(),
  sheep: goat(true),
  mandrill: sitting("#b99974") + face("mandrill"),
  lemur:
    p("M367 400Q519 288 521 468Q508 579 358 555", "none", 39) +
    p(
      "M493 375L524 389M491 424L532 438M477 481L514 503M422 523L443 556",
      "none",
      16,
    ) +
    sitting("#c4c5ba") +
    face("lemur"),
  badger:
    p("M231 330Q352 261 502 341L520 462Q409 520 243 466Z", "#c9bc9f") +
    p(
      "M246 450L232 550L276 550L292 466M441 465L463 551L503 551L489 449M306 477L316 527L349 527L350 484M393 484L402 528L431 528L426 474",
      "#b9ab90",
    ) +
    p("M508 376Q560 367 570 412L520 428", "#b8a98b") +
    wrap("badger", face("badger")),
  meerkat:
    p("M239 253Q300 225 361 253L381 491Q329 537 219 491Z", "#dfbe8d") +
    p("M245 311L233 400M355 311L367 400", "none", 17) +
    p(
      "M236 485L204 559L265 564L292 511M344 490L392 560L329 565L310 511",
      "#d5b181",
    ) +
    p("M359 469Q451 562 521 566Q471 586 379 545Z", "#d4b082") +
    wrap("meerkat", face("meerkat")),
  gorilla:
    p(
      "M176 258Q300 230 424 258L466 459Q411 504 300 491Q189 504 134 459Z",
      "#aaa59c",
    ) +
    p(
      "M178 293Q107 304 72 480Q61 529 109 532L169 437M422 293Q493 304 528 480Q539 529 491 532L431 437",
      "#99958c",
      14,
    ) +
    p(
      "M185 448Q148 475 154 548L253 551L277 484M415 448Q452 475 446 548L347 551L323 484",
      "#a29c92",
    ) +
    wrap("gorilla", face("gorilla")),
  gibbon:
    wrap("gibbon", body.gibbon) +
    p(
      "M109 132Q120 113 131 135L129 149L109 149ZM464 134Q475 113 486 134L486 149L466 149Z",
      "#eee0c5",
      4,
    ),
  elephant:
    p("M176 267Q300 238 424 267L446 461Q300 509 154 461Z", "#cbccc1") +
    p(
      "M176 439L158 542L194 542L218 456M388 456L406 542L442 542L424 439",
      "#bfc0b6",
    ) +
    p(
      "M214 444L211 566L268 566L281 463M322 463L335 566L392 566L390 444",
      "#d3d3c7",
    ) +
    p("M158 339Q110 382 113 441", "none", 8) +
    body.elephant,
  capuchin:
    wrap("capuchin", body.capuchin) +
    p("M140 415L159 415M248 425L267 425", "none", 10),
  macaque:
    wrap("macaque", body.macaque) +
    p("M220 468L264 468M337 468L380 468", "none", 10),
  zebra: zebraBase,
  giraffe: giraffeBase + hoof(250, 560, 65),
  "giraffe-hoof":
    giraffeBase + p(fullBodyLayouts.giraffe.answerPath, "#746271", 3),
  hippo: hippoBase,
  "hippo-body": hippoBase + p(fullBodyLayouts.hippo.answerPath, ink, 3),
  fennec: foxTail + foxBase,
  "fennec-tail": foxBase + paw,
  donkey: wrap("donkey", body.donkey),
  deer: wrap("deer", body.deer),
};
function features(t) {
  const id = t.id;
  if (id === "goat" || id === "sheep")
    return p(fullBodyLayouts[id].answerPath, "#4d4b40", 3);
  if (id === "zebra") return p(fullBodyLayouts[id].answerPath, ink, 4);
  if (id === "giraffe-hoof") return p(fullBodyLayouts[id].answerPath, ink, 4);
  if (id === "giraffe") return p(fullBodyLayouts[id].answerPath, "#746271", 3);
  if (id === "hippo") return p(fullBodyLayouts[id].answerPath, ink, 3);
  if (id === "fennec") return paw;
  if (id === "fennec-tail") return foxTail;
  if (["elephant", "gorilla", "hippo-body"].includes(id)) return "";
  const d = profiles[id]?.answer || "";
  if (id === "mandrill")
    return (
      p("M190 122Q222 105 244 126L238 249Q208 264 180 238Z", "#8cbbc0", 3) +
      p("M356 126Q380 105 410 122L420 238Q392 264 362 249Z", "#8cbbc0", 3) +
      `<path d="${d}" fill="none" stroke="#5b858e" stroke-width="5" stroke-linecap="round"/>`
    );
  if (["lemur", "badger", "meerkat"].includes(id)) {
    const shape = p(
      d,
      id === "badger" ? "none" : "#786e61",
      id === "badger" ? 25 : 4,
    );
    const pupils = `<circle cx="235" cy="180" r="16" fill="#d8b66e"/><circle cx="365" cy="180" r="16" fill="#d8b66e"/>${eye(235, 180)}${eye(365, 180)}`;
    return wrap(id, shape + pupils);
  }
  if (id === "macaque") return wrap(id, p(d, "#dda49a", 4));
  if (id === "gibbon")
    return wrap(
      id,
      `<path d="${d}" fill="none" stroke="#a99b80" stroke-width="19" stroke-linecap="round"/>`,
    );
  if (id === "capuchin")
    return wrap(
      id,
      `<path d="${d}" fill="none" stroke="#ad8a63" stroke-width="25" stroke-linecap="round"/>`,
    );
  return wrap(
    id,
    `<path d="${d}" fill="none" stroke="${id === "deer" ? "#f8efda" : "#746453"}" stroke-width="${id === "deer" ? 16 : 12}" stroke-linecap="round"/>`,
  );
}
fs.mkdirSync("public/illustrations/whole", { recursive: true });
for (const t of tasks) {
  const id = t.id;
  const base = bases[id];
  if (!base) throw Error(id);
  const feature = features(t);
  const root = (s, mode) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" data-full-animal="${id}" data-illustration="${mode}"><rect width="600" height="600" rx="28" fill="${cream}"/>${finishIllustration(id, s, t.scene)}</svg>`;
  let incomplete = base;
  // Missing contour only: preserve the animal's body colour, erase its ink contour in the target.
  if (["elephant", "gorilla", "hippo-body"].includes(id)) {
    const cut = t.scene.regions
      .map(
        (r) =>
          `<rect x="${r.x * 600}" y="${r.y * 600}" width="${r.width * 600}" height="${r.height * 600}" fill="black"/>`,
      )
      .join("");
    const fills = base.replace(/stroke="[^"]*"/g, 'stroke="none"');
    const lines = base.replace(/fill="[^"]*"/g, 'fill="none"');
    incomplete = `<defs><mask id="missing-contour"><rect width="600" height="600" fill="white"/>${cut}</mask></defs>${fills}<g mask="url(#missing-contour)">${lines}</g>`;
  }
  fs.writeFileSync(
    `public/illustrations/whole/${id}.svg`,
    root(incomplete, "incomplete"),
  );
  fs.writeFileSync(
    `public/illustrations/whole/${id}-complete.svg`,
    root(id === "fennec-tail" ? feature + base : base + feature, "complete"),
  );
}
