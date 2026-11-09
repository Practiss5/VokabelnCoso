import type { Slot } from "@/lib/wardrobe";

type Props = { mascot: string; outfit?: Partial<Record<Slot, string>> };

/** Muzzle size and height per animal, in the shared coordinate system. */
const FACE: Record<string, { rx: number; ry: number; cy: number }> = {
  dackel: { rx: 21, ry: 12, cy: 77 },
  bernhardiner: { rx: 19, ry: 13, cy: 76 },
  baer: { rx: 18, ry: 13, cy: 75 },
  wolf: { rx: 16, ry: 11, cy: 77 },
  fuchs: { rx: 15, ry: 10, cy: 77 },
  murmeltier: { rx: 14, ry: 10, cy: 76 },
  eichhoernchen: { rx: 12, ry: 9, cy: 75 },
  steinbock: { rx: 13, ry: 10, cy: 77 },
  igel: { rx: 14, ry: 9, cy: 79 },
  eule: { rx: 0, ry: 0, cy: 0 },
};

/** Spiky halo behind the hedgehog's head. */
function spikesPath(cx: number, cy: number, outer: number, inner: number, n = 14) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / n - Math.PI / 2;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d + "Z";
}

const POINTED = ["fuchs", "wolf", "eichhoernchen"];
const FLOPPY = ["dackel", "bernhardiner"];

/**
 * Full-body standing mascots in one shared coordinate system (viewBox 0 0 200 250).
 * Ears, eye line (y=56), neck, torso, right paw (140,152) and feet anchors are identical
 * for every animal, so hats, glasses, outfits and held items always land in the same place.
 */
export function MascotArt({ mascot, outfit = {} }: Props) {
  const fur = "var(--mascot-fur)", shade = "var(--mascot-shade)", light = "var(--mascot-light)";
  const ink = "var(--avatar-ink)", white = "var(--avatar-white)", gold = "var(--avatar-gold)";
  const blue = "var(--avatar-blue)", red = "var(--avatar-red)", green = "var(--avatar-green)";
  const cloth = "var(--mascot-cloth)", clothShade = "var(--mascot-cloth-shade)";
  const pants = "var(--mascot-pants)", shoe = "var(--mascot-shoe)", bread = "var(--mascot-bread)";

  const owl = mascot === "eule";
  const spikes = mascot === "igel";
  const shortLegs = mascot === "dackel";
  const legH = shortLegs ? 26 : 44;
  const shoeY = 148 + legH;
  const groundY = shoeY + 20;
  const face = FACE[mascot] ?? { rx: 15, ry: 11, cy: 76 };

  return (
    <svg viewBox="0 0 200 250" aria-hidden="true" className="mascot-art" data-mascot={mascot}
      fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* ---------- backdrops ---------- */}
      <g className="mascot-scenery">
        {outfit.bg === "forest" && <g fill={green}><path d="M4 202 30 132 56 202ZM144 198 172 122 200 198Z" /><path d="M28 186v16m142-8v16" stroke={shade} strokeWidth="7" /></g>}
        {outfit.bg === "matterhorn" && <><path d="m0 236 52-126 46 126 38-140 64 140" fill={blue} /><path d="m34 150 18-40 16 42-17-8Zm84-20 18-38 20 40-19-8Z" fill={white} /></>}
        {outfit.bg === "board" && <><rect x="6" y="24" width="188" height="182" rx="5" fill={green} stroke={shade} strokeWidth="6" /><path d="M18 48h36m-36 15h22m108 118h28m-22 16h22" stroke={white} strokeWidth="3" /></>}
        {outfit.bg === "castle" && <g fill={light} stroke={blue} strokeWidth="2"><path d="M4 208v-84h30v84m132 0v-84h30v84M20 208v-46h160v46" /><path d="m2 124 17-32 17 32m128 0 17-32 17 32" fill={blue} /></g>}
        {outfit.bg === "aurora" && <><path d="M0 26Q52 92 104 24T200 28v56Q146 22 102 90T0 78Z" fill={green} opacity=".4" /><path d="m18 34v9m-4-4h9m146 22v9m-4-4h9" stroke={gold} strokeWidth="2" /></>}
      </g>

      <ellipse cx="100" cy={groundY} rx="54" ry="7" fill={ink} opacity=".12" />

      {/* ---------- tails (behind the body) ---------- */}
      {mascot === "eichhoernchen" && <path d="M132 158c56-4 44-92 10-74 22 22-4 44-26 48Z" fill={fur} stroke={ink} strokeWidth="4" />}
      {mascot === "fuchs" && <><path d="M130 156c42 8 52-30 32-52-6 24-24 30-40 24Z" fill={fur} stroke={ink} strokeWidth="4" /><path d="M156 112c8 6 12 16 10 26 8-14 6-30-10-26Z" fill={white} /></>}
      {mascot === "wolf" && <path d="M128 158c36 10 44-16 28-38-2 20-14 24-32 18Z" fill={fur} stroke={ink} strokeWidth="4" />}
      {mascot === "baer" && <circle cx="140" cy="150" r="9" fill={shade} stroke={ink} strokeWidth="4" />}

      {/* ---------- legs, jeans, shoes ---------- */}
      <g stroke={ink} strokeWidth="4">
        <rect x="76" y="146" width="20" height={legH + 4} rx="9" fill={fur} />
        <rect x="104" y="146" width="20" height={legH + 4} rx="9" fill={fur} />
        <rect x="70" y="142" width="27" height={legH} rx="12" fill={pants} />
        <rect x="103" y="142" width="27" height={legH} rx="12" fill={pants} />
        <rect x="66" y="138" width="68" height="22" rx="10" fill={pants} />
        <path d="M66 152h68" stroke={pants} strokeWidth="2" opacity=".5" />
        <rect x="58" y={shoeY - 4} width="38" height="20" rx="10" fill={shoe} />
        <rect x="104" y={shoeY - 4} width="38" height="20" rx="10" fill={shoe} />
        <path d={`M60 ${shoeY + 8}h34m12 0h34`} stroke={ink} strokeWidth="3" />
      </g>

      {/* ---------- torso + base t-shirt ---------- */}
      <path d="M70 96c20-9 40-9 60 0l6 50c-24 8-48 8-72 0Z" fill={fur} stroke={ink} strokeWidth="4" />
      <g stroke={ink} strokeWidth="4">
        <path d="M68 100c21-10 43-10 64 0l6 44c-25 9-51 9-76 0Z" fill={cloth} />
        <path d="M70 100 54 108l6 18 14-7Z" fill={cloth} />
        <path d="M130 100l16 8-6 18-14-7Z" fill={cloth} />
        <path d="M88 98q12 9 24 0" stroke={clothShade} strokeWidth="4" />
        <path d="M124 104l4 38c-8 3-16 4-24 4 12-12 18-26 20-42Z" fill={clothShade} stroke="none" opacity=".45" />
      </g>

      {/* ---------- arms + paws ---------- */}
      <g stroke={ink} strokeWidth="4">
        <rect x="48" y="106" width="20" height="44" rx="10" fill={fur} />
        <rect x="132" y="106" width="20" height="44" rx="10" fill={fur} />
        <circle cx="58" cy="152" r="11" fill={fur} />
        <circle cx="142" cy="152" r="11" fill={fur} />
      </g>

      {/* ---------- outfits over the torso ---------- */}
      <g stroke={ink} strokeWidth="4">
        {outfit.neck === "tshirt" && <><path d="M68 100c21-10 43-10 64 0l6 44c-25 9-51 9-76 0Z" fill={blue} /><path d="M100 116l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill={gold} stroke={ink} strokeWidth="2" /><path d="M88 98q12 9 24 0" stroke={white} strokeWidth="4" /></>}
        {outfit.neck === "vest" && <><path d="M68 100c11-5 22-7 32-6l-2 50c-14 0-26-2-38-6Z" fill={gold} /><path d="M132 100c-11-5-22-7-32-6l2 50c14 0 26-2 38-6Z" fill={gold} /><path d="M64 132h34m4 0h34" stroke={white} strokeWidth="7" /></>}
        {outfit.neck === "apron" && <><path d="M80 104h40l6 46c-16 5-36 5-52 0Z" fill={white} /><path d="M80 104 72 92m48 12 8-12" stroke={white} strokeWidth="5" /><path d="M88 128h24v14H88Z" stroke={shade} strokeWidth="3" /><path d="M76 92q24 12 48 0" stroke={shade} strokeWidth="4" /></>}
      </g>

      {/* ---------- neck ---------- */}
      <path d="M88 82h24v18H88Z" fill={fur} stroke={ink} strokeWidth="4" />
      <g stroke={ink} strokeWidth="4">
        {outfit.neck === "scarf" && <><path d="M74 86q26 13 52 0v13q-26 13-52 0Z" fill={red} /><path d="m112 98-6 28 16 4 6-32Z" fill={red} /><path d="m108 112 16 4m-16 6 16 4" stroke={gold} strokeWidth="3" /></>}
        {outfit.neck === "bow" && <><path d="m98 92-18-10v24l18-10Zm4 0 18-10v24l-18-10Z" fill={red} /><circle cx="100" cy="94" r="5" fill={gold} /></>}
        {outfit.neck === "medal" && <><path d="m84 88 16 26 16-26" stroke={red} strokeWidth="7" /><circle cx="100" cy="126" r="12" fill={gold} /><path d="M100 119v13" stroke={shade} strokeWidth="3" /></>}
      </g>

      {/* ---------- head ---------- */}
      {spikes && <path d={spikesPath(100, 60, 50, 35)} fill={shade} stroke={ink} strokeWidth="4" />}
      {mascot === "steinbock" && <g stroke={ink} strokeWidth="4"><path d="M70 52C40 42 44 6 62 12c-12 8-8 22 8 28" fill={light} /><path d="M130 52c30-10 26-46 8-40 12 8 8 22-8 28" fill={light} /><ellipse cx="62" cy="60" rx="10" ry="6" transform="rotate(-20 62 60)" fill={fur} /><ellipse cx="138" cy="60" rx="10" ry="6" transform="rotate(20 138 60)" fill={fur} /><path d="M92 92q8 18 16 0" fill={light} /></g>}
      {POINTED.includes(mascot) && <g fill={fur} stroke={ink} strokeWidth="4"><path d="M56 46 50 14l30 16Z" /><path d="M144 46 150 14l-30 16Z" /><path d="m60 34-3-14 14 11Zm80 0 3-14-14 11Z" fill={light} stroke="none" /></g>}
      {mascot === "eichhoernchen" && <g fill={fur} stroke={ink} strokeWidth="3"><path d="m48 18-3-12 9 6Z" /><path d="m152 18 3-12-9 6Z" /></g>}
      {mascot === "baer" && <g fill={fur} stroke={ink} strokeWidth="4"><circle cx="70" cy="36" r="14" /><circle cx="130" cy="36" r="14" /><circle cx="70" cy="36" r="7" fill={shade} stroke="none" /><circle cx="130" cy="36" r="7" fill={shade} stroke="none" /></g>}
      {mascot === "murmeltier" && <g fill={fur} stroke={ink} strokeWidth="4"><circle cx="70" cy="38" r="10" /><circle cx="130" cy="38" r="10" /></g>}
      {mascot === "igel" && <g fill={fur} stroke={ink} strokeWidth="4"><circle cx="70" cy="44" r="8" /><circle cx="130" cy="44" r="8" /></g>}
      {FLOPPY.includes(mascot) && <g fill={shade} stroke={ink} strokeWidth="4"><path d="M66 44c-24-6-28 44-10 52 12 5 18-30 18-46Z" /><path d="M134 44c24-6 28 44 10 52-12 5-18-30-18-46Z" /></g>}
      {owl && <g fill={fur} stroke={ink} strokeWidth="4"><path d="m72 44 6-24 16 16Z" /><path d="m128 44-6-24-16 16Z" /></g>}

      <ellipse cx="100" cy="62" rx="35" ry="33" fill={fur} stroke={ink} strokeWidth="4" />
      <path d="M126 40c10 10 12 30 2 42 8-16 6-32-2-42Z" fill={shade} opacity=".5" />
      {mascot === "bernhardiner" && <><path d="M100 32 92 62l8 14 8-14Z" fill={white} /><ellipse cx="76" cy="56" rx="13" ry="15" fill={shade} /><ellipse cx="124" cy="56" rx="13" ry="15" fill={shade} /></>}
      {owl && <><ellipse cx="82" cy="56" rx="17" ry="18" fill={light} stroke={ink} strokeWidth="3" /><ellipse cx="118" cy="56" rx="17" ry="18" fill={light} stroke={ink} strokeWidth="3" /></>}
      {(mascot === "fuchs" || mascot === "wolf") && <path d="m66 62 14 8 20-11 20 11 14-8c-2 22-24 38-34 38S68 84 66 62Z" fill={light} />}

      {/* ---------- muzzle + nose + mouth ---------- */}
      {face.rx > 0 && <><ellipse cx="100" cy={face.cy} rx={face.rx} ry={face.ry} fill={light} stroke={ink} strokeWidth="3" />
        <ellipse cx="100" cy={face.cy - (face.ry - 3)} rx="5.5" ry="4" fill={ink} />
        <path d={`M100 ${face.cy + 1}v5m-8 0q8 8 16 0`} stroke={ink} strokeWidth="3" /></>}
      {mascot === "murmeltier" && <path d="M95 84v9h10v-9m-5 0v9" fill={white} stroke={ink} strokeWidth="2" />}
      {owl && <path d="m92 68 8 14 8-14Z" fill={gold} stroke={ink} strokeWidth="3" />}

      {/* ---------- eyes ---------- */}
      {owl ? <g fill={ink}><circle cx="84" cy="56" r="9" /><circle cx="116" cy="56" r="9" /><g fill={white}><circle cx="87" cy="52" r="3" /><circle cx="119" cy="52" r="3" /></g></g>
        : <g fill={ink}><ellipse cx="86" cy="56" rx="5" ry="6.5" /><ellipse cx="114" cy="56" rx="5" ry="6.5" /><g fill={white}><circle cx="88" cy="53" r="2" /><circle cx="116" cy="53" r="2" /></g></g>}

      {/* ---------- glasses ---------- */}
      <g stroke={ink} strokeWidth="3">
        {outfit.eyes === "sport" && <><path d="m62 47 38 5 38-5-4 18-22 2-10-8-10 8-22-2Z" fill={blue} /><path d="m72 53 9 9m40-8 8 8" stroke={white} /></>}
        {outfit.eyes === "aviator" && <><path d="M70 49h30l-2 15q-16 15-26-1Z" fill={blue} /><path d="M130 49h-30l2 15q16 15 26-1Z" fill={blue} /><path d="M88 53h24m-42-3-9-3m74 3 9-3" /></>}
        {outfit.eyes === "monocle" && <><circle cx="114" cy="56" r="14" stroke={gold} strokeWidth="4" /><path d="M127 65q16 26 3 41" stroke={gold} strokeWidth="3" /></>}
      </g>

      {/* ---------- held items (right paw at 142,152) ---------- */}
      <g stroke={ink} strokeWidth="3">
        {outfit.hand === "flag" && <><path d="M142 150V88" stroke={shade} strokeWidth="5" /><path d="M143 88h40v28h-40Z" fill={white} /><path d="M143 88h10v9h-10Zm20 0h10v9h-10Zm-10 9h10v9h-10Zm20 0h8v9h-8Zm-30 9h10v9h-10Zm20 0h10v9h-10Z" fill={ink} stroke="none" /></>}
        {outfit.hand === "quill" && <><path d="M142 152 166 106" stroke={shade} strokeWidth="4" /><path d="M152 140c-14-31 26-56 26-42 4 20-9 35-26 42" fill={white} stroke={blue} /><path d="m152 140 22-38" stroke={blue} /></>}
        {outfit.hand === "mic" && <><path d="m142 150 14-28" stroke={ink} strokeWidth="9" /><ellipse cx="160" cy="114" rx="11" ry="14" fill={blue} /><path d="m153 110 14 5m-13 3 12 4" stroke={white} /></>}
        {outfit.hand === "mug" && <><path d="M148 132h28v30h-28Z" fill={white} stroke={ink} strokeWidth="4" /><path d="M176 137c18-3 18 21 0 18" stroke={ink} strokeWidth="5" /><path d="M158 128q-6-7 0-13m12 13q-6-7 0-13" stroke={clothShade} strokeWidth="3" /></>}
        {outfit.hand === "pretzel" && <path d="M152 158c-26-14-21-36-9-32 10 3 5 24-4 23-14-2-1-30 13-14 13-16 27 12 13 14-9 1-15-20-4-23 12-4 18 17-8 32Z" stroke={bread} strokeWidth="9" />}
      </g>

      {/* paw drawn again on top so held items look gripped */}
      {outfit.hand && <><circle cx="142" cy="152" r="11" fill={fur} stroke={ink} strokeWidth="4" /><path d="M135 149q7-8 14-1" stroke={ink} strokeWidth="3" /></>}

      {/* ---------- hats (head top at y=30) ---------- */}
      <g stroke={ink} strokeWidth="4">
        {outfit.hat === "cap" && <><path d="M66 38q0-27 34-27t34 27Z" fill={blue} /><path d="M64 38q40-10 76 5-40 9-76-5" fill={clothShade} /><path d="M100 14v18" stroke={white} strokeWidth="3" /></>}
        {outfit.hat === "tyrol" && <><path d="m74 36 8-26 18 7 18-7 8 26" fill={green} /><path d="M62 38q38-9 76 0" stroke={green} strokeWidth="10" /><path d="M78 28h44" stroke={shade} strokeWidth="5" /><path d="m118 26 13-18" stroke={red} strokeWidth="5" /></>}
        {outfit.hat === "bonnet" && <><path d="M66 40q0-22 34-22t34 22" fill={red} /><rect x="62" y="35" width="76" height="13" rx="6" fill={white} /><circle cx="100" cy="10" r="8" fill={white} /></>}
        {outfit.hat === "crown" && <><path d="m66 34-5-24 20 12 19-20 19 20 20-12-5 24Z" fill={gold} /><circle cx="100" cy="24" r="4" fill={red} stroke="none" /></>}
        {outfit.hat === "dj" && <><path d="M68 46V40c0-14 64-14 64 0v6" stroke={ink} strokeWidth="8" /><rect x="58" y="34" width="18" height="30" rx="9" fill={blue} /><rect x="124" y="34" width="18" height="30" rx="9" fill={blue} /></>}
      </g>
    </svg>
  );
}
