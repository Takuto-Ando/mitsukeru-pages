// Small, species-specific coat details remain outside the child's missing part.
// Vector gradients and paths only: no texture bitmap or mobile filter cost.
const fur = (d, color = "#887565", width = 2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity=".55"/>`;
const goatDetails =
  fur(
    "M125 155q8 -7 16 -4M139 146q8 -7 16 -4M160 135q11 -5 20 -2M292 314q13 10 23 12M304 326q12 9 23 11M350 337q13 10 24 10M384 354q10 7 19 6M440 326q12 10 20 11M297 552v14M472 552v14M352 521v14M427 523v14",
  ) + fur("M58 158q14 19 32 24M316 167q16 -6 28 -14", "#bc9678", 3);
export const coatDetails = {
  goat: goatDetails,
  sheep:
    goatDetails +
    fur(
      "M294 286q11 -18 26 -3M335 279q10 -18 25 -2M390 277q16 -12 24 4M442 291q15 -9 22 8M299 363q18 -15 30 2M356 346q15 -13 26 6M416 370q15 -16 28 1M341 418q13 -10 24 3M451 406q14 -13 24 -1",
      "#b5a480",
      3,
    ),
  mandrill: fur(
    "M178 279q10 6 14 19M185 299q11 7 16 19M400 298q-8 10 -13 16M420 272q-11 12 -15 20M235 366l7 16M254 371l6 18M275 378l4 18M313 380l-3 18M334 376l-4 18M355 369l-6 17M201 440l6 14M394 440l-6 14",
    "#876b50",
  ),
  lemur: fur(
    "M164 163l-7 13M164 187l-6 12M177 251l8 14M429 176l8 12M425 256l-9 11M260 369l5 17M277 375l4 17M300 378v18M322 375l-3 17M344 369l-5 17",
    "#8e9288",
  ),
  gibbon: fur(
    "M266 318q14 12 25 7M306 327q13 8 26 -5M266 355l6 13M327 357l-4 13M257 403l10 4M326 403l10 -4",
    "#7d735f",
  ),
  elephant: fur(
    "M130 178q-14 48 24 81M461 177q15 48 -22 81M278 276l31 4M278 293l27 4M277 310l24 4M280 329l20 2M248 206q13 -8 23 -2M338 205q13 -6 25 1M227 533v16M245 532v17M352 533v16M371 533v16M187 410q8 8 17 6M400 411q9 8 18 -1",
    "#9f9f93",
    2.2,
  ),
  capuchin: fur(
    "M177 250q9 13 22 15M183 260q13 14 26 13M198 282q16 8 32 5M231 287q11 1 23 -6M201 211q14 -8 23 -4M248 214q8 6 12 13",
    "#80684f",
  ),
  macaque: fur(
    "M184 231l8 11M197 224l8 11M209 216l7 11M372 221l-7 11M387 228l-7 12M402 240l-6 12M183 363l9 11M411 362l-8 12M450 246q10 -10 18 -3",
    "#9f7c5e",
  ),
  badger: fur(
    "M332 333l13 8M354 328l12 9M378 331l13 8M405 338l13 7M446 357l12 8M457 380l13 7M276 430l11 8M434 457l11 6M254 514l12 3M251 524l12 3M477 524l13 -2",
    "#9c917b",
  ),
  zebra: fur(
    "M174 121q14 25 23 31M123 238q13 6 23 0M314 448q15 5 25 1M464 511l-1 23",
    "#afa58e",
    2.2,
  ),
  giraffe: fur(
    "M173 154q12 8 19 4M239 123q9 -5 16 -2M222 160q10 -4 16 0M234 178q6 6 15 4M277 380q22 10 39 6M406 481l8 3",
    "#ac8355",
  ),
  "giraffe-hoof": fur(
    "M173 154q12 8 19 4M239 123q9 -5 16 -2M222 160q10 -4 16 0M234 178q6 6 15 4M277 380q22 10 39 6M406 481l8 3",
    "#ac8355",
  ),
  hippo: fur(
    "M262 409q16 9 28 6M394 415q20 7 37 -3M245 511l-1 21M262 512l-1 19M462 511l1 20M479 508l1 21M90 355q13 6 22 0M197 355q13 6 22 0",
    "#9f888c",
    2.5,
  ),
  "hippo-body": fur(
    "M262 409q16 9 28 6M394 415q20 7 37 -3M245 511l-1 21M262 512l-1 19M462 511l1 20M479 508l1 21M90 355q13 6 22 0M197 355q13 6 22 0",
    "#9f888c",
    2.5,
  ),
  fennec: fur(
    "M132 302l-22 -3M132 310l-23 4M207 308l25 0M207 315l24 7M241 350q12 11 22 12M254 362q10 9 20 10M331 365l12 9M346 374l12 9M335 425l13 6",
    "#b3916c",
  ),
  "fennec-tail": fur(
    "M132 302l-22 -3M132 310l-23 4M207 308l25 0M207 315l24 7M241 350q12 11 22 12M254 362q10 9 20 10M331 365l12 9M346 374l12 9M335 425l13 6",
    "#b3916c",
  ),
  gorilla: fur(
    "M181 335l-4 17M194 340l-3 17M416 339l4 17M427 333l4 17M278 362q24 13 47 -2M281 371q21 10 40 -1M182 489l9 -1M178 501l9 -1M408 488l11 1M411 500l12 2",
    "#726e65",
  ),
  donkey: fur(
    "M124 228q12 6 23 1M134 240q11 6 22 0M136 251q10 6 18 0M202 388q35 14 64 5M347 382q30 8 58 -1M182 439l-1 12M431 438v13",
    "#a19b89",
  ),
  meerkat: fur(
    "M250 320l6 12M260 329l5 13M345 321l-6 12M335 331l-5 12M268 439q28 17 54 -1M270 449q24 12 50 -1M247 520l16 2M341 522l15 -1",
    "#b79364",
  ),
  deer: fur(
    "M116 235q11 6 19 1M139 261l11 9M153 274l9 9M166 289l10 9M243 401q31 4 54 -1M421 403l16 -2M191 431v15M413 431v15",
    "#b08a5c",
  ),
};
export function finishIllustration(id, content, scene) {
  const cut = scene.regions
    .map(
      (r) =>
        `<rect x="${r.x * 600}" y="${r.y * 600}" width="${r.width * 600}" height="${r.height * 600}" fill="black"/>`,
    )
    .join("");
  let painted = content;
  painted = painted.replaceAll('stroke-width="6"', 'stroke-width="4.5"');
  return `<defs><mask id="detail-mask"><rect width="600" height="600" fill="white"/>${cut}</mask></defs>${painted}<g mask="url(#detail-mask)" data-coat-details="${id}">${coatDetails[id] || ""}</g>`;
}
