// Curated study resources per class — ported from the d-dash class
// library (CLASS_TOPICS + CLASSES metadata). Each topic carries: overview,
// ebook, Khan Academy links, YouTube videos, cheat sheet, games, and a
// practice quiz URL. Title Case copy. Client-safe.

export interface StudyResource {
  title: string;
  url: string;
  type: "khan" | "youtube" | "clever" | "ebook" | "article" | "game" | "quiz" | "cheatsheet";
  description?: string;
}

export interface StudyTopic {
  name: string;
  overview: string;
  resources: StudyResource[];
  ebook?: { title: string; url: string };
  cheatsheet?: string;
  quizUrl?: string;
  games?: { name: string; url: string; description: string }[];
}

export interface ClassMeta {
  slug: string;
  course: string;
  shortName: string;
  teacher: string;
  period: number;
  room: string;
  currentTopic: string;
  displayOrder: number;
}

export const CLASS_META: ClassMeta[] = [
];

export function classMetaFor(slug: string): ClassMeta | null {
  return CLASS_META.find((m) => m.slug === slug) ?? null;
}

export const CLASS_TOPICS: Record<string, { topics: StudyTopic[] }> = {
    "apcsp": {
      topics: [{
        name: "Data & Algorithms",
        overview: "How computers represent information with binary, shrink files with compression, and solve problems with algorithms. Covers bits and bytes, lossless vs lossy compression, and algorithm basics like searching and sorting.",
        resources: [
        {
                "title": "How do computers represent data? (AP CSP)",
                "url": "https://en.khanacademy.org/computing/ap-computer-science-principles/x2d2f703b37b450a3:digital-information/x2d2f703b37b450a3:bits-and-bytes/a/digital-data-introduction",
                "type": "khan",
                "description": "Khan Academy article: bits, bytes, binary representation, and analog-to-digital conversion."
        },
        {
                "title": "AP Computer Science Principles (full course)",
                "url": "https://www.khanacademy.org/computing/ap-computer-science-principles",
                "type": "khan",
                "description": "Full AP CSP course on Khan Academy \u2014 Digital Information and Algorithms units with videos and practice."
        },
        {
                "title": "Binary search (Algorithms unit)",
                "url": "https://khanacademy.org/computing/computer-science/algorithms/binary-search",
                "type": "khan",
                "description": "Khan Academy lesson with practice: how binary search halves the search space each step."
        },
        {
                "title": "Binary Numbers, Two's Complement & Data Compression",
                "url": "https://www.youtube.com/watch?v=CXkXR1AMs5k",
                "type": "youtube",
                "description": "Binary number system, two's complement, and how images/audio/video get compressed."
        },
        {
                "title": "How Computers Understand Binary | Bits, Bytes, ASCII",
                "url": "https://www.youtube.com/watch?v=HixhEUNWOTo",
                "type": "youtube",
                "description": "EC Academy: binary numbers, ASCII text, pixels/RGB images, and digital sound sampling."
        },
        {
                "title": "Data Representation 1: Binary Code (AP CSP prep)",
                "url": "https://www.youtube.com/watch?v=AT4Y03efuik",
                "type": "youtube",
                "description": "AP CSP-focused walkthrough: binary code, ASCII, and how bits become words and messages."
        },
        {
                "title": "Computerphile: Entropy in Compression",
                "url": "https://www.youtube.com/watch?v=M5c_RFKVkko",
                "type": "youtube",
                "description": "Computerphile: the theoretical minimum for compression \u2014 great for deeper understanding."
        }
],
        ebook: {"title": "Blown to Bits (free)", "url": "https://www.bitsbook.com/"},
        cheatsheet: "## AP CSP: Data & Algorithms\n\n**Binary:** base-2, digits 0/1. Rightmost bit = 2^0. n bits \u2192 2^n values; max value = 2^n \u2212 1. 8 bits = 1 byte (max 255).\n\n**Bin\u2192Dec:** multiply each bit by its place value and sum. 1011\u2082 = 8+0+2+1 = 11.\n\n**Dec\u2192Bin:** divide by 2 repeatedly, read remainders bottom\u2192top.\n\n**Data abstraction:** bits \u2192 bytes \u2192 ASCII/Unicode text \u2192 pixels \u2192 images/audio. Sampling converts analog to digital.\n\n**Compression:** Lossless (PNG, ZIP, GIF) = exact restore. Lossy (JPEG, MP3) = smaller, some data permanently lost.\n\n**Metadata:** data about data (date, file size, GPS).\n\n**Algorithms:** Binary search = halve search space each step (O(log n)). Selection/insertion sort = simple but slow.\n\n**Key trap:** lossy compression can NEVER restore the original.",
        quizUrl: "https://www.khanacademy.org/computing/ap-computer-science-principles",
        games: [
        {
                "name": "Blooket \u2014 search 'AP CSP binary'",
                "url": "https://www.blooket.com/",
                "description": "Open Blooket, use Discover, and search 'AP CSP binary' or 'data compression' for public question sets."
        },
        {
                "name": "Kahoot \u2014 search 'AP CSP'",
                "url": "https://kahoot.com/",
                "description": "On Kahoot Discover, search 'AP Computer Science Principles' for public review games."
        }
],
      }],
    },
    "envsci": {
      topics: [{
        name: "Unit 3: Populations",
        overview: "How populations grow and what limits them. Covers r-selected vs K-selected species, exponential vs logistic growth, carrying capacity (K), limiting factors, and human population dynamics including the demographic transition model.",
        resources: [
        {
                "title": "Populations (AP Environmental Science unit)",
                "url": "https://en.khanacademy.org/science/ap-college-environmental-science/x0b0e430a38ebd23f:populations",
                "type": "khan",
                "description": "Full Khan Academy unit: r/K-selected species, survivorship, carrying capacity, human population dynamics."
        },
        {
                "title": "Population growth (exponential vs logistic)",
                "url": "https://en.khanacademy.org/science/ap-college-environmental-science/x0b0e430a38ebd23f:populations/x0b0e430a38ebd23f:population-growth",
                "type": "khan",
                "description": "Khan Academy lesson with practice: limiting resources, carrying capacity, overshoot."
        },
        {
                "title": "Logistic vs exponential growth (video)",
                "url": "https://www.khanacademy.org/science/biology/x324d1dcc:more-about-ecology/x324d1dcc:more-about-population-ecology/v/logistic-growth-versus-exponential-growth",
                "type": "khan",
                "description": "Khan Academy video: why populations level off at carrying capacity K."
        },
        {
                "title": "Density-dependent vs independent factors (article)",
                "url": "https://www.khanacademy.org/science/ap-biology/ecology-ap/population-ecology-ap/a/mechanisms-of-population-regulation",
                "type": "khan",
                "description": "Khan Academy article: competition, predation, and other factors that regulate populations."
        },
        {
                "title": "Population Ecology (Bozeman-style review)",
                "url": "https://www.youtube.com/watch?v=t9J5HJjMclY",
                "type": "youtube",
                "description": "Population density, dispersion, exponential vs logistic growth, limiting factors, human population."
        },
        {
                "title": "Why Population Growth Stops: Carrying Capacity",
                "url": "https://www.youtube.com/watch?v=wnnGK7MpL2s",
                "type": "youtube",
                "description": "J-curve vs S-curve, reading population graphs \u2014 built for test questions."
        },
        {
                "title": "Carrying Capacity: Maximum Population Size",
                "url": "https://www.youtube.com/watch?v=wxU79I4MjGI",
                "type": "youtube",
                "description": "Ecology Explained: K, limiting factors, logistic growth phases, real-world examples."
        }
],
        ebook: {"title": "OpenStax Biology 2e \u2014 Ch. 45 Population Ecology", "url": "https://openstax.org/details/books/biology-2e"},
        cheatsheet: "## Unit 3: Populations\n\n**r-selected:** many offspring, little care, boom/bust (insects, weeds). **K-selected:** few offspring, high care, stable near K (elephants, humans).\n\n**Exponential growth:** J-curve, unlimited resources, dN/dt = rN.\n\n**Logistic growth:** S-curve, levels off at **carrying capacity (K)**.\n\n**Carrying capacity:** max population an environment sustains indefinitely. Determined by limiting factors.\n\n**Density-dependent:** competition, predation, disease (stronger as density rises). **Density-independent:** weather, natural disasters.\n\n**Overshoot:** population exceeds K \u2192 die-off back toward K.\n\n**Human pop:** demographic transition model \u2014 high birth/death \u2192 falling death \u2192 falling birth \u2192 low/stable.\n\n**Key formula:** \u0394N = births \u2212 deaths + immigration \u2212 emigration.",
        quizUrl: "https://en.khanacademy.org/science/ap-college-environmental-science/x0b0e430a38ebd23f:populations",
        games: [
        {
                "name": "Blooket \u2014 search 'population ecology'",
                "url": "https://www.blooket.com/",
                "description": "Blooket Discover: search 'population ecology' or 'carrying capacity' for public sets."
        },
        {
                "name": "Kahoot \u2014 search 'AP Environmental populations'",
                "url": "https://kahoot.com/",
                "description": "Kahoot Discover: search 'AP Environmental Science populations' for review games."
        }
],
      }],
    },
    "chinese": {
      topics: [{
        name: "Unit 2: Daily Life",
        overview: "Talking about your daily routine in Chinese: wake up, eat, go to school, and sleep. Builds time words, daily-activity verbs, and the time\u2013place\u2013action sentence pattern used to describe when things happen.",
        resources: [
        {
                "title": "10 Essential Daily Activities (Morning) \u2014 HSK 1",
                "url": "https://www.youtube.com/watch?v=YM3iuNPfVuQ",
                "type": "youtube",
                "description": "10 daily-routine verbs with pinyin breakdowns and example sentences (get up, brush teeth, shower, etc.)."
        },
        {
                "title": "22 Chinese Daily Expressions",
                "url": "https://www.youtube.com/watch?v=hkAzlkwf6VE",
                "type": "youtube",
                "description": "Everyday Chinese expressions with pinyin and English \u2014 great for natural daily-life speech."
        },
        {
                "title": "Arch Chinese \u2014 dictionary & stroke animations",
                "url": "https://www.archchinese.com/",
                "type": "article",
                "description": "Look up any daily-life word: pinyin, stroke order animation, and example sentences."
        },
        {
                "title": "Chinese Grammar Wiki",
                "url": "https://resources.allsetlearning.com/chinese/grammar/",
                "type": "article",
                "description": "Free grammar reference: time words, word order, and daily-routine sentence patterns with examples."
        }
],
        ebook: {"title": "Chinese Grammar Wiki (free reference)", "url": "https://resources.allsetlearning.com/chinese/grammar/"},
        cheatsheet: "## Unit 2: Daily Life\n\n**Core verbs:** \u8d77\u5e8a (q\u01d0chu\u00e1ng) get up \u00b7 \u5237\u7259 (shu\u0101y\u00e1) brush teeth \u00b7 \u6d17\u8138 (x\u01d0li\u01cen) wash face \u00b7 \u5403\u65e9\u996d (ch\u012b z\u01ceof\u00e0n) eat breakfast \u00b7 \u4e0a\u5b66 (sh\u00e0ngxu\u00e9) go to school \u00b7 \u5403\u5348\u996d (ch\u012b w\u01d4f\u00e0n) eat lunch \u00b7 \u7761\u89c9 (shu\u00ecji\u00e0o) sleep \u00b7 \u6d17\u6fa1 (x\u01d0z\u01ceo) shower\n\n**Time words:** \u65e9\u4e0a (morning) \u00b7 \u4e2d\u5348 (noon) \u00b7 \u4e0b\u5348 (afternoon) \u00b7 \u665a\u4e0a (evening) + number + \u70b9 (di\u01cen) = o'clock\n\n**Sentence pattern:** TIME + Subject + Place + Verb\n\u65e9\u4e0a\u516b\u70b9\u6211\u8d77\u5e8a = I get up at 8 AM.\n\n**Day before time:** \u661f\u671f\u65e5\u65e9\u4e0a\u5988\u5988\u53bb\u8d85\u5e02 (Mom goes to the market Sunday morning).\n\n**Tip:** time word NEVER goes after the verb \u2014 always before it.",
        quizUrl: "https://quizlet.com/",
        games: [
        {
                "name": "Blooket \u2014 search 'Chinese daily routine'",
                "url": "https://www.blooket.com/",
                "description": "Blooket Discover: search 'Chinese daily routine' for vocabulary matching games."
        },
        {
                "name": "Quizlet \u2014 search 'Chinese daily routine HSK'",
                "url": "https://quizlet.com/",
                "description": "Quizlet search: find 'daily routine Chinese' flashcard sets, then play Match or Gravity."
        }
],
      }],
    },
    "gov": {
      topics: [{
        name: "Unit 4: Congress",
        overview: "The legislative branch: how Congress is structured, what powers it holds, and the full journey of how a bill becomes a law \u2014 committees, floor debate, conference committees, vetoes, and overrides.",
        resources: [
        {
                "title": "How a bill becomes a law (Khan Academy)",
                "url": "https://en.khanacademy.org/humanities/us-government-and-civics/us-gov-interactions-among-branches/us-gov-structures-powers-and-functions-of-congress/v/how-a-bill-becomes-a-law",
                "type": "khan",
                "description": "Khan Academy video: House vs Senate process, Rules Committee, conference committees, veto override."
        },
        {
                "title": "AP US Government and Politics (full course)",
                "url": "https://www.khanacademy.org/humanities/ap-us-government-and-politics",
                "type": "khan",
                "description": "Full AP Gov course \u2014 Interactions Among Branches unit covers Congress structure and powers with practice."
        },
        {
                "title": "Crash Course: How a Bill Becomes a Law #9",
                "url": "https://www.youtube.com/watch?v=66f4-NKEYz4",
                "type": "youtube",
                "description": "Crash Course Government: the classic 6-minute walkthrough \u2014 committees, floor votes, veto, override."
        },
        {
                "title": "How a Bill Actually Becomes a Law",
                "url": "https://www.youtube.com/watch?v=6-BM74kO61s",
                "type": "youtube",
                "description": "Deeper dive: House vs Senate rules, filibuster, cloture (60 votes), ping-pong amendments."
        }
],
        ebook: {"title": "OpenStax American Government 3e \u2014 Ch. 11 Congress", "url": "https://openstax.org/details/books/american-government-3e"},
        cheatsheet: "## Unit 4: Congress\n\n**Structure:** Bicameral \u2014 House (435, 2-yr terms, population-based) + Senate (100, 6-yr terms, 2 per state).\n\n**Bill \u2192 Law:** 1) Introduced (House or Senate; tax bills start in House) \u2192 2) Committee/subcommittee (hearings, markup \u2014 most bills die here) \u2192 3) Floor debate & vote \u2192 4) Other chamber repeats \u2192 5) Conference committee reconciles differences \u2192 6) President signs or vetoes.\n\n**Veto override:** 2/3 vote in BOTH chambers. **Pocket veto:** president ignores bill 10 days, Congress adjourned = dead.\n\n**House:** Rules Committee controls debate (traffic cop). **Senate:** unlimited debate \u2192 filibuster; cloture needs 60 votes.\n\n**Powers:** tax/spend, declare war, regulate commerce, impeachment (House charges, Senate tries).\n\n**Key trap:** a bill must pass BOTH chambers in IDENTICAL form.",
        quizUrl: "https://www.khanacademy.org/humanities/ap-us-government-and-politics",
        games: [
        {
                "name": "Blooket \u2014 search 'how a bill becomes a law'",
                "url": "https://www.blooket.com/",
                "description": "Blooket Discover: search 'how a bill becomes a law' or 'Congress' for public sets."
        },
        {
                "name": "Kahoot \u2014 search 'US Congress'",
                "url": "https://kahoot.com/",
                "description": "Kahoot Discover: search 'US Congress' or 'bill becomes law' for review games."
        }
],
      }],
    },
    "geometry": {
      topics: [{
        name: "Unit 3: Congruence",
        overview: "Proving triangles are identical using SSS, SAS, ASA, AAS, and HL. Learn which three pieces of information guarantee congruence, why SSA and AAA fail, and how to write two-column proofs step by step.",
        resources: [
        {
                "title": "Congruent triangles and SSS (Khan Academy)",
                "url": "https://en.khanacademy.org/kmap/congruence-similarity-right-triangles-trigonometry-d/x999aada9fe2b78c1:congruence/x999aada9fe2b78c1:congruent-triangles/v/congruent-triangles-and-sss",
                "type": "khan",
                "description": "Khan Academy video: triangle congruence basics and the SSS postulate with practice."
        },
        {
                "title": "Geometry \u2014 Congruence unit (Khan Academy)",
                "url": "https://www.khanacademy.org/math/geometry/hs-geo-congruence",
                "type": "khan",
                "description": "Full Khan Academy congruence unit: transformations, triangle congruence criteria, and proofs with practice sets."
        },
        {
                "title": "Triangle Congruence Postulates: SSS, SAS, ASA, AAS",
                "url": "https://www.youtube.com/watch?v=6MLzD1I8Eow",
                "type": "youtube",
                "description": "All four postulates with visuals, plus why AAA & SSA do NOT work, with practice problems."
        },
        {
                "title": "Congruent Triangles: SSS, SAS, ASA & RHS Rules",
                "url": "https://www.youtube.com/watch?v=Eg1-o7NH-gg",
                "type": "youtube",
                "description": "Step-by-step congruence rules with worked examples \u2014 good for exam prep."
        },
        {
                "title": "Proving Triangles Congruent in a Parallelogram",
                "url": "https://www.youtube.com/watch?v=S41Jw-y83dg",
                "type": "youtube",
                "description": "Full two-column proof walkthrough using SSS and ASA, plus common naming mistakes to avoid."
        }
],
        ebook: {"title": "CK-12 Geometry FlexBook (free)", "url": "https://flexbooks.ck12.org/cbook/ck-12-geometry-flexbook-2.0/"},
        cheatsheet: "## Unit 3: Congruence \u2014 CHEAT SHEET\n\n**5 ways to prove congruence:**\n- **SSS:** 3 sides \u2245\n- **SAS:** 2 sides + INCLUDED angle \u2245\n- **ASA:** 2 angles + INCLUDED side \u2245\n- **AAS:** 2 angles + NON-included side \u2245\n- **HL:** right triangles \u2014 hypotenuse + 1 leg \u2245\n\n**DO NOT WORK:** SSA (ambiguous!) and AAA (only proves similarity).\n\n**Proof tips:**\n1. Mark the diagram first.\n2. Reflexive property: a shared side/angle \u2245 itself.\n3. Vertical angles are always \u2245.\n4. Parallel lines \u2192 alternate interior angles \u2245.\n5. Midpoint \u2192 two \u2245 segments. Angle bisector \u2192 two \u2245 angles.\n\n**Two-column format:** left = statements (Given \u2192 definitions \u2192 postulate), right = reasons. End with the triangle congruence statement + postulate (e.g., \u25b3ABC \u2245 \u25b3DEF by SAS).\n\n**Naming order matters:** list vertices in matching order!",
        quizUrl: "https://www.khanacademy.org/math/geometry/hs-geo-congruence",
        games: [
        {
                "name": "Blooket \u2014 search 'triangle congruence SSS SAS'",
                "url": "https://www.blooket.com/",
                "description": "Blooket Discover: search 'triangle congruence' for SSS/SAS/ASA/AAS question sets."
        },
        {
                "name": "Kahoot \u2014 search 'congruent triangles'",
                "url": "https://kahoot.com/",
                "description": "Kahoot Discover: search 'congruent triangles' for timed review games."
        }
],
      }],
    },
    "litcomp": {
      topics: [{
        name: "Vocabulary Unit 4",
        overview: "Building college-level vocabulary and tightening grammar. Learn new words in context, master them with spaced repetition, and polish sentences with No Red Ink grammar practice.",
        resources: [
        {
                "title": "Vocabulary.com \u2014 adaptive vocab practice",
                "url": "https://www.vocabulary.com/",
                "type": "quiz",
                "description": "Adaptive vocabulary builder: learns which words you miss and drills them until they stick."
        },
        {
                "title": "No Red Ink \u2014 grammar practice",
                "url": "https://www.noredink.com/",
                "type": "quiz",
                "description": "Grammar practice assigned by class: fix sentences, learn rules in context."
        },
        {
                "title": "Khan Academy \u2014 Grammar",
                "url": "https://www.khanacademy.org/humanities/grammar",
                "type": "khan",
                "description": "Free grammar course: parts of speech, syntax, conventions \u2014 pairs with No Red Ink work."
        },
        {
                "title": "Quizlet \u2014 search 'Vocabulary Unit 4'",
                "url": "https://quizlet.com/",
                "type": "quiz",
                "description": "Search your exact Unit 4 word list to find flashcard sets, then use Learn and Test modes."
        }
],
        ebook: {"title": "Project Gutenberg \u2014 free classic ebooks", "url": "https://www.gutenberg.org/"},
        cheatsheet: "## Vocabulary Unit 4 \u2014 STUDY METHOD\n\n**Learn words in 3 passes:**\n1. **See it:** read the word + definition + one example sentence. Say it out loud.\n2. **Use it:** write your OWN sentence (not the book's). Personal = memorable.\n3. **Test it:** cover definitions, quiz yourself. Missed words go back to pass 1.\n\n**Root trick:** break words into prefix + root + suffix. pre- (before) + dict (say) = predict.\n\n**No Red Ink tip:** read the whole sentence first, then pick the fix \u2014 most errors are subject-verb agreement and comma splices.\n\n**Daily habit:** 10 minutes on Vocabulary.com beats 1 hour of cramming.",
        quizUrl: "https://www.vocabulary.com/",
        games: [
        {
                "name": "Blooket \u2014 search 'vocabulary unit 4'",
                "url": "https://www.blooket.com/",
                "description": "Blooket Discover: search your vocab unit for matching and tower-defense style games."
        },
        {
                "name": "Gimkit \u2014 search vocabulary sets",
                "url": "https://www.gimkit.com/",
                "description": "Gimkit: search public kits for your vocab list \u2014 earn cash per correct answer."
        }
],
      }],
    },
};
