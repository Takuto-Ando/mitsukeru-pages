// ピツネ — ズーケッチのマスコット（緑のベレー帽とマフラーのキツネ）。
// 原案: docs/design-reference/pitsune-intro-*.png
export type PitsunePose =
  | "face"
  | "stand"
  | "book"
  | "camera"
  | "easel"
  | "cheer";

const FUR = "#f7ba3d";
const CREAM = "#fff7e6";
const GREEN = "#71a24e";
const GREEN_DARK = "#5d8a3e";
const BROWN = "#71461f";
const EYE = "#54381c";

function Ears() {
  return (
    <>
      <path d="M22 44 L30 8 Q32 1 39 6 L57 27 Q40 40 22 44Z" fill={FUR} />
      <path
        d="M30 37 L35 16 Q36 11 41 15 L50 26 Q41 33 30 37Z"
        fill={CREAM}
      />
      <g transform="translate(120 0) scale(-1 1)">
        <path d="M22 44 L30 8 Q32 1 39 6 L57 27 Q40 40 22 44Z" fill={FUR} />
        <path
          d="M30 37 L35 16 Q36 11 41 15 L50 26 Q41 33 30 37Z"
          fill={CREAM}
        />
      </g>
    </>
  );
}

function Beret() {
  return (
    <>
      <rect x="57" y="1" width="7" height="10" rx="3.5" fill={GREEN} />
      <path
        d="M33 31 Q35 11 61 9 Q89 11 89 29 Q61 19 33 31Z"
        fill={GREEN}
      />
    </>
  );
}

function FaceHead({ closed = false }: { closed?: boolean }) {
  return (
    <>
      <Ears />
      <path
        d="M13 58 Q13 29 60 29 Q107 29 107 58 Q107 78 86 88 Q60 97 34 88 Q13 78 13 58Z"
        fill={FUR}
      />
      <path
        d="M13 63 Q60 51 107 63 Q105 80 84 89 Q60 97 36 89 Q15 80 13 63Z"
        fill={CREAM}
      />
      <Beret />
      {closed ? (
        <>
          <path
            d="M36 57 Q42 51 48 57"
            fill="none"
            stroke={EYE}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M72 57 Q78 51 84 57"
            fill="none"
            stroke={EYE}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="42" cy="56" r="4.6" fill={EYE} />
          <circle cx="78" cy="56" r="4.6" fill={EYE} />
        </>
      )}
      <ellipse cx="60" cy="71" rx="6" ry="4.6" fill={BROWN} />
      <path
        d="M53 80 Q60 85 67 80"
        fill="none"
        stroke={BROWN}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </>
  );
}

function Tail() {
  return (
    <>
      <path
        d="M148 196 Q198 182 192 128 Q188 100 166 94 L156 128 Q168 160 146 172Z"
        fill={FUR}
      />
      <path
        d="M192 128 Q188 100 166 94 L159 112 Q176 114 180 136Z"
        fill={BROWN}
      />
    </>
  );
}

function BodyBase() {
  return (
    <>
      <Tail />
      <path
        d="M52 128 Q49 208 70 226 L130 226 Q151 208 148 128 Q148 106 100 106 Q52 106 52 128Z"
        fill={FUR}
      />
      <ellipse cx="100" cy="182" rx="29" ry="37" fill={CREAM} />
      <ellipse cx="71" cy="234" rx="17" ry="8.5" fill={BROWN} />
      <ellipse cx="129" cy="234" rx="17" ry="8.5" fill={BROWN} />
    </>
  );
}

function Scarf() {
  return (
    <>
      <path
        d="M55 110 Q100 127 145 110 L145 127 Q100 144 55 127Z"
        fill={GREEN}
      />
      <path d="M74 128 L99 128 L94 170 Q83 177 75 167Z" fill={GREEN} />
    </>
  );
}

function HeadGroup({ closed = false }: { closed?: boolean }) {
  return (
    <g transform="translate(100 60) scale(1.08) translate(-60 -52)">
      <FaceHead closed={closed} />
    </g>
  );
}

function Face() {
  return (
    <svg viewBox="0 0 120 104" aria-hidden="true">
      <FaceHead />
      <circle cx="13" cy="97" r="10" fill={FUR} />
      <circle cx="107" cy="97" r="10" fill={FUR} />
    </svg>
  );
}

function Stand() {
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true">
      <BodyBase />
      <path
        d="M54 138 Q32 166 42 192 Q50 203 59 194 L64 158Z"
        fill={FUR}
      />
      <circle cx="49" cy="193" r="9.5" fill={BROWN} />
      <path
        d="M146 138 Q168 166 158 192 Q150 203 141 194 L136 158Z"
        fill={FUR}
      />
      <circle cx="151" cy="193" r="9.5" fill={BROWN} />
      <Scarf />
      <HeadGroup />
    </svg>
  );
}

function Book() {
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true">
      <BodyBase />
      <Scarf />
      <g>
        <rect
          x="50"
          y="136"
          width="100"
          height="78"
          rx="9"
          fill="#fffdf6"
          stroke="#d9a05a"
          strokeWidth="3"
        />
        {[64, 82, 100, 118, 136].map((x) => (
          <circle key={x} cx={x} cy={136} r="4" fill="none" stroke={BROWN} strokeWidth="2" />
        ))}
        <g
          fill="none"
          stroke={GREEN}
          strokeWidth="3"
          strokeLinecap="round"
        >
          <ellipse cx="86" cy="162" rx="6" ry="11" />
          <ellipse cx="114" cy="162" rx="6" ry="11" />
          <circle cx="100" cy="184" r="17" />
        </g>
        <circle cx="94" cy="182" r="2.2" fill={GREEN} />
        <circle cx="106" cy="182" r="2.2" fill={GREEN} />
        <path
          d="M96 190 Q100 193 104 190"
          fill="none"
          stroke={GREEN}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
      <circle cx="47" cy="176" r="10.5" fill={BROWN} />
      <circle cx="153" cy="176" r="10.5" fill={BROWN} />
      <HeadGroup closed />
    </svg>
  );
}

function CameraPose() {
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true">
      <BodyBase />
      <Scarf />
      <g>
        <rect x="86" y="130" width="28" height="11" rx="4" fill={GREEN_DARK} />
        <rect
          x="56"
          y="140"
          width="88"
          height="54"
          rx="10"
          fill={GREEN}
        />
        <circle cx="70" cy="151" r="3.4" fill={BROWN} />
        <circle cx="100" cy="167" r="17.5" fill="#3c3a38" />
        <circle cx="100" cy="167" r="10.5" fill="#191817" />
        <circle cx="94" cy="160" r="4" fill="#cfd8dc" />
      </g>
      <circle cx="54" cy="168" r="9.5" fill={BROWN} />
      <circle cx="146" cy="168" r="9.5" fill={BROWN} />
      <HeadGroup />
    </svg>
  );
}

function Easel() {
  return (
    <svg viewBox="0 0 280 250" aria-hidden="true">
      <path
        d="M176 168 L162 234 M250 168 L264 234"
        stroke="#c97e2f"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect
        x="164"
        y="60"
        width="98"
        height="112"
        rx="7"
        fill="#fffdf6"
        stroke="#d9903f"
        strokeWidth="10"
      />
      <rect x="204" y="44" width="18" height="16" rx="3" fill="#d9903f" />
      <g fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round">
        <ellipse cx="200" cy="94" rx="7" ry="14" />
        <ellipse cx="226" cy="94" rx="7" ry="14" />
        <circle cx="213" cy="126" r="21" />
      </g>
      <path
        d="M60 190 Q14 178 20 138 Q23 116 40 110 L46 140 Q38 162 62 168Z"
        fill={FUR}
      />
      <path
        d="M52 126 Q48 206 68 222 L118 222 Q136 206 134 138 L134 126 Q134 106 94 106 Q56 106 52 126Z"
        fill={FUR}
      />
      <ellipse cx="70" cy="232" rx="16" ry="8" fill={BROWN} />
      <ellipse cx="114" cy="232" rx="16" ry="8" fill={BROWN} />
      <path
        d="M54 102 Q94 115 130 104 L130 119 Q94 131 54 117Z"
        fill={GREEN}
      />
      <path
        d="M126 138 Q158 134 180 122 L185 136 Q162 152 130 154Z"
        fill={FUR}
      />
      <path d="M182 130 L208 112" stroke={BROWN} strokeWidth="5" strokeLinecap="round" />
      <circle cx="181" cy="131" r="8.5" fill={BROWN} />
      <g>
        <path d="M56 36 L64 7 Q66 0 73 5 L90 24 Q73 34 56 36Z" fill={FUR} />
        <path
          d="M63 30 L68 13 Q69 8 74 12 L84 22 Q75 28 63 30Z"
          fill={CREAM}
        />
        <path
          d="M46 62 Q46 24 88 22 Q124 24 128 52 L145 63 Q150 67 144 72 L127 77 Q123 98 94 101 Q52 100 46 62Z"
          fill={FUR}
        />
        <path
          d="M98 99 Q124 94 127 77 L144 72 Q150 67 145 63 L130 55 Q134 82 116 93 Q107 99 98 99Z"
          fill={CREAM}
        />
        <path
          d="M62 27 Q66 7 93 6 Q117 8 115 23 Q88 15 62 27Z"
          fill={GREEN}
        />
        <rect x="86" y="-2" width="7" height="10" rx="3.5" fill={GREEN} transform="translate(0 2)" />
        <circle cx="102" cy="56" r="4.6" fill={EYE} />
        <ellipse cx="141" cy="66" rx="5.4" ry="4.2" fill={BROWN} />
      </g>
    </svg>
  );
}

function Cheer() {
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true">
      <BodyBase />
      <path d="M57 130 Q24 114 15 86 L30 77 Q45 102 64 114Z" fill={FUR} />
      <circle cx="21" cy="82" r="10.5" fill={BROWN} />
      <path d="M143 130 Q176 114 185 86 L170 77 Q155 102 136 114Z" fill={FUR} />
      <circle cx="179" cy="82" r="10.5" fill={BROWN} />
      <Scarf />
      <g fill="#f0ad2d">
        <rect x="0" y="118" width="17" height="6.5" rx="3.25" transform="rotate(-24 8 121)" />
        <rect x="4" y="140" width="17" height="6.5" rx="3.25" transform="rotate(-54 12 143)" />
        <rect x="183" y="118" width="17" height="6.5" rx="3.25" transform="rotate(24 191 121)" />
        <rect x="179" y="140" width="17" height="6.5" rx="3.25" transform="rotate(54 187 143)" />
      </g>
      <HeadGroup />
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
  const art =
    pose === "face" ? (
      <Face />
    ) : pose === "stand" ? (
      <Stand />
    ) : pose === "book" ? (
      <Book />
    ) : pose === "camera" ? (
      <CameraPose />
    ) : pose === "easel" ? (
      <Easel />
    ) : (
      <Cheer />
    );
  return (
    <span className={className} aria-hidden="true">
      {art}
    </span>
  );
}
