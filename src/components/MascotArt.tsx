import type { Slot } from "@/lib/wardrobe";

type Props = { mascot: string; outfit?: Partial<Record<Slot, string>> };

/** All animals share eye, neck and paw anchors in one scalable coordinate system. */
export function MascotArt({ mascot, outfit = {} }: Props) {
  const pointed = ["fuchs", "wolf", "eichhoernchen", "eule"].includes(mascot);
  const dog = mascot === "dackel" || mascot === "bernhardiner";
  const fur = "var(--mascot-fur)", shade = "var(--mascot-shade)", light = "var(--mascot-light)";
  const ink = "var(--avatar-ink)", white = "var(--avatar-white)", gold = "var(--avatar-gold)";
  const blue = "var(--avatar-blue)", red = "var(--avatar-red)", green = "var(--avatar-green)";
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="mascot-art" data-mascot={mascot} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g className="mascot-scenery">
        {outfit.bg === "forest" && <g fill={green}><path d="M6 154 29 102 52 154ZM146 150 170 94 194 150Z" /><path d="M27 143v39m144-44v44" stroke={shade} strokeWidth="7" /></g>}
        {outfit.bg === "matterhorn" && <><path d="m0 171 54-104 44 104 37-119 65 119" fill={blue}/><path d="m35 104 19-37 17 41-17-9Zm82-17 18-35 20 37-19-8Z" fill={white}/></>}
        {outfit.bg === "board" && <><rect x="7" y="32" width="186" height="124" rx="5" fill={green} stroke={shade} strokeWidth="6"/><path d="M18 53h34m-34 13h20m112 55h26m-20 14h20" stroke={white} strokeWidth="3"/></>}
        {outfit.bg === "castle" && <g fill={light} stroke={blue} strokeWidth="2"><path d="M6 165V91h30v74m130 0V91h28v74M22 165v-41h158v41"/><path d="m4 91 17-31 17 31m125 0 17-31 17 31" fill={blue}/></g>}
        {outfit.bg === "aurora" && <><path d="M0 23Q50 78 102 21T200 24v50Q143 16 100 78T0 70Z" fill={green} opacity=".4"/><path d="m18 28 0 8m-4-4h8m148 19v8m-4-4h8" stroke={gold} strokeWidth="2"/></>}
      </g>
      <ellipse cx="100" cy="185" rx="58" ry="6" fill={ink} opacity=".1"/>
      {mascot === "eichhoernchen" && <path d="M143 165c60-18 34-86 15-69-23 21 11 31-15 43" fill={fur} stroke={shade} strokeWidth="3"/>}
      {mascot === "igel" && <path d="m41 147-17-12 12-15-13-14 16-13-7-20 19-3 0-22 22 7 9-22 18 14 18-14 9 22 22-7 0 22 19 3-7 20 16 13-13 14 12 15-17 12Z" fill={shade}/>}
      <ellipse cx="100" cy="143" rx="43" ry="39" fill={fur}/>
      <ellipse cx="100" cy="146" rx="26" ry="30" fill={light}/>
      <ellipse cx="76" cy="177" rx="19" ry="9" fill={shade}/><ellipse cx="124" cy="177" rx="19" ry="9" fill={shade}/>
      {mascot === "steinbock" && <g stroke={shade} strokeWidth="12"><path d="M63 55C34 29 51 8 62 15c-9 10-6 20 9 27M137 55c29-26 12-47 1-40 9 10 6 20-9 27"/><path d="m48 29 11-5m82 0 11 5" stroke={fur} strokeWidth="3"/></g>}
      {pointed ? <><path d="M53 66 48 25 81 45M119 45l33-20-5 41" fill={fur} stroke={shade} strokeWidth="3"/><path d="m57 49-2-13 15 12m60 0 15-12-2 13" fill={light}/></> : dog ? <><path d="M61 49C32 36 30 98 48 108c14 8 24-27 24-45M139 49c29-13 31 49 13 59-14 8-24-27-24-45" fill={shade}/></> : <><circle cx="60" cy="48" r="18" fill={fur}/><circle cx="140" cy="48" r="18" fill={fur}/><circle cx="60" cy="48" r="10" fill={shade}/><circle cx="140" cy="48" r="10" fill={shade}/></>}
      <path d="M100 38c-38 0-54 20-52 48 1 24 25 39 52 39s51-15 52-39c2-28-14-48-52-48" fill={fur}/>
      {(mascot === "fuchs" || mascot === "wolf") && <path d="m51 77 21 11 28-16 28 16 21-11c-2 28-26 48-49 48S53 105 51 77" fill={light}/>}
      {mascot === "bernhardiner" && <><path d="M100 39 89 74l11 18 11-18Z" fill={white}/><ellipse cx="75" cy="74" rx="16" ry="20" fill={shade}/><ellipse cx="125" cy="74" rx="16" ry="20" fill={shade}/></>}
      {mascot === "eule" && <><ellipse cx="77" cy="77" rx="23" ry="25" fill={light}/><ellipse cx="123" cy="77" rx="23" ry="25" fill={light}/></>}
      <ellipse cx="100" cy="99" rx={mascot === "eule" ? 15 : 27} ry="17" fill={light}/>
      <g fill={ink}><ellipse cx="77" cy="76" rx="5" ry="7"/><ellipse cx="123" cy="76" rx="5" ry="7"/></g>
      <g fill={white}><circle cx="79" cy="73" r="2"/><circle cx="125" cy="73" r="2"/></g>
      {mascot === "eule" ? <path d="m93 93 7 12 7-12Z" fill={gold}/> : <><path d="M92 94q8-6 16 0l-8 9Z" fill={ink}/><path d="M100 102v4m-10 0q10 10 20 0" stroke={ink} strokeWidth="2"/></>}
      {mascot === "murmeltier" && <path d="M95 112v8h10v-8m-5 0v8" fill={white} stroke={shade} strokeWidth="1"/>}
      <g stroke={ink} strokeWidth="3">
        {outfit.eyes === "sport" && <><path d="m57 68 43 4 43-4-5 19-26 2-12-8-12 8-26-2Z" fill={blue}/><path d="m68 73 10 10m40-9 9 8" stroke={white}/></>}
        {outfit.eyes === "aviator" && <><path d="M59 69h30l-2 16q-15 16-25-1Zm52 0h30l-3 15q-10 17-25 1Z" fill={blue}/><path d="M89 74h22m-52-3-8-3m90 3 8-3"/></>}
        {outfit.eyes === "monocle" && <><circle cx="123" cy="76" r="14" stroke={gold}/><path d="M136 84q16 27 3 43" stroke={gold} strokeWidth="2"/></>}
      </g>
      <g>
        {outfit.neck === "tshirt" && <><path d="m70 122-18 13 9 14 13-6v27h52v-27l13 6 9-14-18-13-17 6H87Z" fill={blue}/><path d="m93 142 7 15 7-15m-14 8h14" stroke={white} strokeWidth="3"/></>}
        {outfit.neck === "apron" && <><path d="M79 121v15h42v-15m-37 16-9 37h50l-9-37" fill={white} stroke={shade} strokeWidth="3"/><path d="M89 149h22v12H89Z" stroke={shade} strokeWidth="2"/></>}
        {outfit.neck === "vest" && <><path d="m71 121-7 46h29v-35l-12-11Zm58 0 7 46h-29v-35l12-11Z" fill={gold}/><path d="M67 149h26m14 0h26" stroke={white} strokeWidth="6"/></>}
        {outfit.neck === "scarf" && <><path d="M70 113q30 13 60 0v14q-30 13-60 0Z" fill={red}/><path d="m111 126-7 30 15 4 8-34" fill={red}/><path d="m107 144 15 4m-16 3 14 4" stroke={gold} strokeWidth="3"/></>}
        {outfit.neck === "bow" && <><path d="m98 120-17-9v23l17-10m4-4 17-9v23l-17-10" fill={red}/><circle cx="100" cy="122" r="5" fill={gold}/></>}
        {outfit.neck === "medal" && <><path d="m79 117 21 28 21-28" stroke={red} strokeWidth="6"/><circle cx="100" cy="150" r="12" fill={gold}/><path d="M100 143v13" stroke={shade} strokeWidth="3"/></>}
      </g>
      <g>
        {outfit.hand === "flag" && <><path d="M140 156V99" stroke={shade} strokeWidth="4"/><path d="M141 99h38v27h-38Z" fill={white}/><path d="M141 99h10v9h-10Zm20 0h10v9h-10Zm-10 9h10v9h-10Zm20 0h8v9h-8Zm-30 9h10v9h-10Zm20 0h10v9h-10Z" fill={ink}/></>}
        {outfit.hand === "quill" && <><path d="M140 157 162 110" stroke={shade} strokeWidth="3"/><path d="M147 145c-13-31 26-54 25-40 4 19-8 34-25 40" fill={white} stroke={blue} strokeWidth="2"/><path d="m147 145 22-37" stroke={blue} strokeWidth="2"/></>}
        {outfit.hand === "mic" && <><path d="m141 155 10-29" stroke={ink} strokeWidth="9"/><ellipse cx="154" cy="120" rx="10" ry="13" fill={blue} stroke={ink} strokeWidth="2"/><path d="m147 117 13 4m-12 2 11 4" stroke={white} strokeWidth="2"/></>}
        {outfit.hand === "mug" && <><path d="M141 128h26v28h-26Z" fill={white} stroke={blue} strokeWidth="2"/><path d="M167 132c17-3 17 19 0 16" stroke={blue} strokeWidth="4"/><path d="M147 120q-7-7 0-13m11 13q-7-7 0-13" stroke={shade} strokeWidth="2"/></>}
        {outfit.hand === "pretzel" && <><path d="M150 152c-25-14-20-34-8-30 10 3 5 23-4 22-14-2-1-28 12-13 13-15 26 11 12 13-9 1-14-19-4-22 12-4 17 16-8 30Z" stroke={shade} strokeWidth="8"/><path d="m140 130 2 1m14 10 2 1m-9 5 2 1" stroke={white} strokeWidth="2"/></>}
      </g>
      <ellipse cx="63" cy="145" rx="10" ry="16" transform="rotate(-25 63 145)" fill={fur}/>
      <ellipse cx="138" cy="151" rx="11" ry="9" fill={fur}/>
      <path d="m134 149 1 5m5-5 1 5" stroke={shade} strokeWidth="1.5"/>
      <g>
        {outfit.hat === "cap" && <><path d="M65 47q0-28 35-28t35 28Z" fill={blue}/><path d="M68 44q43-9 76 5-42 10-76-5" fill={shade}/><path d="M100 22v18" stroke={white} strokeWidth="2"/></>}
        {outfit.hat === "tyrol" && <><path d="m72 44 10-27 18 7 18-7 10 27" fill={green}/><path d="M64 44q36-8 72 0" stroke={green} strokeWidth="9"/><path d="M78 37h45" stroke={shade} strokeWidth="5"/><path d="m120 36 13-19" stroke={white} strokeWidth="4"/></>}
        {outfit.hat === "bonnet" && <><path d="M67 43q0-26 33-26t33 26" fill={red}/><rect x="64" y="39" width="72" height="12" rx="5" fill={white}/><circle cx="100" cy="15" r="9" fill={white}/></>}
        {outfit.hat === "crown" && <><path d="m67 42-5-23 20 12 18-20 18 20 20-12-5 23Z" fill={gold} stroke={shade} strokeWidth="2"/><circle cx="100" cy="34" r="4" fill={red}/></>}
        {outfit.hat === "dj" && <><path d="M49 76V63c0-47 102-47 102 0v13" stroke={ink} strokeWidth="7"/><rect x="44" y="63" width="14" height="31" rx="7" fill={blue} stroke={ink} strokeWidth="3"/><rect x="142" y="63" width="14" height="31" rx="7" fill={blue} stroke={ink} strokeWidth="3"/></>}
      </g>
    </svg>
  );
}