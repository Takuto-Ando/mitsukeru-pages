import fs from "node:fs";
import ts from "typescript";
import { p, eye } from "./animal-parts.mjs";
const mod = {};
new Function(
  "exports",
  ts.transpileModule(fs.readFileSync("src/content/materialTasks.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(mod);
const { materialTasks } = mod;
const dir = "public/illustrations/whole";
const ink = "#665b50",
  paper = "#fbf4e6";
const line = (d, w = 5, color = ink) =>
  p(d, "none", w).replaceAll(`stroke="${ink}"`, `stroke="${color}"`);
const read = (id) =>
  fs
    .readFileSync(`${dir}/${id}-complete.svg`, "utf8")
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
// New species are drawn independently; siblings reuse only their own species.
const bear =
  p(
    "M180 275Q300 230 420 275L465 452Q432 508 300 502Q168 508 135 452Z",
    "#414b48",
  ) +
  p(
    "M184 308Q111 338 104 478Q95 524 140 520L192 422M416 308Q489 338 496 478Q505 524 460 520L408 422",
    "#343f3c",
    10,
  ) +
  p(
    "M197 459L169 551Q217 574 265 550L279 480M403 459L431 551Q383 574 335 550L321 480",
    "#414b48",
  ) +
  p(
    "M184 154Q116 118 148 78Q182 47 220 107M416 154Q484 118 452 78Q418 47 380 107",
    "#414b48",
  ) +
  p(
    "M182 137Q206 77 300 80Q394 77 418 137L430 235Q406 298 300 307Q194 298 170 235Z",
    "#414b48",
  ) +
  eye(242, 181) +
  eye(358, 181) +
  p("M250 232Q300 207 350 232L341 269Q300 293 259 269Z", "#a58d70", 4) +
  p("M284 235Q300 226 316 235L300 251Z", "#303b36", 3) +
  line("M300 250V265M283 269Q300 278 317 269", 3) +
  line(
    "M183 534l-4 19M203 539l-1 18M224 539v18M376 539v18M397 539l1 18M417 534l4 19",
    3,
    "#e8d4b7",
  );
const tapir =
  p(
    "M212 333Q285 250 440 292Q520 310 514 408L483 470Q354 490 232 440Z",
    "#938774",
  ) +
  p(
    "M246 421L237 543L283 543L303 451M433 440L449 543L491 543L489 406M315 451L327 519L359 519L352 458",
    "#7c7263",
  ) +
  p(
    "M210 344Q158 373 113 351L81 373Q50 382 43 352L61 314Q79 269 142 254L201 249L257 292Z",
    "#9c907a",
  ) +
  p(
    "M137 261Q104 206 134 197Q164 189 180 245M204 254Q195 205 221 203Q251 206 240 269",
    "#7c7263",
  ) +
  p("M141 231Q139 215 146 214M219 234Q217 219 225 217", "none", 5) +
  eye(137, 292) +
  line("M66 344L77 343M92 358Q111 365 128 352", 4) +
  line("M505 366Q542 373 540 399", 9) +
  line("M249 535V549M266 534V549M461 535V549M478 534V549", 4);
const hyrax =
  p(
    "M166 352Q187 288 318 293Q461 278 491 368L487 455Q431 507 300 498Q189 496 157 433Z",
    "#aaa083",
  ) +
  p(
    "M204 443L189 531L246 531L267 476M399 474L420 530L470 530L456 439",
    "#9b9178",
  ) +
  p(
    "M150 294Q104 264 122 229Q144 203 181 246M276 255Q292 212 322 227Q346 250 318 280",
    "#a89d80",
  ) +
  p(
    "M143 268Q219 220 293 269L318 353Q287 407 200 401Q130 392 122 346Z",
    "#b7ad91",
  ) +
  eye(175, 304) +
  eye(267, 301) +
  p("M193 342Q212 330 230 342L212 358Z", "#766b56", 3) +
  line("M212 358V372M193 376Q211 383 231 374", 3) +
  line("M139 345L103 339M140 356L101 361M281 344L319 336M281 354L322 359", 2) +
  line("M209 522V535M225 522V535M438 520V533M453 519V533", 3);
const bushdog =
  p("M186 318Q276 271 426 316Q496 340 483 430Q375 482 216 435Z", "#8f6748") +
  p(
    "M162 409L163 478L233 478L249 436M399 439L413 533L462 533L453 413M269 450L285 523L321 523L317 449",
    "#6d503d",
  ) +
  p("M470 352Q538 333 552 372L546 389Q516 371 484 389", "#6d503d") +
  p(
    "M118 260Q75 220 101 190Q130 176 152 231M226 236Q248 188 276 214Q292 245 255 273",
    "#997251",
  ) +
  p(
    "M115 240Q179 211 240 246L267 315Q256 367 182 379Q107 374 96 325Z",
    "#ae8157",
  ) +
  eye(141, 280) +
  eye(220, 280) +
  p("M129 319Q179 298 229 319L217 350Q181 371 141 350Z", "#bf946a", 4) +
  p("M166 318Q181 308 196 318L181 333Z", "#534437", 3) +
  line("M181 333V345M165 350Q181 357 197 350", 3);
const macaqueFace =
  p(
    "M215 284Q300 248 385 284L423 464Q365 516 300 505Q235 516 177 464Z",
    "#bf9772",
  ) +
  p(
    "M210 321Q147 357 135 489L186 500L226 414M390 321Q453 357 465 489L414 500L374 414",
    "#b48a68",
    9,
  ) +
  p(
    "M228 468L200 552L266 552L286 490M372 468L400 552L334 552L314 490",
    "#bf9772",
  ) +
  p(
    "M186 160Q131 143 143 109Q170 79 212 113M414 160Q469 143 457 109Q430 79 388 113",
    "#c5a07d",
  ) +
  p(
    "M190 125Q221 81 300 82Q379 81 410 125L407 249Q378 303 300 311Q222 303 193 249Z",
    "#c5a07d",
  ) +
  p(
    "M234 137Q266 106 300 132Q334 106 366 137L368 245Q342 283 300 288Q258 283 232 245Z",
    "#dda49a",
    4,
  ) +
  eye(268, 174) +
  eye(332, 174) +
  line("M294 207L306 207M276 250Q300 263 324 250", 4) +
  line("M407 390Q532 415 519 497", 10);
const gorillaBack =
  p(
    "M170 212Q300 154 430 212L466 439Q407 507 300 491Q193 507 134 439Z",
    "#686a61",
  ) +
  p(
    "M179 242Q92 294 77 481Q69 529 119 524L177 414M421 242Q508 294 523 481Q531 529 481 524L423 414",
    "#5b5e57",
    13,
  ) +
  p(
    "M193 438L163 549L252 549L278 474M407 438L437 549L348 549L322 474",
    "#686a61",
  ) +
  p(
    "M205 206Q194 108 254 89Q300 62 346 89Q406 108 395 206Q300 246 205 206Z",
    "#65685e",
  ) +
  line(
    "M236 131l5 16M263 116l5 18M296 108v17M326 117l-3 16M351 133l-5 16",
    3,
    "#969788",
  );

const newBases = {
  bear,
  tapir,
  hyrax,
  "bush-dog": bushdog,
  "macaque-face": macaqueFace,
  "gorilla-back": gorillaBack,
};
const featureColors = {
  bear: "#f6edda",
  tapir: "#746553",
  "gibbon-face": "#eee0c5",
  "hippo-skin": "#c47e6d",
  "gorilla-back": "#b7b8ab",
  "bush-dog": "#ad8059",
};
function make(t) {
  let base = newBases[t.id] || read(t.base);
  let feature = line(t.answerPath, 5);
  if (featureColors[t.id])
    feature = p(
      t.answerPath,
      featureColors[t.id],
      t.id === "gibbon-face" ? 12 : 3,
    );
  if (t.id === "gibbon-face") {
    // A dark face stays visible in the white fur ring; retain the two eyes.
    base = base.replace(/fill="#eee0c5"/g, 'fill="#a99b80"');
    feature = line(t.answerPath, 11, "#eee0c5");
  }
  if (t.id === "lemur-tail") {
    base = base.replace(
      /<path d="M367 400Q519 288 521 468Q508 579 358 555"[^>]*\/>/,
      line("M367 400Q519 288 521 468Q508 579 358 555", 45) +
        line("M367 400Q519 288 521 468Q508 579 358 555", 35, "#c4c5ba"),
    );

    // Remove only the pre-existing dark rings, not the tail outline.
    base = base.replace(
      /<path d="M493 375L524 389M491 424L532 438M477 481L514 503M422 523L443 556"[^>]*\/>/,
      "",
    );
    feature = line(t.answerPath, 16, "#665b50");
  }
  if (t.id === "hippo-tail") {
    base = base.replace(/<path d="M488 345Q546 350 552 390"[^>]*\/>/, "");
    feature = p(t.answerPath, "#b99fa4", 4);
  }
  if (t.id === "giraffe-horns")
    base = base.replace(/<path d="M181 116L170 75M248 110L254 66"[^>]*\/>/, "");
  if (t.id === "hyrax") {
    // Hide only the missing rump contour. The fur colour remains inside the body.
    const fills = base.replace(/stroke="[^"]*"/g, 'stroke="none"');
    const lines = base.replace(/fill="[^"]*"/g, 'fill="none"');
    base = `${fills}<defs><mask id="rump"><rect width="600" height="600" fill="white"/><rect x="365" y="300" width="155" height="190" fill="black"/></mask></defs><g mask="url(#rump)">${lines}</g>`;
    feature = line(t.answerPath, 6);
  }
  const root = (s, mode) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" data-full-animal="${t.id}" data-illustration="${mode}"><rect width="600" height="600" fill="${paper}"/>${s}</svg>`;
  fs.writeFileSync(`${dir}/${t.id}.svg`, root(base, "incomplete"));
  fs.writeFileSync(
    `${dir}/${t.id}-complete.svg`,
    root(base + feature, "complete"),
  );
}
export function createMaterialIllustrations() {
  for (const t of materialTasks) make(t);
}
if (process.argv[1]?.endsWith("create-material-illustrations.mjs"))
  createMaterialIllustrations();
