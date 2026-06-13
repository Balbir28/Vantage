// ============================================================
//  MOCK DATA — shaped to mirror the production schema.
//  Replace these exports with fetch() calls to your API / committed
//  audit JSON. Field names match the blueprint's tables.
// ============================================================

export const audit = {
  subject: { name: "Lumen Skincare", domain: "lumenskin.co", industry: "D2C Beauty" },
  competitors: ["Glow Theory", "Aurelia", "Dewdrop", "Sönder"],
  date: "13 Jun 2026",
  creativesAnalyzed: 412,
  winnersFound: 37,
};

// Growth Potential Score (/100) + weighted sub-scores  (§5)
export const growth = {
  total: 64,
  subs: [
    { nm: "Acquisition", val: 71, weight: 25 },
    { nm: "Conversion", val: 58, weight: 25 },
    { nm: "Retention", val: 49, weight: 20 },
    { nm: "Brand Equity", val: 67, weight: 15 },
    { nm: "AI Visibility", val: 38, weight: 15 },
  ],
};

export const kpis = [
  { lbl: "Competitor creatives analyzed", v: "412", delta: "+48 this week", dir: "up" },
  { lbl: "Proven winning ads found", v: "37", delta: "+6 new winners", dir: "up" },
  { lbl: "AEO share-of-voice", v: "18%", delta: "−4 pts vs Q1", dir: "down" },
  { lbl: "Keyword opportunities", v: "143", delta: "61 high-intent", dir: "up" },
];

// RICE-ranked opportunities (Module 6 / §5)
export const opportunities = [
  { t: "Open the 'Problem-Aware × Educational' white space", d: "No competitor runs educational problem-aware creative — your highest-affinity untapped cell. Test 3 founder-led explainer hooks.", impact: "High", effort: "Low", conf: "0.82", score: 92, tags: ["Meta", "Creative"] },
  { t: "Bid on 18 competitor-validated 'Steal' keywords", d: "Aurelia & Glow Theory bid on these transactional terms; you're absent. ₹ low CPC, proven intent.", impact: "High", effort: "Low", conf: "0.88", score: 89, tags: ["Google", "Paid"] },
  { t: "Fix AEO citation gap on 'best vitamin C serum'", d: "Perplexity & ChatGPT cite competitors 4:1. You lack a citable comparison asset and schema.", impact: "High", effort: "Med", conf: "0.74", score: 81, tags: ["AEO"] },
  { t: "Add review + delivery trust block to PDP", d: "Top 3 competitors surface reviews above the fold; your PDP buries them. Est. +6–9% CVR.", impact: "Med", effort: "Low", conf: "0.79", score: 77, tags: ["CRO"] },
  { t: "Launch counter-positioning vs Glow Theory's discount play", d: "They own scarcity/urgency at most-aware. Counter with a guarantee-led trust angle, not deeper discounts.", impact: "Med", effort: "Med", conf: "0.7", score: 72, tags: ["Strategy"] },
];

export const mistakes = [
  { t: "Single-angle creative concentration", d: "68% of your spend sits in one 'feature-based' angle — fatiguing fast.", fix: "Diversify into 2 untapped cells." },
  { t: "No brand-term defense", d: "Aurelia is conquesting 'lumen serum' with no resistance.", fix: "Launch an exact-match brand campaign." },
  { t: "Thin AI-citable content", d: "Zero comparison or 'best-of' pages → invisible to answer engines.", fix: "Publish 3 structured comparison pages." },
];

// ---------- ANGLE × AWARENESS MATRIX  (Module 13) ----------
export const awarenessStages = [
  { key: "unaware", nm: "Unaware", sub: "no problem felt" },
  { key: "problem", nm: "Problem-Aware", sub: "feels the pain" },
  { key: "solution", nm: "Solution-Aware", sub: "knows options" },
  { key: "product", nm: "Product-Aware", sub: "knows you" },
  { key: "most", nm: "Most-Aware", sub: "ready to buy" },
];
export const angles = ["Educational", "Pain-Point", "Transform", "Before/After", "Comparison", "Social Proof", "Testimonial", "Offer/Urgency"];

// verdict: own | attack | contest | avoid ; owner + saturation + subjectPos
function c(verdict, owner, sat, pos, note) { return { verdict, owner, sat, pos, note }; }
export const matrix = {
  unaware:  [c("attack","—",0.08,0.0,"Highest-affinity gap. No one teaches the unaware buyer."), c("contest","Dewdrop",0.3,0.15), c("own","Lumen",0.2,0.55,"You lead aspirational transformation here."), c("avoid","—",0.1,0.05), c("avoid","—",0.05,0), c("avoid","—",0.08,0), c("avoid","—",0.04,0), c("avoid","—",0.02,0)],
  problem:  [c("attack","—",0.06,0.05,"Untapped. Founder explainer fits perfectly."), c("own","Lumen",0.35,0.48), c("contest","Aurelia",0.4,0.2), c("contest","Dewdrop",0.45,0.18), c("avoid","Glow Theory",0.5,0.06), c("avoid","Aurelia",0.55,0.05), c("avoid","—",0.2,0.05), c("avoid","—",0.05,0)],
  solution: [c("contest","Aurelia",0.5,0.18), c("avoid","Glow Theory",0.6,0.05), c("contest","—",0.35,0.22), c("own","Lumen",0.4,0.5), c("attack","—",0.18,0.08,"Comparison angle thin — citable + AEO win."), c("avoid","Glow Theory",0.7,0.04), c("contest","Aurelia",0.45,0.2), c("avoid","—",0.25,0.05)],
  product:  [c("avoid","—",0.2,0.05), c("avoid","—",0.15,0.04), c("avoid","Aurelia",0.55,0.06), c("contest","Dewdrop",0.4,0.2), c("avoid","Glow Theory",0.75,0.05), c("avoid","Aurelia",0.8,0.06,"Heavily owned — avoid head-on."), c("own","Lumen",0.45,0.52), c("contest","—",0.5,0.22)],
  most:     [c("avoid","—",0.1,0.03), c("avoid","—",0.08,0.02), c("avoid","—",0.3,0.05), c("avoid","—",0.25,0.06), c("contest","Aurelia",0.5,0.2), c("avoid","Glow Theory",0.7,0.08), c("contest","Dewdrop",0.55,0.22), c("avoid","Glow Theory",0.88,0.05,"Glow Theory dominates discounts. Counter-position, don't match.")],
};

// Creative Testing Roadmap — spawned from ATTACK cells (Module 12)
export const creativeTests = [
  { angle: "Educational × Problem-Aware", fmt: "Reel · Founder UGC", hook: "\"Dermatologists won't tell you why your serum stings — here's the real reason.\"", why: "Pure white space — no competitor occupies this high-affinity cell.", rice: 92 },
  { angle: "Comparison × Solution-Aware", fmt: "Static carousel", hook: "\"We bought the 5 viral vitamin-C serums. Only 2 actually had active C.\"", why: "Thin coverage + doubles as an AEO-citable asset.", rice: 84 },
  { angle: "Transform × Unaware", fmt: "Reel · Before/After", hook: "\"30 days, zero filters.\"", why: "Defend a cell you already lead before Dewdrop scales in.", rice: 71 },
  { angle: "Testimonial × Product-Aware", fmt: "UGC montage", hook: "\"I almost returned it on day 3. Day 21 changed my mind.\"", why: "De-risk the convinced-but-hesitant buyer with honest testimonial.", rice: 68 },
];

// ---------- CREATIVE INTELLIGENCE (Module 1) ----------
export const winners = [
  { brand: "Aurelia", hook: "Your 9-step routine is the problem.", grad: "linear-gradient(135deg,#ff6b9d,#c44569)", days: 118, score: 94, fmt: "Reel", placements: 6 },
  { brand: "Glow Theory", hook: "48-hour glow, guaranteed or refunded.", grad: "linear-gradient(135deg,#f6d365,#fda085)", days: 96, score: 90, fmt: "Story", placements: 5 },
  { brand: "Lumen", hook: "30 days, zero filters.", grad: "linear-gradient(135deg,#1fb8a6,#18a4cf)", days: 73, score: 82, fmt: "Reel", placements: 4, you: true },
  { brand: "Dewdrop", hook: "The serum your derm actually uses.", grad: "linear-gradient(135deg,#a18cd1,#fbc2eb)", days: 64, score: 78, fmt: "Feed", placements: 4 },
  { brand: "Aurelia", hook: "Before you buy another serum, watch this.", grad: "linear-gradient(135deg,#84fab0,#8fd3f4)", days: 51, score: 74, fmt: "Reel", placements: 3 },
  { brand: "Sönder", hook: "Minimalism for your skin.", grad: "linear-gradient(135deg,#30cfd0,#330867)", days: 22, score: 51, fmt: "Feed", placements: 2 },
];

export const hookFreq = [
  { nm: "Pain-point", v: 84, col: "var(--coral)" },
  { nm: "Social proof", v: 71, col: "var(--indigo)" },
  { nm: "Transformation", v: 63, col: "var(--teal)" },
  { nm: "Offer / urgency", v: 58, col: "var(--amber)" },
  { nm: "Comparison", v: 24, col: "var(--teal-2)" },
  { nm: "Educational", v: 11, col: "var(--green)" },
];

// ---------- KEYWORD ACTION PLAN (Module 14) ----------
export const keywords = {
  steal: [
    { kw: "vitamin c serum for acne", vol: 18100, cpc: 1.9, intent: "Transactional", comp: "Aurelia, Glow Theory", score: 94, action: "Launch ad group" },
    { kw: "best serum for dark spots", vol: 12400, cpc: 2.3, intent: "Commercial", comp: "Aurelia", score: 88, action: "Launch ad group" },
    { kw: "niacinamide serum buy", vol: 6600, cpc: 1.4, intent: "Transactional", comp: "Glow Theory, Dewdrop", score: 83, action: "Launch ad group" },
    { kw: "korean glass skin serum", vol: 9900, cpc: 2.0, intent: "Commercial", comp: "Dewdrop", score: 79, action: "Test ad group" },
  ],
  defend: [
    { kw: "lumen serum", vol: 2400, cpc: 0.6, intent: "Navigational", comp: "Aurelia ⚠", score: 91, action: "Exact-match defend" },
    { kw: "lumen skincare review", vol: 1300, cpc: 0.7, intent: "Commercial", comp: "Glow Theory", score: 78, action: "Brand campaign + TM review" },
    { kw: "lumen vitamin c price", vol: 880, cpc: 0.5, intent: "Transactional", comp: "—", score: 64, action: "Capture branded intent" },
  ],
  expand: [
    { kw: "serum that doesn't cause purging", vol: 5400, cpc: 1.1, intent: "Commercial", comp: "Nobody", score: 86, action: "Uncontested — capture" },
    { kw: "fragrance free vitamin c", vol: 4100, cpc: 1.3, intent: "Commercial", comp: "Nobody", score: 80, action: "Uncontested — capture" },
    { kw: "serum for sensitive oily skin", vol: 3300, cpc: 1.0, intent: "Commercial", comp: "Nobody", score: 73, action: "Test ad group" },
  ],
};

// ---------- AEO VISIBILITY (Module 5) ----------
export const aeo = {
  discoverability: 38,
  engines: [
    { nm: "ChatGPT", you: 22, comp: 78 },
    { nm: "Gemini", you: 14, comp: 86 },
    { nm: "Claude", you: 19, comp: 81 },
    { nm: "Perplexity", you: 16, comp: 84 },
  ],
  citations: [
    { src: "Reddit r/SkincareAddiction", who: "Aurelia ×7, Glow ×4", you: 1, tone: "coral" },
    { src: "Healthline / Byrdie editorial", who: "Aurelia ×5", you: 0, tone: "coral" },
    { src: "YouTube derm reviews", who: "Dewdrop ×6", you: 2, tone: "amber" },
    { src: "Your own blog", who: "Lumen ×3", you: 3, tone: "teal" },
  ],
  recs: [
    "Publish 3 structured comparison pages with FAQ + Product schema — the #1 lever for citation pickup.",
    "Seed honest founder answers into 5 high-traffic Reddit threads where competitors are cited.",
    "Earn 2 editorial mentions (Byrdie / Healthline tier) to enter the authority citation pool.",
    "Add Organization + sameAs entity markup to strengthen your knowledge-graph node.",
  ],
};

// ---------- STRATEGIST (Module 6) ----------
export const strategist = {
  summary: "Lumen holds a credible mid-market position with one genuinely strong asset — a leading 'transformation' creative angle and a healthy acquisition score (71). But growth is throttled by three structural gaps. First, creative concentration: 68% of spend sits in a single fatiguing angle while two high-affinity white-space cells sit empty. Second, near-zero answer-engine presence (AI Visibility 38) means you're invisible exactly where high-intent buyers now research. Third, your brand terms are undefended against Aurelia's conquesting. None require more budget — they require redistribution. Executed in sequence, the plan below projects a 9–14% blended CVR lift and a meaningful recovery of share-of-voice within two quarters.",
  d30: ["Launch brand-term defense campaign (exact match)", "Ship 3 creative tests into the Problem-Aware × Educational white space", "Add review + delivery trust block above PDP fold", "Bid the top 8 'Steal' keywords"],
  d90: ["Publish 3 AEO-citable comparison pages with schema", "Build a counter-positioning campaign vs Glow Theory's discount play", "Establish weekly creative-velocity cadence (2 new angles/wk)", "Seed founder answers across cited Reddit/forum threads"],
  d365: ["Earn editorial authority citations (Byrdie/Healthline tier)", "Expand into the 2 newly-validated white-space angles at scale", "Stand up retention flows (email/SMS) to lift the 49 retention score", "Reach 35%+ AEO share-of-voice on core category queries"],
};
