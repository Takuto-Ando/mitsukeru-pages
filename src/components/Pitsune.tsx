// ピツネの第3弾デザイン。共通の顔を吹き出しと各ポーズに使う。
export type PitsunePose =
  "face" | "stand" | "wave" | "book" | "camera" | "easel" | "cheer";

const FUR = "#ffb65a";
const TAIL = "#f6a640";
const CREAM = "#fceacd";
const GREEN = "#87a944";
const BROWN = "#805a36";
const PAPER = "#fffaf0";
const WOOD = "#d99a4d";

function Head({ smiling = false }: { smiling?: boolean }) {
  return (
    <>
      <path
        d="M13 136C4 118-4 82 5 51 15 13 45 32 69 53L112 65 155 54C181 31 206 21 214 53 223 82 215 114 207 139Z"
        fill={FUR}
      />
      <path
        d="M16 123C12 109 8 81 16 62 22 40 40 56 58 79ZM161 80C180 56 194 47 201 62 209 80 204 110 200 123Z"
        fill={CREAM}
      />
      <path
        d="M2 146C20 111 49 77 77 68 100 59 122 58 145 68 172 80 202 115 218 145 223 153 217 162 207 171 186 190 149 202 110 202 68 202 31 191 11 171 2 163-2 154 2 146Z"
        fill={FUR}
      />
      <path
        d="M2 160C23 150 45 146 74 145 87 144 99 140 111 141 128 140 138 144 147 145 179 147 198 151 217 160 199 186 157 202 110 202 60 202 20 186 2 160Z"
        fill={CREAM}
      />
      <path
        d="M106 21C103 9 108 0 115 0 124 0 128 9 123 20 143 22 166 32 165 47 163 61 143 73 110 73 83 73 62 66 63 53 63 38 85 24 106 21Z"
        fill={GREEN}
      />
      {smiling ? (
        <path
          d="M62 146c5-11 17-12 23-1m51 0c5-11 16-11 22 0"
          fill="none"
          stroke={BROWN}
          strokeWidth="8"
          strokeLinecap="round"
        />
      ) : (
        <>
          <ellipse cx="78" cy="142" rx="8.4" ry="12" fill={BROWN} />
          <ellipse cx="142" cy="142" rx="8.4" ry="12" fill={BROWN} />
        </>
      )}
      <ellipse cx="110" cy="152" rx="7.7" ry="5" fill={BROWN} />
    </>
  );
}

function Closeup({ smiling = false }: { smiling?: boolean }) {
  return (
    <svg viewBox="0 0 220 212" aria-hidden="true">
      <Head smiling={smiling} />
      <ellipse cx="52" cy="195" rx="18" ry="16" fill={BROWN} />
      <ellipse cx="168" cy="195" rx="18" ry="16" fill={BROWN} />
    </svg>
  );
}

function Tail() {
  return (
    <>
      <path
        d="M154 225C188 227 213 210 243 185 258 173 265 185 261 209 252 258 222 286 170 284Z"
        fill={TAIL}
      />
      <path
        d="M208 212C220 204 232 195 243 185 255 175 266 181 262 203 259 218 254 230 247 241 240 240 236 236 234 231 224 232 220 225 218 221 212 221 209 218 208 212Z"
        fill={CREAM}
      />
      <path
        d="M230 197c5-4 9-8 13-12 14-12 23-4 19 22-6 2-10-2-12-4-7 1-11-3-13-5-3 1-6 0-7-1Z"
        fill={BROWN}
      />
    </>
  );
}

function Feet() {
  return (
    <path
      d="M64 290c-11 17-4 23 15 24 18 1 26-4 24-22Zm67 2c-1 17 5 23 23 22 20-1 27-8 18-23Z"
      fill={BROWN}
    />
  );
}

function Body() {
  return (
    <>
      <Feet />
      <path
        d="M73 176C92 165 144 165 163 178 181 192 185 234 180 263 179 290 169 303 142 300 130 299 125 296 117 296 111 296 105 299 92 300 67 304 55 291 53 261 50 235 55 193 73 176Z"
        fill={FUR}
      />
      <path
        d="M83 209C103 192 140 192 153 212 173 243 153 287 119 287 84 287 67 247 83 209Z"
        fill={CREAM}
      />
    </>
  );
}

function Scarf() {
  return (
    <path
      d="M60 175C58 166 72 165 85 167 105 171 138 171 159 166 171 162 178 170 174 182 171 195 152 201 107 200L103 226C102 234 96 234 91 231 87 234 82 231 80 229 73 232 65 226 68 219L76 196C64 193 60 184 60 175Z"
      fill={GREEN}
    />
  );
}

function StandArms() {
  return (
    <>
      <path
        d="M57 187C39 192 24 209 24 226 25 239 39 246 56 241L74 192ZM173 187C191 192 205 209 205 226 205 239 191 246 174 241L158 192Z"
        fill={FUR}
      />
      <path
        d="M24 226c5 10 14 14 26 15l1 10c-15 4-30-8-27-25Zm181 0c-5 10-14 14-26 15l-1 10c15 4 30-8 27-25Z"
        fill={BROWN}
      />
    </>
  );
}

function WaveArms() {
  return (
    <>
      <path
        d="M71 184C49 181 30 167 18 164 4 162 0 178 12 193 24 207 45 220 69 224ZM161 185C183 181 201 167 213 164 228 162 231 178 220 193 208 207 188 220 163 224Z"
        fill={FUR}
      />
      <path
        d="M19 164C6 158-2 167 0 179 1 186 6 192 11 196L29 169ZM213 164C226 158 235 167 232 179 231 186 226 192 221 196L203 169Z"
        fill={BROWN}
      />
    </>
  );
}

function BunnySketch({ details = false }: { details?: boolean }) {
  return (
    <g fill="none" stroke={GREEN} strokeWidth="4" strokeLinecap="round">
      <path d="M24 45C17 28 21 9 30 9c10 0 14 16 14 29h8C56 20 64 9 72 12c10 4 6 22-3 37 16 19 8 40-15 45-28 6-51-12-38-36 2-5 5-9 8-13Z" />
      {details && <path d="M37 70v.3m19-.3v.3m-12 6q2 3 5 0" />}
    </g>
  );
}

function Book() {
  return (
    <>
      <g transform="rotate(-4 116 213)">
        <rect
          x="50"
          y="168"
          width="132"
          height="99"
          rx="5"
          fill={PAPER}
          stroke="#ae875f"
          strokeWidth="5"
        />
        <path
          d="M63 168v10h4m10-10v10h4m10-10v10h4m10-10v10h4m10-10v10h4m10-10v10h4m10-10v10h4m10-10v10h4"
          fill="none"
          stroke={BROWN}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g transform="translate(81 180) scale(.73)">
          <BunnySketch details />
        </g>
      </g>
      <ellipse cx="50" cy="220" rx="16" ry="20" fill={BROWN} />
      <ellipse cx="184" cy="217" rx="16" ry="20" fill={BROWN} />
      <path
        d="m224 34 10-15m-4 32 16-8"
        stroke="#ffbf27"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </>
  );
}

function CameraProp() {
  return (
    <>
      <ellipse cx="32" cy="193" rx="17" ry="20" fill={BROWN} />
      <rect x="47" y="152" width="24" height="12" rx="3" fill={BROWN} />
      <rect
        x="36"
        y="163"
        width="92"
        height="55"
        rx="11"
        fill={PAPER}
        stroke="#dba65e"
        strokeWidth="5"
      />
      <path d="M38 181h88v27q0 8-8 8H46q-8 0-8-8Z" fill={GREEN} />
      <circle
        cx="83"
        cy="193"
        r="20"
        fill={BROWN}
        stroke={CREAM}
        strokeWidth="4"
      />
      <path
        d="M47 172h8m53 2h6"
        stroke={BROWN}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M114 219C119 202 135 199 145 213L156 236C143 252 119 241 114 219Z"
        fill={FUR}
      />
      <ellipse
        cx="128"
        cy="204"
        rx="16"
        ry="21"
        transform="rotate(37 128 204)"
        fill={BROWN}
      />
    </>
  );
}

function StandingPose({
  pose,
}: {
  pose: "stand" | "wave" | "book" | "camera";
}) {
  return (
    <svg
      viewBox={pose === "stand" ? "15 4 254 314" : "0 0 269 320"}
      aria-hidden="true"
    >
      <Tail />
      {pose === "stand" && <StandArms />}
      {pose === "wave" && <WaveArms />}
      <Body />
      <Scarf />
      <g transform="translate(17 4) scale(.9)">
        <Head smiling={pose === "book"} />
      </g>
      {pose === "book" && <Book />}
      {pose === "camera" && <CameraProp />}
    </svg>
  );
}

function Easel() {
  return (
    <svg viewBox="0 0 344 296" aria-hidden="true">
      <path
        d="M196 174 167 279q-3 10 8 10h12q6 0 8-6l31-112Zm70-10 29 119q1 10 10 10h13q9 0 7-9l-26-121Z"
        fill={WOOD}
      />
      <path d="m263 24-8 36h27l10-37q1-8-8-9l-12-1q-7 0-9 11Z" fill={WOOD} />
      <path
        d="M201 39h131q12 0 10 12l-30 180H162L192 50q2-11 9-11Z"
        fill={WOOD}
      />
      <path
        d="M202 50h124q5 0 4 6l-26 165H174l24-161q1-10 4-10Z"
        fill="#fffaf4"
      />
      <path d="M176 221H315q8 0 8 8v1q0 8-8 8H172Z" fill={WOOD} />
      <g transform="translate(199 67) scale(1.24)">
        <BunnySketch />
      </g>
      <g transform="translate(-18 -20)">
        <Feet />
      </g>
      <path
        d="M48 268C43 262 40 253 38 244 19 235 17 212 35 192 49 173 94 164 122 177 151 192 160 217 153 247 149 268 138 280 104 281 86 283 58 285 48 268Z"
        fill={FUR}
      />
      <path
        d="M123 279C93 276 78 264 84 241 90 218 112 205 140 196 175 187 191 170 204 161 217 152 224 159 222 176 217 222 188 274 137 279Z"
        fill={TAIL}
      />
      <path
        d="M161 188c16-9 32-22 43-30 17-11 22 3 17 24-3 18-9 35-15 48-7-2-11-5-12-10-11 2-20-5-21-12-9-1-14-10-12-20Z"
        fill={CREAM}
      />
      <path
        d="M191 169c6-5 13-13 20-14 10-1 14 6 11 20l-4 13c-6 0-9-4-10-7-6 1-11-3-11-7-4 0-7-3-6-5Z"
        fill={BROWN}
      />
      <path
        d="M44 165C64 157 114 156 144 157 153 158 157 171 146 180 131 191 63 194 46 181 37 176 37 169 44 165Z"
        fill={GREEN}
      />
      <path
        d="M17 119C3 90-6 59 3 47 13 31 30 39 47 48 62 30 85 31 107 37 128 22 144 11 156 22 169 35 172 66 173 80 177 93 180 104 183 109 188 123 183 142 168 153 144 170 85 169 53 164 24 162 4 147 11 131Z"
        fill={FUR}
      />
      <path
        d="M138 66c8-19 20-37 25-27 4 8 4 24 3 52-7-10-16-18-28-25Zm-31 73c18-18 44-28 67-33 10-2 17-1 17 10-2 21-20 39-47 46-16 4-30-6-37-23Z"
        fill={CREAM}
      />
      <ellipse
        cx="177"
        cy="104"
        rx="5"
        ry="10"
        transform="rotate(-8 177 104)"
        fill={BROWN}
      />
      <ellipse
        cx="190"
        cy="109"
        rx="3"
        ry="6"
        transform="rotate(-20 190 109)"
        fill={BROWN}
      />
      <path
        d="M61 18C52 3 59-6 69-6 78-6 82 0 83 11 108 4 121 10 132 22 119 32 108 42 103 58 78 71 60 70 43 63 29 57 37 36 61 18Z"
        transform="translate(0 8)"
        fill={GREEN}
      />
    </svg>
  );
}

export function PitsuneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 30"
      width="36"
      height="30"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 18c-1-3-2-10 0-12s6 2 8 4m12 0c2-2 6-6 8-4s1 9 0 12M3 22c0-3 7-7 15-7s15 4 15 7c0 4-7 6-15 6S3 26 3 22Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M4 22c2 4 9 6 14 6s12-2 14-6c-3-1-5 0-8 0-3 0-4-2-6-2s-3 2-6 2-5-1-8 0ZM17 5c-4 0-7 2-7 4 0 2 4 3 8 3s8-1 8-3-4-4-7-4c1-2 0-3-1-3s-2 1-1 3Z"
        fill="currentColor"
      />
      <ellipse cx="12" cy="19" rx="1" ry="1.5" fill="currentColor" />
      <ellipse cx="24" cy="19" rx="1" ry="1.5" fill="currentColor" />
    </svg>
  );
}

export function Pitsune({
  pose,
  className,
}: {
  pose: PitsunePose;
  className?: string;
}) {
  let artwork;
  switch (pose) {
    case "face":
      artwork = <Closeup />;
      break;
    case "cheer":
      artwork = <Closeup smiling />;
      break;
    case "easel":
      artwork = <Easel />;
      break;
    default:
      artwork = <StandingPose pose={pose} />;
  }
  return (
    <span className={className} aria-hidden="true">
      {artwork}
    </span>
  );
}
