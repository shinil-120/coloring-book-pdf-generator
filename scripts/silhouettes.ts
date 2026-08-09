/**
 * scripts/silhouettes.ts
 *
 * Category-specific SVG line-art generators for the demo pipeline.
 * Each function returns an SVG string drawing a recognizable, colorizable
 * outline of the subject (dinosaur, dragon, whale, car, flower, etc.)
 * with thick black strokes on white — suitable for the flood-fill
 * colorization step.
 *
 * These are NOT AI-generated; they are deterministic vector silhouettes
 * used when bulk AI generation is skipped.
 */

const SW = 18; // default stroke width

function wrap(body: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="white"/>
  ${body}
  <text x="512" y="990" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#444">${escXml(label)}</text>
</svg>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ─────────────────────────────────────────────────────────────────────────
// Dinosaurs — T-Rex-like bipedal body, varies by item
// ─────────────────────────────────────────────────────────────────────────
function dinosaur(item: string): string {
  // All dinosaurs get a big body, head, tail, legs. Variations per item.
  const isLongNeck = /brachio|diplodocus|bronto|sauropod/i.test(item);
  const isHorned = /triceratops|styraco|centro|kentro/i.test(item);
  const isSpiked = /stego|ankylo|kentro/i.test(item);
  const isFlying = /ptero|archaeo/i.test(item);

  if (isFlying) {
    return wrap(`
      <!-- Pterosaur: body + large wings -->
      <ellipse cx="512" cy="540" rx="120" ry="80" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- wings -->
      <path d="M 400 520 Q 200 350 80 480 Q 200 520 400 560 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 624 520 Q 824 350 944 480 Q 824 520 624 560 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- head -->
      <ellipse cx="512" cy="440" rx="70" ry="55" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- long beak crest -->
      <path d="M 560 430 Q 660 380 700 420" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- eye -->
      <circle cx="530" cy="430" r="12" fill="black"/>
      <!-- legs -->
      <path d="M 470 610 L 460 690 M 554 610 L 564 690" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
    `, item);
  }

  if (isLongNeck) {
    return wrap(`
      <!-- Sauropod: big round body + long neck + long tail -->
      <ellipse cx="520" cy="600" rx="240" ry="160" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- long neck -->
      <path d="M 360 540 Q 250 400 200 220 Q 240 200 290 240 Q 340 400 420 560" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- small head -->
      <ellipse cx="230" cy="200" rx="55" ry="42" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="215" cy="195" r="9" fill="black"/>
      <!-- long tail -->
      <path d="M 740 600 Q 880 560 960 480 Q 940 520 760 660" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- legs -->
      <rect x="400" y="740" width="60" height="100" rx="12" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="560" y="740" width="60" height="100" rx="12" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- eye on head -->
    `, item);
  }

  // Default bipedal dino (T-Rex, Velociraptor, etc.)
  const horn = isHorned
    ? `<path d="M 560 300 Q 580 220 540 180 M 620 310 Q 660 240 620 200" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>`
    : "";
  const plates = isSpiked
    ? `<path d="M 380 420 L 390 360 L 430 410 L 460 350 L 500 410 L 540 350 L 580 410 L 620 350 L 660 410 L 700 360" fill="none" stroke="black" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`
    : "";

  return wrap(`
    <!-- Bipedal dino body -->
    <ellipse cx="540" cy="560" rx="220" ry="180" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- head -->
    <ellipse cx="760" cy="400" rx="100" ry="80" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- mouth line -->
    <path d="M 690 430 L 840 420" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
    <!-- eye -->
    <circle cx="790" cy="380" r="14" fill="white" stroke="black" stroke-width="10"/>
    <circle cx="794" cy="380" r="7" fill="black"/>
    <!-- tiny arms -->
    <path d="M 640 540 L 700 580 L 730 560" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
    <!-- big legs -->
    <path d="M 460 720 L 440 850 L 520 860 L 540 740" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 600 720 L 580 850 L 660 860 L 680 740" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- tail -->
    <path d="M 340 560 Q 180 520 80 580 Q 200 600 360 640" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    ${horn}
    ${plates}
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Dragons
// ─────────────────────────────────────────────────────────────────────────
function dragon(item: string): string {
  const isIce = /ice|crystal|silver|moon|sapphire|water|ocean/i.test(item);
  const wings = `
    <path d="M 360 420 Q 150 250 60 380 Q 180 430 320 520 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 664 420 Q 874 250 964 380 Q 844 430 704 520 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- wing veins -->
    <path d="M 360 420 L 120 340 M 360 420 L 180 400 M 664 420 L 904 340 M 664 420 L 844 400" stroke="black" stroke-width="8" fill="none" stroke-linecap="round"/>
  `;
  const horns = isIce
    ? `<path d="M 460 280 L 440 200 M 564 280 L 584 200" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>`
    : `<path d="M 470 290 Q 440 230 410 250 M 554 290 Q 584 230 614 250" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>`;

  return wrap(`
    <!-- dragon body -->
    <ellipse cx="512" cy="560" rx="180" ry="140" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- long neck + head -->
    <path d="M 380 500 Q 300 380 360 280" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
    <ellipse cx="360" cy="260" rx="90" ry="70" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- snout -->
    <path d="M 280 270 L 220 290 L 280 310 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- eye -->
    <circle cx="370" cy="245" r="16" fill="white" stroke="black" stroke-width="10"/>
    <circle cx="375" cy="245" r="8" fill="black"/>
    <!-- teeth -->
    <path d="M 250 300 L 255 320 M 265 302 L 268 322 M 280 305 L 280 325" stroke="black" stroke-width="6" stroke-linecap="round"/>
    ${horns}
    ${wings}
    <!-- legs -->
    <path d="M 440 690 L 430 820 L 490 830 L 510 710" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 580 690 L 570 820 L 630 830 L 650 710" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- tail -->
    <path d="M 660 580 Q 840 560 920 640 Q 880 660 700 660" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- tail spike -->
    <path d="M 920 640 L 960 600 L 920 660 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- belly scales -->
    <path d="M 440 560 Q 512 580 584 560 M 440 600 Q 512 620 584 600" stroke="black" stroke-width="8" fill="none" stroke-linecap="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Ocean Animals
// ─────────────────────────────────────────────────────────────────────────
function oceanAnimal(item: string): string {
  const isFish = /fish|clownfish|angelfish|swordfish|puffer/i.test(item);
  const isCephalopod = /octopus|squid/i.test(item);
  const isCrustacean = /crab|lobster|shrimp|hermit/i.test(item);
  const isTurtle = /turtle/i.test(item);

  if (isCephalopod) {
    const tentacles = Array.from({ length: 8 }, (_, i) => {
      const x = 360 + i * 40;
      const wave = i % 2 === 0 ? 1 : -1;
      return `<path d="M ${x} 560 Q ${x + 20 * wave} 720 ${x + 60 * wave} 840" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>`;
    }).join("\n      ");
    return wrap(`
      <ellipse cx="512" cy="440" rx="220" ry="180" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- eyes -->
      <circle cx="440" cy="400" r="22" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="584" cy="400" r="22" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="444" cy="404" r="10" fill="black"/>
      <circle cx="588" cy="404" r="10" fill="black"/>
      ${tentacles}
    `, item);
  }

  if (isCrustacean) {
    return wrap(`
      <!-- crab body -->
      <ellipse cx="512" cy="540" rx="200" ry="140" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- eyes on stalks -->
      <path d="M 440 420 L 430 360 M 584 420 L 594 360" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <circle cx="430" cy="350" r="22" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="594" cy="350" r="22" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="430" cy="350" r="10" fill="black"/>
      <circle cx="594" cy="350" r="10" fill="black"/>
      <!-- claws -->
      <ellipse cx="250" cy="540" rx="70" ry="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <ellipse cx="774" cy="540" rx="70" ry="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <path d="M 200 520 L 180 540 L 200 560 M 824 520 L 844 540 L 824 560" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- legs -->
      <path d="M 380 660 L 360 760 M 440 680 L 430 780 M 584 680 L 594 780 M 644 660 L 664 760" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- smile -->
      <path d="M 470 560 Q 512 600 554 560" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
    `, item);
  }

  if (isTurtle) {
    return wrap(`
      <!-- shell -->
      <ellipse cx="512" cy="540" rx="240" ry="160" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- shell pattern -->
      <path d="M 400 460 L 440 420 L 512 410 L 584 420 L 624 460" fill="none" stroke="black" stroke-width="10" stroke-linejoin="round"/>
      <path d="M 400 620 L 440 660 L 512 670 L 584 660 L 624 620" fill="none" stroke="black" stroke-width="10" stroke-linejoin="round"/>
      <path d="M 512 410 L 512 670 M 380 540 L 644 540" stroke="black" stroke-width="8"/>
      <!-- head -->
      <ellipse cx="780" cy="540" rx="70" ry="55" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="800" cy="525" r="10" fill="black"/>
      <!-- flippers -->
      <ellipse cx="320" cy="450" rx="70" ry="40" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(-20 320 450)"/>
      <ellipse cx="320" cy="630" rx="70" ry="40" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(20 320 630)"/>
      <ellipse cx="700" cy="660" rx="55" ry="35" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(30 700 660)"/>
    `, item);
  }

  if (isFish) {
    return wrap(`
      <!-- fish body -->
      <path d="M 280 512 Q 380 300 660 340 Q 760 420 760 540 Q 700 660 560 680 Q 380 700 280 512 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- tail -->
      <path d="M 280 512 L 160 400 L 180 512 L 160 624 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- eye -->
      <circle cx="640" cy="440" r="20" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="646" cy="440" r="10" fill="black"/>
      <!-- gill -->
      <path d="M 580 380 Q 560 512 580 640" fill="none" stroke="black" stroke-width="12" stroke-linecap="round"/>
      <!-- fins -->
      <path d="M 480 340 Q 520 260 560 340" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 460 670 Q 520 740 580 670" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- scales -->
      <path d="M 440 480 Q 470 500 440 520 M 500 470 Q 530 490 500 510 M 440 560 Q 470 580 440 600 M 500 550 Q 530 570 500 590" stroke="black" stroke-width="8" fill="none"/>
    `, item);
  }

  // Default: whale
  return wrap(`
    <!-- whale body -->
    <path d="M 200 540 Q 320 340 620 360 Q 800 400 840 540 Q 800 680 620 720 Q 320 740 200 540 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- tail -->
    <path d="M 200 540 L 100 440 L 130 540 L 100 640 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- eye -->
    <circle cx="720" cy="480" r="18" fill="white" stroke="black" stroke-width="10"/>
    <circle cx="724" cy="480" r="9" fill="black"/>
    <!-- mouth -->
    <path d="M 760 560 Q 800 580 820 560" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
    <!-- belly lines -->
    <path d="M 360 620 Q 512 660 680 620" stroke="black" stroke-width="10" fill="none"/>
    <!-- blowhole spout -->
    <path d="M 560 340 Q 560 260 540 200 M 580 340 Q 600 260 620 220" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
    <!-- fin -->
    <path d="M 460 720 Q 500 800 560 720" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Vehicles
// ─────────────────────────────────────────────────────────────────────────
function vehicle(item: string): string {
  const isCar = /^car$|^bus$|^taxi$|^van$|^police/i.test(item);
  const isTruck = /truck|tractor|excavator|bulldozer|crane|forklift|dump/i.test(item);
  const isAir = /airplane|helicopter|rocket|glider|shuttle|plane/i.test(item);
  const isBoat = /sailboat|speedboat|boat|submarine/i.test(item);
  const isBike = /bicycle|motorcycle|scooter/i.test(item);

  if (isAir) {
    const isRocket = /rocket|shuttle/i.test(item);
    if (isRocket) {
      return wrap(`
        <!-- rocket body -->
        <path d="M 512 140 Q 620 280 620 560 L 620 740 L 404 740 L 404 560 Q 404 280 512 140 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
        <!-- window -->
        <circle cx="512" cy="380" r="50" fill="white" stroke="black" stroke-width="${SW}"/>
        <circle cx="512" cy="380" r="22" fill="black"/>
        <!-- fins -->
        <path d="M 404 660 L 320 760 L 404 740 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
        <path d="M 620 660 L 704 760 L 620 740 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
        <!-- flames -->
        <path d="M 440 740 Q 460 820 440 880 M 512 740 Q 512 840 512 900 M 584 740 Q 564 820 584 880" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
        <!-- stripes -->
        <path d="M 420 500 L 604 500 M 420 560 L 604 560" stroke="black" stroke-width="8"/>
      `, item);
    }
    // airplane
    return wrap(`
      <!-- fuselage -->
      <path d="M 200 512 Q 320 360 620 360 Q 760 380 780 512 Q 760 644 620 664 Q 320 664 200 512 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- nose -->
      <circle cx="760" cy="512" r="14" fill="black"/>
      <!-- cockpit window -->
      <path d="M 660 460 Q 720 470 740 512 Q 720 554 660 564" fill="white" stroke="black" stroke-width="12"/>
      <!-- wings -->
      <path d="M 420 460 L 280 340 L 240 360 L 380 500" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 420 564 L 280 684 L 240 664 L 380 524" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- tail fin -->
      <path d="M 240 480 L 180 360 L 220 360 L 300 500" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- tail -->
      <path d="M 240 540 L 180 660 L 220 660 L 300 524" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- windows -->
      <circle cx="460" cy="500" r="12" fill="white" stroke="black" stroke-width="8"/>
      <circle cx="540" cy="500" r="12" fill="white" stroke="black" stroke-width="8"/>
      <circle cx="620" cy="500" r="12" fill="white" stroke="black" stroke-width="8"/>
    `, item);
  }

  if (isBoat) {
    const isSub = /submarine/i.test(item);
    if (isSub) {
      return wrap(`
        <ellipse cx="512" cy="540" rx="300" ry="140" fill="white" stroke="black" stroke-width="${SW}"/>
        <!-- conning tower -->
        <rect x="460" y="360" width="104" height="100" rx="20" fill="white" stroke="black" stroke-width="${SW}"/>
        <!-- periscope -->
        <path d="M 512 360 L 512 280 L 560 280" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
        <!-- windows -->
        <circle cx="400" cy="540" r="22" fill="white" stroke="black" stroke-width="10"/>
        <circle cx="512" cy="540" r="22" fill="white" stroke="black" stroke-width="10"/>
        <circle cx="624" cy="540" r="22" fill="white" stroke="black" stroke-width="10"/>
        <!-- propeller -->
        <circle cx="820" cy="540" r="30" fill="white" stroke="black" stroke-width="${SW}"/>
        <path d="M 820 510 L 820 570 M 790 540 L 850 540" stroke="black" stroke-width="10"/>
      `, item);
    }
    return wrap(`
      <!-- hull -->
      <path d="M 160 580 L 860 580 L 760 720 L 260 720 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- cabin -->
      <rect x="380" y="440" width="260" height="140" rx="20" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- windows -->
      <rect x="420" y="470" width="60" height="50" rx="10" fill="white" stroke="black" stroke-width="10"/>
      <rect x="540" y="470" width="60" height="50" rx="10" fill="white" stroke="black" stroke-width="10"/>
      <!-- mast -->
      <path d="M 512 440 L 512 220" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- sail -->
      <path d="M 512 240 L 700 360 L 512 420 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- flag -->
      <path d="M 512 220 L 580 240 L 512 260 Z" fill="white" stroke="black" stroke-width="10" stroke-linejoin="round"/>
      <!-- waves -->
      <path d="M 200 760 Q 260 740 320 760 Q 380 740 440 760 Q 500 740 560 760 Q 620 740 680 760 Q 740 740 800 760" stroke="black" stroke-width="8" fill="none"/>
    `, item);
  }

  if (isBike) {
    return wrap(`
      <!-- wheels -->
      <circle cx="280" cy="640" r="130" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="744" cy="640" r="130" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- spokes -->
      <circle cx="280" cy="640" r="20" fill="black"/>
      <circle cx="744" cy="640" r="20" fill="black"/>
      <path d="M 280 510 L 280 770 M 150 640 L 410 640 M 220 580 L 340 700 M 220 700 L 340 580" stroke="black" stroke-width="8"/>
      <path d="M 744 510 L 744 770 M 614 640 L 874 640 M 684 580 L 804 700 M 684 700 L 804 580" stroke="black" stroke-width="8"/>
      <!-- frame -->
      <path d="M 280 640 L 512 400 L 744 640 M 512 400 L 580 280 M 440 640 L 620 640" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- handlebar -->
      <path d="M 580 280 L 640 240 M 580 280 L 540 250" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- seat -->
      <ellipse cx="500" cy="395" rx="50" ry="18" fill="white" stroke="black" stroke-width="${SW}"/>
    `, item);
  }

  if (isTruck) {
    return wrap(`
      <!-- truck cab -->
      <path d="M 560 360 L 760 360 L 800 460 L 800 640 L 560 640 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- window -->
      <rect x="600" y="400" width="160" height="80" rx="14" fill="white" stroke="black" stroke-width="12"/>
      <!-- cargo box -->
      <rect x="160" y="340" width="400" height="300" rx="20" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- cargo lines -->
      <path d="M 160 440 L 560 440 M 160 540 L 560 540" stroke="black" stroke-width="10"/>
      <!-- wheels -->
      <circle cx="280" cy="700" r="60" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="280" cy="700" r="24" fill="black"/>
      <circle cx="680" cy="700" r="60" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="680" cy="700" r="24" fill="black"/>
      <!-- headlight -->
      <circle cx="784" cy="540" r="14" fill="black"/>
    `, item);
  }

  // default: car
  return wrap(`
    <!-- car body -->
    <path d="M 180 560 Q 200 440 340 420 L 460 360 Q 620 360 720 440 L 840 480 Q 880 500 880 560 L 880 640 L 180 640 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- windows -->
    <path d="M 380 420 L 460 360 L 620 360 L 680 440 Z" fill="white" stroke="black" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 460 380 L 460 420 M 620 380 L 620 420" stroke="black" stroke-width="10"/>
    <!-- wheels -->
    <circle cx="320" cy="680" r="70" fill="white" stroke="black" stroke-width="${SW}"/>
    <circle cx="320" cy="680" r="30" fill="black"/>
    <circle cx="740" cy="680" r="70" fill="white" stroke="black" stroke-width="${SW}"/>
    <circle cx="740" cy="680" r="30" fill="black"/>
    <!-- headlight -->
    <circle cx="854" cy="540" r="14" fill="black"/>
    <!-- door handle -->
    <rect x="500" y="510" width="50" height="14" rx="7" fill="black"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Flowers
// ─────────────────────────────────────────────────────────────────────────
function flower(item: string): string {
  const petalCount = /sunflower|daisy|dandelion|chrysanthemum|cosmos|zinnia/i.test(item) ? 12 : 6;
  const petals = Array.from({ length: petalCount }, (_, i) => {
    const angle = (i * 360) / petalCount;
    return `<ellipse cx="512" cy="320" rx="80" ry="140" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(${angle} 512 460)"/>`;
  }).join("\n      ");

  return wrap(`
    <!-- petals -->
    ${petals}
    <!-- center -->
    <circle cx="512" cy="460" r="90" fill="white" stroke="black" stroke-width="${SW}"/>
    <circle cx="512" cy="460" r="60" fill="white" stroke="black" stroke-width="12"/>
    <!-- stem -->
    <path d="M 512 550 L 512 860" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
    <!-- leaves -->
    <path d="M 512 700 Q 360 660 320 740 Q 420 760 512 720" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 512 780 Q 664 740 704 820 Q 604 840 512 800" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Insects
// ─────────────────────────────────────────────────────────────────────────
function insect(item: string): string {
  const isButterfly = /butterfly|moth|damselfly/i.test(item);
  const isBee = /bee|bumblebee|wasp|hornet/i.test(item);

  if (isButterfly) {
    return wrap(`
      <!-- body -->
      <ellipse cx="512" cy="540" rx="30" ry="160" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- head -->
      <circle cx="512" cy="360" r="40" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="500" cy="350" r="8" fill="black"/>
      <circle cx="524" cy="350" r="8" fill="black"/>
      <!-- antennae -->
      <path d="M 492 330 Q 460 270 440 250 M 532 330 Q 564 270 584 250" stroke="black" stroke-width="10" fill="none" stroke-linecap="round"/>
      <circle cx="440" cy="250" r="10" fill="black"/>
      <circle cx="584" cy="250" r="10" fill="black"/>
      <!-- upper wings -->
      <path d="M 482 420 Q 260 280 200 420 Q 260 520 482 480 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 542 420 Q 764 280 824 420 Q 764 520 542 480 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- lower wings -->
      <path d="M 482 560 Q 300 600 240 720 Q 360 740 482 640 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 542 560 Q 724 600 784 720 Q 664 740 542 640 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- wing spots -->
      <circle cx="320" cy="400" r="24" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="704" cy="400" r="24" fill="white" stroke="black" stroke-width="10"/>
    `, item);
  }

  // default bug (bee/beetle)
  return wrap(`
    <!-- body -->
    <ellipse cx="512" cy="540" rx="220" ry="160" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- stripes (for bees) -->
    ${isBee ? `<path d="M 440 400 Q 440 540 440 680 M 512 390 Q 512 540 512 690 M 584 400 Q 584 540 584 680" stroke="black" stroke-width="16" fill="none"/>` : ""}
    <!-- head -->
    <circle cx="740" cy="540" r="70" fill="white" stroke="black" stroke-width="${SW}"/>
    <circle cx="760" cy="520" r="12" fill="black"/>
    <!-- antennae -->
    <path d="M 760 480 Q 800 420 820 400 M 770 480 Q 820 440 840 430" stroke="black" stroke-width="10" fill="none" stroke-linecap="round"/>
    <!-- wings -->
    <ellipse cx="460" cy="400" rx="120" ry="60" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(-15 460 400)"/>
    <ellipse cx="460" cy="680" rx="120" ry="60" fill="white" stroke="black" stroke-width="${SW}" transform="rotate(15 460 680)"/>
    <!-- legs -->
    <path d="M 360 620 L 320 720 M 440 660 L 420 760 M 560 660 L 580 760 M 640 620 L 680 720" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Wild Animals
// ─────────────────────────────────────────────────────────────────────────
function wildAnimal(item: string): string {
  const isBigCat = /lion|tiger|leopard|cheetah|panther|cat/i.test(item);
  const isBear = /bear|panda|koala/i.test(item);
  const isLongNeck = /giraffe/i.test(item);
  const isTallEars = /rabbit|hare|kangaroo/i.test(item);

  if (isLongNeck) {
    return wrap(`
      <!-- body -->
      <ellipse cx="560" cy="620" rx="200" ry="120" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- long neck -->
      <path d="M 420 580 Q 320 380 280 180 L 340 160 Q 380 380 480 560" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- head -->
      <ellipse cx="300" cy="160" rx="70" ry="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- horns -->
      <path d="M 270 130 L 260 90 M 330 130 L 340 90" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <circle cx="260" cy="90" r="12" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="340" cy="90" r="12" fill="white" stroke="black" stroke-width="10"/>
      <!-- eye -->
      <circle cx="320" cy="155" r="10" fill="black"/>
      <!-- legs -->
      <rect x="440" y="720" width="44" height="120" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="520" y="720" width="44" height="120" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="620" y="720" width="44" height="120" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="700" y="720" width="44" height="120" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- tail -->
      <path d="M 760 600 Q 860 580 880 640" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
      <!-- spots -->
      <circle cx="500" cy="600" r="18" fill="none" stroke="black" stroke-width="8"/>
      <circle cx="580" cy="620" r="18" fill="none" stroke="black" stroke-width="8"/>
      <circle cx="640" cy="590" r="18" fill="none" stroke="black" stroke-width="8"/>
    `, item);
  }

  if (isBear) {
    return wrap(`
      <!-- body -->
      <ellipse cx="512" cy="600" rx="220" ry="180" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- head -->
      <circle cx="512" cy="340" r="130" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- ears -->
      <circle cx="400" cy="240" r="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="624" cy="240" r="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="400" cy="240" r="22" fill="black"/>
      <circle cx="624" cy="240" r="22" fill="black"/>
      <!-- snout -->
      <ellipse cx="512" cy="380" rx="60" ry="44" fill="white" stroke="black" stroke-width="12"/>
      <circle cx="512" cy="360" r="14" fill="black"/>
      <!-- eyes -->
      <circle cx="470" cy="320" r="12" fill="black"/>
      <circle cx="554" cy="320" r="12" fill="black"/>
      <!-- arms -->
      <path d="M 320 620 Q 240 680 280 780 M 704 620 Q 784 680 744 780" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
      <!-- legs -->
      <ellipse cx="420" cy="780" rx="50" ry="30" fill="white" stroke="black" stroke-width="${SW}"/>
      <ellipse cx="604" cy="780" rx="50" ry="30" fill="white" stroke="black" stroke-width="${SW}"/>
    `, item);
  }

  if (isBigCat) {
    const isLion = /lion/i.test(item);
    return wrap(`
      <!-- mane (lion) or body -->
      ${isLion ? `<circle cx="480" cy="380" r="180" fill="white" stroke="black" stroke-width="${SW}"/>` : ""}
      <!-- body -->
      <ellipse cx="560" cy="620" rx="220" ry="130" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- head -->
      <circle cx="${isLion ? 480 : 440}" cy="380" r="${isLion ? 100 : 110}" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- ears -->
      <path d="M ${isLion ? 400 : 360} 300 L ${isLion ? 380 : 340} 240 L ${isLion ? 440 : 400} 280 M ${isLion ? 560 : 520} 280 L ${isLion ? 580 : 540} 240 L ${isLion ? 540 : 500} 300" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- eyes -->
      <circle cx="${isLion ? 450 : 410}" cy="370" r="12" fill="black"/>
      <circle cx="${isLion ? 520 : 480}" cy="370" r="12" fill="black"/>
      <!-- snout -->
      <ellipse cx="${isLion ? 485 : 445}" cy="420" rx="40" ry="30" fill="white" stroke="black" stroke-width="10"/>
      <circle cx="${isLion ? 485 : 445}" cy="410" r="10" fill="black"/>
      <!-- mouth -->
      <path d="M ${isLion ? 485 : 445} 430 Q ${isLion ? 465 : 425} 460 ${isLion ? 445 : 405} 440 M ${isLion ? 485 : 445} 430 Q ${isLion ? 505 : 465} 460 ${isLion ? 525 : 485} 440" stroke="black" stroke-width="10" fill="none" stroke-linecap="round"/>
      <!-- legs -->
      <path d="M 460 720 L 440 840 M 560 720 L 580 840 M 640 720 L 620 840 M 720 720 L 740 840" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- tail -->
      <path d="M 780 580 Q 880 540 900 600" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
      ${isLion ? `<circle cx="900" cy="600" r="20" fill="white" stroke="black" stroke-width="10"/>` : ""}
    `, item);
  }

  // default: four-legged animal
  return wrap(`
    <!-- body -->
    <ellipse cx="512" cy="540" rx="240" ry="150" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- head -->
    <ellipse cx="780" cy="440" rx="100" ry="90" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- ears -->
    <path d="M 740 360 L 720 280 L 770 340 M 820 360 L 840 280 L 790 340" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- eye -->
    <circle cx="800" cy="420" r="12" fill="black"/>
    <!-- snout -->
    <ellipse cx="850" cy="470" rx="40" ry="28" fill="white" stroke="black" stroke-width="10"/>
    <circle cx="860" cy="465" r="8" fill="black"/>
    <!-- legs -->
    <rect x="360" y="660" width="44" height="160" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
    <rect x="460" y="660" width="44" height="160" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
    <rect x="560" y="660" width="44" height="160" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
    <rect x="660" y="660" width="44" height="160" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- tail -->
    <path d="M 280 500 Q 180 460 160 520" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Fantasy Creatures
// ─────────────────────────────────────────────────────────────────────────
function fantasyCreature(item: string): string {
  const isUnicorn = /unicorn|pegasus/i.test(item);
  const isMermaid = /mermaid|siren/i.test(item);

  if (isUnicorn) {
    return wrap(`
      <!-- body -->
      <ellipse cx="512" cy="600" rx="220" ry="130" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- head -->
      <ellipse cx="760" cy="460" rx="90" ry="70" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- horn -->
      <path d="M 780 400 L 820 260 L 800 400 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 790 360 L 810 360 M 785 330 L 815 330 M 790 300 L 810 300" stroke="black" stroke-width="6"/>
      <!-- ear -->
      <path d="M 730 400 L 720 340 L 750 380" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- eye -->
      <circle cx="780" cy="450" r="12" fill="black"/>
      <!-- mane -->
      <path d="M 700 400 Q 640 340 620 400 Q 580 340 560 420" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- tail -->
      <path d="M 300 580 Q 200 540 160 640 Q 220 620 300 640" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- legs -->
      <rect x="400" y="700" width="40" height="140" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="480" y="700" width="40" height="140" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="580" y="700" width="40" height="140" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="660" y="700" width="40" height="140" rx="10" fill="white" stroke="black" stroke-width="${SW}"/>
    `, item);
  }

  if (isMermaid) {
    return wrap(`
      <!-- head -->
      <circle cx="512" cy="240" r="80" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- hair -->
      <path d="M 440 200 Q 380 280 400 400 M 584 200 Q 644 280 624 400" fill="none" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>
      <!-- eyes -->
      <circle cx="490" cy="240" r="10" fill="black"/>
      <circle cx="534" cy="240" r="10" fill="black"/>
      <!-- body/torso -->
      <path d="M 460 310 Q 420 420 460 520 L 564 520 Q 604 420 564 310 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- arms -->
      <path d="M 460 340 L 380 440 M 564 340 L 644 440" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
      <!-- tail -->
      <path d="M 460 520 Q 440 640 480 760 L 544 760 Q 584 640 564 520 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- tail fin -->
      <path d="M 480 760 L 380 860 L 440 880 L 512 820 L 584 880 L 644 860 L 544 760 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- scales -->
      <path d="M 470 580 Q 512 600 554 580 M 470 640 Q 512 660 554 640 M 470 700 Q 512 720 554 700" stroke="black" stroke-width="10" fill="none"/>
    `, item);
  }

  // default: wizard/gnome with hat
  return wrap(`
    <!-- body -->
    <path d="M 400 520 Q 380 700 440 820 L 584 820 Q 644 700 624 520 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- head -->
    <circle cx="512" cy="420" r="90" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- eyes -->
    <circle cx="485" cy="410" r="10" fill="black"/>
    <circle cx="540" cy="410" r="10" fill="black"/>
    <!-- beard -->
    <path d="M 460 460 Q 512 620 564 460 Q 540 580 512 600 Q 484 580 460 460" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- hat (pointy) -->
    <path d="M 420 340 L 512 120 L 604 340 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- hat brim -->
    <ellipse cx="512" cy="340" rx="120" ry="20" fill="white" stroke="black" stroke-width="${SW}"/>
    <!-- hat star -->
    <path d="M 512 200 L 524 230 L 554 230 L 530 250 L 540 280 L 512 264 L 484 280 L 494 250 L 470 230 L 500 230 Z" fill="none" stroke="black" stroke-width="8"/>
    <!-- arms -->
    <path d="M 400 560 L 340 640 M 624 560 L 684 640" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Space
// ─────────────────────────────────────────────────────────────────────────
function space(item: string): string {
  const isPlanet = /mercury|venus|earth|mars|jupiter|saturn|uranus|neptune|dwarf/i.test(item);
  const isSun = /sun/i.test(item);
  const isMoon = /moon/i.test(item);
  const isRocket = /rocket|shuttle/i.test(item);

  if (isSun) {
    const rays = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x1 = 512 + Math.cos(a) * 240;
      const y1 = 512 + Math.sin(a) * 240;
      const x2 = 512 + Math.cos(a) * 340;
      const y2 = 512 + Math.sin(a) * 340;
      return `<path d="M ${x1.toFixed(0)} ${y1.toFixed(0)} L ${x2.toFixed(0)} ${y2.toFixed(0)}" stroke="black" stroke-width="${SW}" stroke-linecap="round"/>`;
    }).join("\n      ");
    return wrap(`
      <circle cx="512" cy="512" r="200" fill="white" stroke="black" stroke-width="${SW}"/>
      ${rays}
      <!-- face -->
      <circle cx="450" cy="480" r="14" fill="black"/>
      <circle cx="574" cy="480" r="14" fill="black"/>
      <path d="M 460 560 Q 512 610 564 560" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
    `, item);
  }

  if (isMoon) {
    return wrap(`
      <circle cx="512" cy="512" r="240" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- craters -->
      <circle cx="420" cy="420" r="40" fill="none" stroke="black" stroke-width="12"/>
      <circle cx="600" cy="460" r="28" fill="none" stroke="black" stroke-width="10"/>
      <circle cx="460" cy="600" r="50" fill="none" stroke="black" stroke-width="12"/>
      <circle cx="620" cy="620" r="22" fill="none" stroke="black" stroke-width="10"/>
      <circle cx="380" cy="540" r="18" fill="none" stroke="black" stroke-width="8"/>
    `, item);
  }

  if (isRocket) {
    return wrap(`
      <path d="M 512 140 Q 620 280 620 560 L 620 740 L 404 740 L 404 560 Q 404 280 512 140 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <circle cx="512" cy="380" r="50" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="512" cy="380" r="22" fill="black"/>
      <path d="M 404 660 L 320 760 L 404 740 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 620 660 L 704 760 L 620 740 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 440 740 Q 460 820 440 880 M 512 740 Q 512 840 512 900 M 584 740 Q 564 820 584 880" stroke="black" stroke-width="${SW}" fill="none" stroke-linecap="round"/>
      <path d="M 420 500 L 604 500 M 420 560 L 604 560" stroke="black" stroke-width="8"/>
      <!-- stars -->
      <path d="M 200 200 L 210 220 L 230 220 L 214 234 L 220 254 L 200 242 L 180 254 L 186 234 L 170 220 L 190 220 Z" fill="none" stroke="black" stroke-width="6"/>
      <path d="M 820 300 L 826 314 L 840 314 L 828 324 L 832 338 L 820 330 L 808 338 L 812 324 L 800 314 L 814 314 Z" fill="none" stroke="black" stroke-width="6"/>
    `, item);
  }

  if (isPlanet) {
    const hasRings = /saturn|uranus/i.test(item);
    return wrap(`
      <circle cx="512" cy="512" r="220" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- surface bands -->
      <path d="M 320 440 Q 512 470 704 440 M 300 512 Q 512 542 724 512 M 320 584 Q 512 614 704 584" stroke="black" stroke-width="12" fill="none"/>
      ${hasRings ? `<ellipse cx="512" cy="512" rx="340" ry="80" fill="none" stroke="black" stroke-width="${SW}"/>` : ""}
      <!-- stars -->
      <path d="M 180 200 L 186 214 L 200 214 L 188 224 L 192 238 L 180 230 L 168 238 L 172 224 L 160 214 L 174 214 Z" fill="none" stroke="black" stroke-width="6"/>
      <path d="M 840 700 L 846 714 L 860 714 L 848 724 L 852 738 L 840 730 L 828 738 L 832 724 L 820 714 L 834 714 Z" fill="none" stroke="black" stroke-width="6"/>
    `, item);
  }

  // default: star/comet
  return wrap(`
    <path d="M 512 160 L 560 420 L 820 460 L 560 500 L 512 860 L 464 500 L 204 460 L 464 420 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <circle cx="512" cy="460" r="60" fill="white" stroke="black" stroke-width="12"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Food & Sweets
// ─────────────────────────────────────────────────────────────────────────
function food(item: string): string {
  const isIceCream = /ice cream|popsicle/i.test(item);
  const isCake = /cake|cupcake|brownie|cheesecake|donut|muffin|pie|apple pie/i.test(item);
  const isFruit = /apple|banana|orange|watermelon|kiwi|strawberry|cherry/i.test(item);

  if (isIceCream) {
    return wrap(`
      <!-- scoop -->
      <circle cx="512" cy="380" r="160" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="420" cy="340" r="80" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="604" cy="340" r="80" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- cone -->
      <path d="M 380 480 L 512 860 L 644 480 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
      <!-- cone crosshatch -->
      <path d="M 420 540 L 580 580 M 460 640 L 564 660 M 480 720 L 544 730" stroke="black" stroke-width="8"/>
      <!-- cherry on top -->
      <circle cx="512" cy="200" r="24" fill="white" stroke="black" stroke-width="12"/>
      <path d="M 512 176 L 512 140" stroke="black" stroke-width="10" stroke-linecap="round"/>
    `, item);
  }

  if (/donut/i.test(item)) {
    return wrap(`
      <circle cx="512" cy="512" r="260" fill="white" stroke="black" stroke-width="${SW}"/>
      <circle cx="512" cy="512" r="90" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- sprinkles -->
      <rect x="380" y="360" width="40" height="14" rx="7" fill="black" transform="rotate(20 400 367)"/>
      <rect x="600" y="380" width="40" height="14" rx="7" fill="black" transform="rotate(-15 620 387)"/>
      <rect x="340" y="560" width="40" height="14" rx="7" fill="black" transform="rotate(45 360 567)"/>
      <rect x="640" y="580" width="40" height="14" rx="7" fill="black" transform="rotate(-30 660 587)"/>
      <rect x="460" y="300" width="40" height="14" rx="7" fill="black"/>
      <rect x="540" y="700" width="40" height="14" rx="7" fill="black"/>
    `, item);
  }

  if (isCake) {
    return wrap(`
      <!-- plate -->
      <ellipse cx="512" cy="800" rx="340" ry="40" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- cake layers -->
      <rect x="240" y="560" width="544" height="200" rx="20" fill="white" stroke="black" stroke-width="${SW}"/>
      <rect x="300" y="420" width="424" height="160" rx="20" fill="white" stroke="black" stroke-width="${SW}"/>
      <!-- frosting drips -->
      <path d="M 300 440 Q 320 480 340 440 Q 360 480 380 440 Q 400 480 420 440 Q 440 480 460 440 Q 480 480 500 440 Q 520 480 540 440 Q 560 480 580 440 Q 600 480 620 440 Q 640 480 660 440 Q 680 480 700 440 Q 720 480 724 440" stroke="black" stroke-width="12" fill="none"/>
      <!-- candles -->
      <rect x="440" y="300" width="20" height="120" rx="6" fill="white" stroke="black" stroke-width="10"/>
      <rect x="564" y="300" width="20" height="120" rx="6" fill="white" stroke="black" stroke-width="10"/>
      <!-- flames -->
      <path d="M 450 300 Q 440 270 450 250 Q 460 270 450 300 M 574 300 Q 564 270 574 250 Q 584 270 574 300" fill="white" stroke="black" stroke-width="10" stroke-linejoin="round"/>
      <!-- decorations -->
      <circle cx="360" cy="660" r="14" fill="black"/>
      <circle cx="460" cy="680" r="14" fill="black"/>
      <circle cx="560" cy="660" r="14" fill="black"/>
      <circle cx="660" cy="680" r="14" fill="black"/>
    `, item);
  }

  // default: cupcake / dessert
  return wrap(`
    <!-- wrapper -->
    <path d="M 340 540 L 380 820 L 644 820 L 684 540 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 380 580 L 644 580 M 400 660 L 624 660 M 420 740 L 604 740" stroke="black" stroke-width="10"/>
    <!-- frosting -->
    <path d="M 300 540 Q 360 380 512 380 Q 664 380 724 540 Q 664 500 512 500 Q 360 500 300 540 Z" fill="white" stroke="black" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- frosting swirl -->
    <path d="M 380 440 Q 440 360 512 380 Q 584 360 644 440" fill="none" stroke="black" stroke-width="12"/>
    <!-- cherry -->
    <circle cx="512" cy="320" r="30" fill="white" stroke="black" stroke-width="12"/>
    <path d="M 512 290 L 512 250" stroke="black" stroke-width="10" stroke-linecap="round"/>
  `, item);
}

// ─────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────
export function generateSilhouetteSvg(item: string, category: string): string {
  switch (category) {
    case "Dinosaurs":
      return dinosaur(item);
    case "Dragons":
      return dragon(item);
    case "Ocean Animals":
      return oceanAnimal(item);
    case "Vehicles":
      return vehicle(item);
    case "Flowers":
      return flower(item);
    case "Insects":
      return insect(item);
    case "Wild Animals":
      return wildAnimal(item);
    case "Fantasy Creatures":
      return fantasyCreature(item);
    case "Space":
      return space(item);
    case "Food & Sweets":
      return food(item);
    default:
      return dinosaur(item);
  }
}
