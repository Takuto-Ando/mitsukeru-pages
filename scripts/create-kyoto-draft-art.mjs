import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const data = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const catalog = data("../src/content/kyoto-catalog.json");
const out = new URL("../public/illustrations/kyoto/", import.meta.url);
mkdirSync(out, { recursive: true });

const path = (d, fill = "none", width = 5) =>
  `<path d="${d}" fill="${fill}" stroke-width="${width}"/>`;
const ellipse = (x, y, rx, ry, fill) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const eye = (x, y) => ellipse(x, y, 9, 10, "#302e2e");
const warm = "#f5d9ac";
const dark = "#514844";

// Each silhouette has its own observation anchor. Coordinates are in the
// same full-animal 600 × 600 viewBox as the drawing and the comparison.
const mammal =
  "M116 372Q93 308 165 273Q236 235 335 282Q371 239 410 247Q454 244 477 290L515 318Q520 340 476 355L432 352Q415 400 414 447Q393 466 366 448L356 387Q305 415 219 394L196 451Q176 462 150 448L146 395Z";
const bird =
  "M111 390Q160 362 208 312Q270 255 338 270Q349 213 408 208Q460 210 471 264Q475 326 423 365Q376 425 262 422Q207 413 164 413Z";
const shell =
  "M107 368Q124 288 188 259Q261 226 354 254Q404 277 432 332Q451 294 484 304Q515 310 510 336Q505 360 454 372L438 396L457 429Q421 446 387 425L371 395Q265 421 183 396L164 430Q139 442 116 423L132 388Z";
const turtleAnswer =
  "M150 356Q276 322 409 353M185 346Q176 308 211 276M254 335Q243 280 274 253M332 336Q343 296 324 259M381 344Q390 324 378 280";
const ear = "M391 263Q381 216 400 193Q431 186 442 214Q441 235 424 260";
const beak = "M461 258Q505 258 535 283Q496 294 464 281Z";
const wing = "M224 353Q285 298 360 317Q342 384 267 397Q237 390 224 353Z";
const longBeak = "M452 234L544 250L456 251Z";
const snakeTurn =
  "M276 396C174 410 95 382 104 328Q114 266 248 287L263 318Q164 309 151 338Q144 358 270 350Z";
const lizardTail =
  "M270 367Q177 359 118 390Q80 409 68 382Q62 420 111 427Q180 416 270 405Z";
const toe = "M161 391Q174 426 216 430L198 442L232 442L211 458Q170 451 148 431";
const variants = (x, y, count, offset = 0) =>
  Array.from({ length: count }, (_, i) =>
    ellipse(
      x + i * 23,
      y + ((i + offset) % 3) * 12,
      7,
      3 + (offset % 4),
      "#fff7e6",
    ),
  ).join("");
const shapes = {
  rabbit: [
    "耳",
    [342, 103, 127, 173],
    "M374 268Q341 170 371 121Q401 112 419 252M416 254Q415 161 443 132Q476 130 449 268",
    (c) => ellipse(115, 342, 43, 36, warm) + path(mammal, c) + eye(450, 288),
  ],
  cat: [
    "耳",
    [366, 147, 112, 132],
    "M380 257Q368 185 389 166L421 240Q443 187 460 188L467 269",
    (c, v) =>
      path("M159 385Q66 423 78 343Q82 325 102 328Q93 392 165 346Z", c) +
      path(mammal, c) +
      eye(458, 292) +
      variants(198, 308, 7, v),
  ],
  rodent: [
    "耳",
    [365, 169, 96, 117],
    ear,
    (c) =>
      path(mammal, c) +
      path(
        "M117 362Q250 361 301 278Q333 274 365 296Q321 385 258 402Q174 404 117 362Z",
        warm,
      ) +
      eye(450, 290),
  ],
  canid: [
    "耳",
    [370, 149, 104, 124],
    "M381 258L383 167Q393 158 427 236Q445 197 462 201L467 265",
    (c, v) =>
      path("M165 302Q85 293 54 370Q101 372 174 350Z", v === 0 ? "#a4937d" : c) +
      path(mammal, c) +
      path("M475 311Q488 306 515 318L509 334L490 336Z", warm) +
      eye(451, 291),
  ],
  squirrel: [
    "尾",
    [35, 104, 161, 245],
    "M163 339Q69 321 56 259Q44 202 83 157Q131 112 174 144Q199 185 154 223Q114 268 171 291Z",
    (c, v) =>
      path(mammal, c) +
      path(ear, c) +
      eye(453, 287) +
      (v
        ? path("M161 340Q256 378 352 340L348 390Q218 423 161 390Z", warm)
        : ellipse(354, 342, 43, 31, warm)),
  ],
  porcupine: [
    "背中の針",
    [55, 128, 305, 187],
    "M114 300L75 208L161 251L102 165L208 244L170 156L267 241L246 177L317 264",
    (c) => path(mammal, c) + path(ear, c) + eye(463, 299),
  ],
  primate: [
    "耳",
    [336, 203, 96, 129],
    "M403 303Q342 321 345 258Q344 215 377 214Q408 211 411 266",
    (c, v) =>
      ellipse(269, 354, 116, 117, c) +
      ellipse(227, 435, 92, 33, c) +
      ellipse(381, 291, 111, 42, c) +
      ellipse(434, 266, 77, 80, c) +
      ellipse(450, 275, 55, 52, warm) +
      eye(436, 257) +
      eye(478 - v * 4, 256),
  ],
  sloth: [
    "前足",
    [257, 85, 166, 200],
    "M278 266Q280 200 318 168L338 131L370 113L394 125L374 148Q315 210 322 268Z",
    (c) =>
      path("M63 132Q302 132 537 98M70 149Q285 151 545 115", "#bca084") +
      path(
        "M187 230Q157 347 306 391Q418 413 427 311Q418 265 365 266L307 237L240 230L211 147L168 147Z",
        c,
      ) +
      ellipse(383, 318, 48, 42, warm) +
      eye(398, 307),
  ],
  bat: [
    "翼",
    [25, 135, 241, 277],
    "M264 265Q208 159 51 156Q81 204 46 281Q103 240 131 331Q177 287 198 395Q214 324 274 343Z",
    (c) =>
      path(
        "M329 264Q391 155 548 156Q523 215 558 281Q503 240 474 331Q433 287 400 395Q381 325 326 343Z",
        c,
      ) +
      ellipse(300, 325, 53, 92, c) +
      path("M262 253L262 202L283 225L320 225L341 205L338 266Z", c) +
      eye(288, 247) +
      eye(318, 247),
  ],
  bird: [
    "くちばし",
    [438, 229, 115, 90],
    beak,
    (c, v) =>
      path(bird, c) +
      path(wing, "#e3c7a3") +
      eye(431, 250) +
      path(`M300 412L${295 + v * 4} 457L276 464M330 408L343 453L362 457`),
  ],
  fowl: [
    "尾羽",
    [21, 229, 218, 183],
    "M216 377Q104 372 42 251Q133 271 232 330Q120 316 61 313Q122 373 197 387Z",
    (c, v) =>
      path(bird, c) +
      path(beak, warm) +
      eye(436, 252) +
      variants(230, 350, 7, v) +
      path("M313 412L306 455L287 462M349 411L363 459L381 461"),
  ],
  duck: [
    "くちばし",
    [431, 230, 126, 93],
    "M461 261Q493 266 532 258Q552 282 521 293L460 291Z",
    (c, v) =>
      path("M67 410Q106 415 148 405M426 433Q485 438 531 427", "none", 3) +
      path(bird, c) +
      path(wing, v === 6 ? "#bfc9b3" : warm) +
      (v === 6 ? ellipse(404, 261, 52, 47, "#547962") : "") +
      eye(428, 250),
  ],
  owl: [
    "顔のふち",
    [207, 124, 189, 180],
    "M226 190Q233 154 275 171L302 187Q339 152 371 177Q397 214 365 265Q321 296 300 280Q278 295 240 263Q211 234 226 190Z",
    (c, v) =>
      path(
        "M194 259Q165 173 228 139L245 130Q304 161 372 130Q427 170 412 254Q452 390 348 450Q297 475 247 448Q165 395 194 259Z",
        c,
      ) +
      eye(266, 211) +
      eye(334, 211) +
      path("M285 238L313 233L299 262Z", warm) +
      variants(234, 327, 7, v),
  ],
  raptor: [
    "くちばし",
    [413, 219, 117, 110],
    "M452 249Q506 229 513 264Q514 282 490 305L492 280L459 281Z",
    (c, v) =>
      path(bird, c) +
      path(wing, "#ad9e88") +
      variants(258, 352, 4, v) +
      eye(425, 252) +
      path("M314 411L307 453L285 468M347 405L359 448L382 457"),
  ],
  parrot: [
    "くちばし",
    [413, 183, 113, 146],
    "M441 221Q497 200 512 239Q521 270 487 298L489 263L443 274Z",
    (c, v) =>
      path("M235 355L90 498L183 475L288 389Z", c) +
      path(bird, c) +
      path(
        "M366 222Q387 161 428 144Q451 152 441 172Q403 194 412 210Z",
        v ? "#bfbc7e" : "#d4a28a",
      ) +
      path(wing, "#dec19b") +
      eye(417, 236),
  ],
  runner: [
    "首の輪郭",
    [303, 142, 148, 218],
    "M324 332Q363 290 345 214Q327 151 384 164Q423 176 410 209Q391 220 392 259Q398 302 365 343Z",
    (c) =>
      ellipse(242, 357, 140, 78, c) +
      path(
        "M282 416L289 462L265 529L286 531L317 465L312 420M219 416L229 472L208 532L235 529L260 467L249 417",
        warm,
      ) +
      path("M391 180L444 201L404 208Z", warm) +
      eye(380, 183),
  ],
  wader: [
    "くちばし",
    [428, 200, 140, 93],
    longBeak,
    (c, v) =>
      path(
        "M106 365Q160 307 271 334Q339 356 350 273Q349 201 409 193Q464 188 469 241Q459 273 425 281Q403 294 400 334Q389 431 263 428Q178 429 106 365Z",
        c,
      ) +
      path("M250 417L246 487L234 535L268 537M291 417L298 492L329 535L349 534") +
      eye(431, 226) +
      (v <= 1 ? ellipse(417, 204, 25, 8, "#a45450") : ""),
  ],
  flamingo: [
    "曲がったくちばし",
    [428, 169, 126, 122],
    "M453 204Q524 181 539 223Q541 250 505 270L511 235Q486 218 455 233Z",
    (c) =>
      path(
        "M100 372Q141 314 276 340Q339 372 354 324Q372 295 328 271Q254 228 301 181Q341 143 419 170Q477 177 471 216Q452 241 418 231Q370 193 344 217Q336 237 383 259Q452 310 399 372Q369 419 277 421Q157 418 100 372Z",
        c,
      ) +
      path("M256 414L252 494L260 548L283 549M294 412L326 474L290 504") +
      eye(436, 195),
  ],
  penguin: [
    "胸の模様",
    [246, 260, 204, 161],
    "M268 281Q349 338 423 271L423 298Q353 365 267 311Z",
    (c) =>
      path(
        "M223 247Q218 158 301 135Q374 116 427 195L472 213L435 231Q463 312 439 411Q430 482 367 483L230 484Q177 469 177 417Q114 385 134 347Q143 316 213 307Z",
        c,
      ) +
      ellipse(344, 347, 86, 117, "#f8edda") +
      eye(393, 187) +
      path(
        "M184 473L167 501L245 500L264 476M347 479L329 499L432 501L403 478",
        warm,
      ),
  ],
  tortoise: [
    "甲羅の模様",
    [127, 235, 310, 142],
    turtleAnswer,
    (c, v) =>
      path(shell, c) +
      eye(482, 326) +
      path("M137 380Q276 405 421 373") +
      variants(160, 388, 6, v),
  ],
  turtle: [
    "甲羅の模様",
    [127, 235, 310, 142],
    turtleAnswer,
    (c, v) =>
      path("M66 425Q83 417 101 423M427 456Q484 463 535 447", "none", 3) +
      path(shell, c) +
      eye(481, 323) +
      path(`M449 351Q478 ${327 + v * 2} 504 338M451 362L489 350`),
  ],
  snake: [
    "からだの曲がり",
    [83, 265, 210, 166],
    snakeTurn,
    (c, v) =>
      path(
        "M260 287Q362 293 418 251Q437 236 396 218L389 226Q350 237 337 221Q331 196 371 176Q419 158 459 190Q505 225 466 277Q427 324 285 323L250 318L247 287M265 350Q367 347 477 383Q533 402 518 431Q500 450 472 432Q393 387 270 397Z",
        c,
      ) +
      eye(385, 194) +
      variants(288, 365, 8, v),
  ],
  amphibian: [
    "尾",
    [35, 258, 248, 195],
    lizardTail,
    (c, v) =>
      path(
        "M262 357Q298 312 389 316Q423 288 492 309Q533 326 512 359Q492 393 413 387Q335 423 263 405Z",
        c,
      ) +
      path("M316 388L286 438L255 442M423 376L424 421L459 429") +
      eye(472, 326) +
      variants(315, 355, 7, v),
  ],
  crocodile: [
    "口先",
    [375, 263, 187, 106],
    "M388 291Q487 288 548 313Q563 333 524 342L394 346",
    (c) =>
      path(
        "M70 382Q174 384 228 325Q299 265 388 291L399 350Q305 391 232 376Q132 420 70 382Z",
        c,
      ) +
      path("M252 361L219 422L258 421M348 360L355 412L392 404") +
      eye(380, 304),
  ],
  gecko: [
    "尾",
    [42, 322, 242, 126],
    lizardTail,
    (c, v) =>
      path(
        "M262 357Q343 310 406 329Q443 293 492 313Q528 329 505 360Q458 390 406 382Q338 415 262 405Z",
        c,
      ) +
      path(
        "M315 377L288 432L250 434M363 344L339 300L302 286M433 371L465 415L492 411",
      ) +
      eye(472, 328) +
      variants(284, 361, 8, v),
  ],
  toad: [
    "後ろ足の指",
    [126, 373, 122, 107],
    toe,
    (c) =>
      path(
        "M170 357Q163 294 263 268Q327 226 424 266Q488 281 471 350Q442 407 359 396Q290 439 201 414Z",
        c,
      ) +
      ellipse(217, 374, 52, 38, "#bdab86") +
      path("M360 367L373 422L409 425L393 437") +
      eye(418, 279) +
      variants(237, 325, 8),
  ],
  chameleon: [
    "巻いた尾",
    [33, 239, 225, 204],
    "M240 340Q183 341 166 315Q147 282 111 277Q65 269 52 312Q38 363 83 398Q121 424 154 390Q177 365 155 344Q125 323 110 348",
    (c) =>
      path("M113 477L522 427", "none", 12) +
      path(
        "M223 332Q329 238 404 275L429 225L487 269Q517 287 498 328Q459 354 405 346Q319 413 226 373Z",
        c,
      ) +
      path("M312 369L278 432L252 447M394 346L430 420L405 439") +
      ellipse(456, 278, 26, 24, "#b1b779") +
      eye(459, 280),
  ],
  fish: [
    "尾びれ",
    [51, 220, 176, 168],
    "M210 293Q131 250 78 232L96 306L70 374Q133 353 209 318Z",
    (c) =>
      path(
        "M195 296Q268 196 411 234Q483 248 518 299Q468 352 358 368Q252 381 194 321Z",
        c,
      ) +
      path("M274 248L311 184L390 232M286 361L351 400L391 363", c) +
      path("M223 324Q307 334 389 307M441 252Q418 304 442 347") +
      eye(476, 285),
  ],
};

const background = ellipse(300, 510, 205, 13, "#eee4d1");
const layouts = {};
for (const [key, [part, rect, answerPath]] of Object.entries(shapes))
  layouts[key] = { part, rect, answerPath };

for (const species of catalog) {
  if (!species.draft) continue;
  const { shape, color, variant } = species.draft;
  const [, , answerPath, draw] = shapes[shape];
  const base = draw(color, variant);
  for (const complete of [false, true]) {
    const feature = complete
      ? path(
          answerPath,
          [
            "耳",
            "くちばし",
            "曲がったくちばし",
            "首の輪郭",
            "翼",
            "前足",
            "尾",
            "からだの曲がり",
            "尾びれ",
            "口先",
            "尾羽",
          ].includes(layouts[shape].part) && shape !== "crocodile"
            ? layouts[shape].part.includes("くちばし")
              ? "#d7a66b"
              : color
            : "none",
          6,
        )
      : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" data-full-animal="${species.id}" data-illustration="${complete ? "complete" : "incomplete"}">
  <g stroke="${dark}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    ${background}
    ${base}
    ${feature}
  </g>
</svg>
`;
    writeFileSync(
      new URL(species.id + (complete ? "-complete.svg" : ".svg"), out),
      svg,
    );
  }
}
writeFileSync(
  new URL("../src/content/kyoto-layouts.json", import.meta.url),
  "[\n" +
    Object.entries(layouts)
      .map(([shape, layout]) => "  " + JSON.stringify({ shape, ...layout }))
      .join(",\n") +
    "\n]\n",
);
