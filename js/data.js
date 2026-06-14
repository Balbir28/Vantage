// ============================================================
//  MOCK DATA — shaped to mirror the production schema.
//  Replace these exports with fetch() calls to your API / committed
//  audit JSON. Field names match the blueprint's tables.
// ============================================================

export const audit = {
  subject: { name: "Bebodywise", domain: "bebodywise.com", industry: "D2C Personal Care" },
  competitors: ["&Me", "OZiva", "Gynoveda", "Nua"],
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
  { t: "Bid on 18 competitor-validated 'Steal' keywords", d: "&Me & OZiva bid on these transactional terms; you're absent. ₹ low CPC, proven intent.", impact: "High", effort: "Low", conf: "0.88", score: 89, tags: ["Google", "Paid"] },
  { t: "Fix AEO/GEO citation gap on 'best hair growth serum for women india'", d: "Perplexity & ChatGPT cite competitors 4:1. You lack a citable comparison asset and schema.", impact: "High", effort: "Med", conf: "0.74", score: 81, tags: ["AEO", "GEO"] },
  { t: "Add review + delivery trust block to PDP", d: "Top 3 competitors surface reviews above the fold; your PDP buries them. Est. +6–9% CVR.", impact: "Med", effort: "Low", conf: "0.79", score: 77, tags: ["CRO"] },
  { t: "Launch counter-positioning vs OZiva's discount play", d: "They own scarcity/urgency at most-aware. Counter with a clinical-proof, side-effect-free angle, not deeper discounts.", impact: "Med", effort: "Med", conf: "0.7", score: 72, tags: ["Strategy"] },
];

export const mistakes = [
  { t: "Single-angle creative concentration", d: "68% of your spend sits in one 'feature-based' angle — fatiguing fast.", fix: "Diversify into 2 untapped cells." },
  { t: "No brand-term defense", d: "&Me is conquesting 'bebodywise' with no resistance.", fix: "Launch an exact-match brand campaign." },
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
  unaware:  [c("attack","—",0.08,0.0,"Highest-affinity gap. No one teaches the unaware buyer."), c("contest","Gynoveda",0.3,0.15), c("own","Bebodywise",0.2,0.55,"You lead aspirational transformation here."), c("avoid","—",0.1,0.05), c("avoid","—",0.05,0), c("avoid","—",0.08,0), c("avoid","—",0.04,0), c("avoid","—",0.02,0)],
  problem:  [c("attack","—",0.06,0.05,"Untapped. Founder explainer fits perfectly."), c("own","Bebodywise",0.35,0.48), c("contest","&Me",0.4,0.2), c("contest","Gynoveda",0.45,0.18), c("avoid","OZiva",0.5,0.06), c("avoid","&Me",0.55,0.05), c("avoid","—",0.2,0.05), c("avoid","—",0.05,0)],
  solution: [c("contest","&Me",0.5,0.18), c("avoid","OZiva",0.6,0.05), c("contest","—",0.35,0.22), c("own","Bebodywise",0.4,0.5), c("attack","—",0.18,0.08,"Comparison angle thin — citable + AEO/GEO win."), c("avoid","OZiva",0.7,0.04), c("contest","&Me",0.45,0.2), c("avoid","—",0.25,0.05)],
  product:  [c("avoid","—",0.2,0.05), c("avoid","—",0.15,0.04), c("avoid","&Me",0.55,0.06), c("contest","Nua",0.4,0.2), c("avoid","OZiva",0.75,0.05), c("avoid","&Me",0.8,0.06,"Heavily owned — avoid head-on."), c("own","Bebodywise",0.45,0.52), c("contest","—",0.5,0.22)],
  most:     [c("avoid","—",0.1,0.03), c("avoid","—",0.08,0.02), c("avoid","—",0.3,0.05), c("avoid","—",0.25,0.06), c("contest","&Me",0.5,0.2), c("avoid","OZiva",0.7,0.08), c("contest","Nua",0.55,0.22), c("avoid","OZiva",0.88,0.05,"OZiva dominates discounts. Counter-position, don't match.")],
};

// Creative Testing Roadmap — spawned from ATTACK cells (Module 12)
export const creativeTests = [
  { angle: "Educational × Problem-Aware", fmt: "Reel · Founder UGC", hook: "\"Why your hairfall isn't stopping — it's not the shampoo, it's your roots.\"", why: "Pure white space — no Indian competitor occupies this high-affinity cell.", rice: 92 },
  { angle: "Comparison × Solution-Aware", fmt: "Static carousel", hook: "\"We tested 5 viral hair-growth serums. Only 2 had clinically-backed actives.\"", why: "Thin coverage + doubles as an AEO/GEO-citable asset.", rice: 84 },
  { angle: "Transform × Unaware", fmt: "Reel · Before/After", hook: "\"90 days. Visible regrowth. No minoxidil, no side effects.\"", why: "Defend a cell you already lead before Gynoveda scales in.", rice: 71 },
  { angle: "Testimonial × Product-Aware", fmt: "UGC montage", hook: "\"Almost gave up at week 3. Week 8 changed everything.\"", why: "De-risk the convinced-but-hesitant buyer with honest testimonial.", rice: 68 },
];

// ---------- CREATIVE INTELLIGENCE (Module 1) ----------
export const winners = [
  { brand: "&Me", hook: "The hair gummies that actually grew my hair.", grad: "linear-gradient(135deg,#ff6b9d,#c44569)", days: 118, score: 94, fmt: "Reel", placements: 6 },
  { brand: "OZiva", hook: "PCOS? Your hairfall starts here.", grad: "linear-gradient(135deg,#f6d365,#fda085)", days: 96, score: 90, fmt: "Story", placements: 5 },
  { brand: "Bebodywise", hook: "90 days. Visible regrowth. No side effects.", grad: "linear-gradient(135deg,#1fb8a6,#18a4cf)", days: 73, score: 82, fmt: "Reel", placements: 4, you: true },
  { brand: "Gynoveda", hook: "Fix your period from the root.", grad: "linear-gradient(135deg,#a18cd1,#fbc2eb)", days: 64, score: 78, fmt: "Feed", placements: 4 },
  { brand: "&Me", hook: "Before you buy another hair serum, watch this.", grad: "linear-gradient(135deg,#84fab0,#8fd3f4)", days: 51, score: 74, fmt: "Reel", placements: 3 },
  { brand: "Nua", hook: "Skincare that respects your hormones.", grad: "linear-gradient(135deg,#30cfd0,#330867)", days: 22, score: 51, fmt: "Feed", placements: 2 },
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
    { kw: "hair growth serum for women", vol: 40500, cpc: 15, intent: "Transactional", comp: "&Me, Gynoveda", score: 94, action: "Launch ad group" },
    { kw: "biotin gummies for hair growth", vol: 27100, cpc: 12, intent: "Commercial", comp: "&Me", score: 88, action: "Launch ad group" },
    { kw: "pcos weight loss supplement", vol: 18100, cpc: 18, intent: "Transactional", comp: "OZiva, Gynoveda", score: 83, action: "Launch ad group" },
    { kw: "anti hairfall shampoo for women", vol: 22200, cpc: 10, intent: "Commercial", comp: "OZiva", score: 79, action: "Test ad group" },
  ],
  defend: [
    { kw: "bebodywise", vol: 18100, cpc: 6, intent: "Navigational", comp: "&Me ⚠", score: 91, action: "Exact-match defend" },
    { kw: "bebodywise review", vol: 5400, cpc: 5, intent: "Commercial", comp: "OZiva", score: 78, action: "Brand campaign + TM review" },
    { kw: "bebodywise hair growth serum price", vol: 3600, cpc: 7, intent: "Transactional", comp: "—", score: 64, action: "Capture branded intent" },
  ],
  expand: [
    { kw: "hair regrowth without minoxidil", vol: 9900, cpc: 9, intent: "Commercial", comp: "Nobody", score: 86, action: "Uncontested — capture" },
    { kw: "period pain relief patch", vol: 8100, cpc: 7, intent: "Commercial", comp: "Nobody", score: 80, action: "Uncontested — capture" },
    { kw: "sunscreen no white cast indian skin", vol: 6600, cpc: 8, intent: "Commercial", comp: "Nobody", score: 73, action: "Test ad group" },
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
    { src: "Reddit r/IndianSkincareAddicts", who: "&Me ×7, Gynoveda ×4", you: 1, tone: "coral" },
    { src: "Reddit r/PCOS", who: "OZiva ×5", you: 0, tone: "coral" },
    { src: "YouTube haircare reviews (IN)", who: "&Me ×6", you: 2, tone: "amber" },
    { src: "Your own blog", who: "Bebodywise ×3", you: 3, tone: "teal" },
  ],
  recs: [
    "Publish 3 structured comparison pages with FAQ + Product schema — the #1 lever for citation pickup.",
    "Seed honest founder answers into 5 high-traffic r/IndianSkincareAddicts & r/IndianHaircare threads where competitors are cited.",
    "Earn 2 editorial mentions (Nykaa/Cosmopolitan India / GQ India tier) to enter the authority citation pool.",
    "Add Organization + sameAs entity markup to strengthen your knowledge-graph node.",
  ],
};

// ---------- STRATEGIST (Module 6) ----------
export const strategist = {
  summary: "Bebodywise holds a credible mid-market position with one genuinely strong asset — a leading 'transformation' creative angle and a healthy acquisition score (71). But growth is throttled by three structural gaps. First, creative concentration: 68% of spend sits in a single fatiguing angle while two high-affinity white-space cells sit empty. Second, near-zero answer-engine presence (AI Visibility 38) means you're invisible exactly where high-intent buyers now research. Third, your brand terms are undefended against &Me's conquesting. None require more budget — they require redistribution. Executed in sequence, the plan below projects a 9–14% blended CVR lift and a meaningful recovery of share-of-voice within two quarters.",
  d30: ["Launch brand-term defense campaign (exact match)", "Ship 3 creative tests into the Problem-Aware × Educational white space", "Add review + delivery trust block above PDP fold", "Bid the top 8 'Steal' keywords"],
  d90: ["Publish 3 AEO/GEO-citable comparison pages with schema", "Build a counter-positioning campaign vs OZiva's discount play", "Establish weekly creative-velocity cadence (2 new angles/wk)", "Seed founder answers across cited Reddit/forum threads"],
  d365: ["Earn editorial authority citations (GQ India / Nykaa tier)", "Expand into the 2 newly-validated white-space angles at scale", "Stand up retention flows (WhatsApp/email/SMS) to lift the 49 retention score", "Reach 35%+ AEO + GEO share-of-voice on core category queries"],
};

// ============================================================
//  INDIAN D2C COMPETITOR MAP — brand → realistic same-category rivals.
//  Used to auto-suggest competitors when only a brand name is entered.
// ============================================================
export const indiaBrands = {
  // Bebodywise (Mosaic Wellness) = WOMEN's health & personal care. Its men's sibling is Man Matters.
  "womens wellness": { match: ["bebodywise", "&me", "and me", "oziva", "gynoveda", "nua", "sirona", "pee safe", "carmesi", "imbue", "hyugalife", "mosaic wellness", "my muse"],
    set: ["&Me", "OZiva", "Gynoveda", "Nua", "Sirona"] },
  "mens grooming": { match: ["man matters", "the man company", "beardo", "ustraa", "bombay shaving", "mars by ghc", "bombae"],
    set: ["The Man Company", "Beardo", "Ustraa", "Bombay Shaving Co", "Man Matters"] },
  "womens skincare": { match: ["minimalist", "plum", "dot & key", "dot and key", "pilgrim", "the derma co", "foxtale", "deconstruct", "reequil", "fae"],
    set: ["Minimalist", "The Derma Co", "Dot & Key", "Plum", "Pilgrim"] },
  "haircare": { match: ["traya", "mamaearth", "wow", "arata", "bare anatomy", "tru hair", "vilvah"],
    set: ["Mamaearth", "WOW Skin Science", "Traya", "Arata", "Bare Anatomy"] },
  "makeup beauty": { match: ["sugar", "mcaffeine", "swiss beauty", "renee", "myglamm", "lakme", "insight", "stay quirky"],
    set: ["SUGAR Cosmetics", "MyGlamm", "Swiss Beauty", "Renee", "mCaffeine"] },
  "nutrition sports": { match: ["healthkart", "muscleblaze", "kapiva", "wellbeing nutrition", "plix", "setu", "fast&up", "the whole truth nutrition"],
    set: ["Kapiva", "Plix", "Wellbeing Nutrition", "HealthKart", "OZiva"] },
  "coffee fmcg": { match: ["sleepy owl", "blue tokai", "rage coffee", "country bean", "slay coffee", "the whole truth", "yoga bar", "open secret"],
    set: ["Sleepy Owl", "Blue Tokai", "Rage Coffee", "The Whole Truth", "Yogabar"] },
  "apparel": { match: ["bewakoof", "the souled store", "snitch", "rare rabbit", "powerlook", "damensch", "xyxx", "bummer"],
    set: ["The Souled Store", "Snitch", "Bewakoof", "XYXX", "DaMENSCH"] },
  "eyewear": { match: ["lenskart", "specsmakers", "john jacobs", "cleardekho"], set: ["Lenskart", "John Jacobs", "Specsmakers", "ClearDekho"] },
};
export const defaultIndiaSet = ["Mamaearth", "The Derma Co", "Minimalist", "Plum", "WOW Skin Science"];

// ============================================================
//  MARKET RESEARCH ENGINE — the "5 websites" (Reddit/Amazon/YouTube/Google/Instagram)
//  Live where free (Google Suggest + Reddit fetched in-browser); deep-links + framework
//  for Amazon/YouTube/Instagram (no free API). Representative content below is the fallback.
// ============================================================
export const research = {
  reddit: [
    { t: "Did anyone's hairfall actually stop with biotin gummies, or is it hype?", sub: "r/IndianSkincareAddicts", up: 287 },
    { t: "PCOS + hairfall — what actually worked for you?", sub: "r/PCOS", up: 341 },
    { t: "Hair fall at 24 — scared of minoxidil, are there safe alternatives?", sub: "r/IndianHaircare", up: 312 },
    { t: "Honest review: is Bebodywise worth it or just influencer marketing?", sub: "r/TwoXIndia", up: 124 },
  ],
  amazon: [
    { gap: "\"Took it 2 months, saw no visible regrowth\"", signal: "Efficacy doubt — lead with clinical proof + timeline", pct: "31% of 1-3★" },
    { gap: "\"Caused bloating / didn't suit me\"", signal: "Side-effect anxiety — reassure + dosage guidance", pct: "19% of 1-3★" },
    { gap: "\"Overpriced vs buying biotin separately\"", signal: "Value framing — cost-per-day vs benefit", pct: "17% of 1-3★" },
    { price: "Category sweet spot ₹499–₹699", signal: "Justify with proof or add a 30-day trial pack" },
  ],
  youtube: [
    { t: "Top creators these buyers trust", who: "dermat creators (Dr. Aanchal), women-health & haircare influencers" },
    { t: "Most confusing topic in comments", who: "\"gummies vs serum vs minoxidil\" — huge unaddressed anxiety" },
    { t: "Format already working", who: "60-90 day before/after journeys + dermat collab explainers" },
  ],
  google: [
    { q: "how to stop hairfall for women naturally", vol: "very high", type: "How-to" },
    { q: "are biotin gummies safe", vol: "high", type: "Anxiety" },
    { q: "best hair growth serum for women without side effects", vol: "high", type: "Commercial" },
    { q: "bebodywise vs &me hair gummies", vol: "rising", type: "Comparison" },
  ],
  instagram: [
    { hook: "\"POV: your hairfall finally stopped\"", fmt: "Reel · trending audio", note: "Aspirational transformation" },
    { hook: "Dermat duet / stitch debunking gummy myths", fmt: "Collab Reel", note: "Authority + reach" },
    { hook: "\"3 things nobody tells you about PCOS hairfall\"", fmt: "Carousel", note: "Educational save-bait" },
  ],
  synthesis: "Across all five sources the same core tension repeats: Indian women buyers are <b>efficacy-skeptical and side-effect anxious</b> (\"no visible regrowth\", \"is biotin safe\", minoxidil fear), yet the category sells on <b>aspiration and influencer hype</b>. The white space is <b>proof-led, education-first, dermat/doctor-backed content</b> with honest timelines at a justified ₹499–699 price — exactly the creative and SEO/GEO gap the other tabs quantify. <b>What to say:</b> lead with clinical proof, real 60–90 day timelines and 'how it works'. <b>What to build:</b> a side-effect-reassured hero SKU with a low-risk 30-day trial pack.",
};

// ============================================================
//  AEO + GEO — answer-engine & generative-engine optimisation depth
// ============================================================
export const geo = {
  explainer: "<b>AEO</b> = being the answer in answer engines (Google AI Overviews, featured snippets, voice). <b>GEO</b> = being cited inside generative engines (ChatGPT, Gemini, Perplexity, Copilot) when they synthesise a recommendation. Both are won the same way: a strong <b>entity</b>, <b>structured/extractable content</b>, and <b>third-party citations</b> in the sources models trust.",
  levers: [
    { nm: "Entity strength", d: "Wikipedia + Wikidata + consistent NAP/sameAs. Models can't cite who they can't resolve.", live: true },
    { nm: "Citable assets", d: "Comparison tables, 'best X in India' pages, FAQ + Product/Review schema — the format models lift verbatim.", live: false },
    { nm: "Source presence", d: "Be quoted on Reddit, YouTube, listicles & editorials models pull from. This is where competitors out-cite you 4:1.", live: false },
    { nm: "Freshness & specificity", d: "Dated, India-specific, numeric answers (₹ prices, % results) get picked over vague copy.", live: false },
  ],
  prompts: [
    "best hair growth serum for women in india",
    "bebodywise vs &me",
    "are biotin gummies effective for hairfall",
    "affordable women's wellness brand india",
  ],
};

// ============================================================
//  THE 5 MINDS — every recommendation re-read through 5 expert lenses
// ============================================================
export const personas = [
  { role: "Growth Marketer", icon: "📈", focus: "CAC, channel mix, creative velocity",
    take: "Your blended CAC is fine but concentrated — 68% in one angle means one fatigue event spikes CAC 30%+. Diversify angles and own the Problem-Aware × Educational white space before scaling spend." },
  { role: "Product Manager", icon: "🧭", focus: "Product gaps, roadmap, JTBD",
    take: "Amazon + Reddit both scream the same unmet job: 'fix my problem without side effects'. The roadmap bet is a lightweight, minoxidil-free, summer-friendly hero SKU + a trial size to kill first-purchase risk." },
  { role: "Data Scientist", icon: "🔬", focus: "Signal quality, attribution, LTV",
    take: "Treat ad-longevity and SoMV as proxies with confidence bounds, not truth. Instrument a held-out geo test before reallocating budget; model LTV:CAC by cohort — retention 49 is the real ceiling, not acquisition." },
  { role: "D2C Scaler", icon: "🚀", focus: "Unit economics at scale, ops, retention",
    take: "You can't scale a leaky bucket: retention 49 caps you. Stand up WhatsApp + email flows and a subscription on the hero SKU before pouring more into top-funnel — repeat rate is the 1000 Cr lever." },
  { role: "P&L Owner", icon: "💰", focus: "Contribution margin, payback, cash",
    take: "At ₹699 with category sweet-spot ₹399–599 you're defending price without a proof narrative — that's margin you'll refund in discounts. Justify price with clinical proof, or ladder in a value SKU to protect contribution margin." },
];

// ============================================================
//  1000 Cr PLAYBOOK + HOW TO USE
// ============================================================
export const playbook = {
  howto: [
    { step: "1 · Run an audit", d: "Enter your brand on the start screen. Vantage auto-fetches your entity, site health, competitors and customer voice — free, no key." },
    { step: "2 · Read top-down", d: "Start at Executive Overview → the RICE-ranked opportunities answer 'what next'. Every tab is sorted by impact, not data dump." },
    { step: "3 · Act on the briefs", d: "Ad Strategy, Keyword Plan and Market Research output handoff-ready artifacts — copy them straight into Meta, Google Ads or a creative brief." },
    { step: "4 · Re-run weekly", d: "The picture sharpens over time. New competitor creatives, ranking moves and AEO/GEO shifts surface as changes." },
  ],
  pillars: [
    { nm: "1 · Demand you can own", d: "Pick a wedge where search + social demand is real but under-served (see Market Research white space). A 1000 Cr brand owns a category phrase, not a product.", metric: "Category SoV, branded search growth" },
    { nm: "2 · A product that earns repeat", d: "Efficacy + format fit > fragrance. The Amazon/Reddit gaps are your roadmap. Repeat rate, not first order, compounds to 1000 Cr.", metric: "30/60/90-day repeat rate, NPS" },
    { nm: "3 · Creative that prints", d: "A library of proven angles across the awareness ladder (Ad Strategy matrix). Velocity beats perfection — 2 new angles/week.", metric: "Winner-rate, creative LTV, CAC stability" },
    { nm: "4 · Efficient acquisition", d: "Steal validated keywords, defend brand, expand white space. Blended CAC with a real payback window, not vanity ROAS.", metric: "Blended CAC, payback < 1 cohort" },
    { nm: "5 · Organic + AEO/GEO moat", d: "Rank and get cited where buyers research — Google, AI Overviews, ChatGPT, Perplexity. Compounding, near-zero-marginal-cost demand.", metric: "Non-brand traffic, share-of-model-voice" },
    { nm: "6 · Retention engine", d: "WhatsApp/email/SMS + subscription. This is the multiplier — it turns a ₹100 Cr brand into a ₹1000 Cr one on the same acquisition.", metric: "LTV:CAC > 3, repeat revenue %" },
    { nm: "7 · Margin & cash discipline", d: "Contribution margin funds growth. Price on proof, ladder SKUs, watch RTO/returns. Cash conversion is the silent killer of D2C.", metric: "Contribution margin %, cash cycle" },
  ],
  northstar: "Compounding repeat revenue from an owned category — not this month's ROAS. Every tab in Vantage maps to one of the 7 pillars; the job is to find the one pillar most throttling compounding right now, and fix it before the next.",
};
