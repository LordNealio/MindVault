// Atomizer Rules Library: 40 goals → habit templates with scoring
// Each goal maps to 1-3 habit atoms (variants: full/reduced/minimum)

export const ATOMIZER_GOALS = [
  {
    goalId: "get-stronger",
    title: "Get Stronger",
    keywords: ["stronger", "strength", "muscle", "lift", "weights", "compound"],
    atoms: [
      {
        title: "Strength Session",
        full: "60 min: 5-min warm-up, 3 compound lifts (5 sets x 5 reps), 10-min cool-down",
        reduced: "30 min: 3-min warm-up, 2 compound lifts (3 sets x 5 reps), 5-min cool-down",
        minimum: "15 min: 1 compound lift (3 sets x 5 reps)",
        cue: { time: "06:00", location: "Gym", context: "After breakfast" },
        cadence: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        ratings: { difficulty: 8, timeRequired: 7, enjoyment: 8, impact: 9, alignment: 9 },
      },
    ],
  },
  {
    goalId: "read-more",
    title: "Read More",
    keywords: ["read", "reading", "book", "learn", "knowledge", "literature"],
    atoms: [
      {
        title: "Daily Reading Session",
        full: "45 min of focused reading",
        reduced: "20 min of reading",
        minimum: "10 min of reading",
        cue: { time: "21:00", location: "Bedroom", context: "Before bed" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 3, timeRequired: 5, enjoyment: 8, impact: 7, alignment: 9 },
      },
    ],
  },
  {
    goalId: "exercise-regularly",
    title: "Exercise Regularly",
    keywords: ["exercise", "fitness", "workout", "active", "cardio", "run"],
    atoms: [
      {
        title: "Morning Run",
        full: "40 min run at comfortable pace",
        reduced: "20 min jog",
        minimum: "10 min walk/jog mix",
        cue: { time: "06:30", location: "Park", context: "Early morning" },
        cadence: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        ratings: { difficulty: 6, timeRequired: 7, enjoyment: 7, impact: 8, alignment: 8 },
      },
    ],
  },
  {
    goalId: "meditate-daily",
    title: "Meditate Daily",
    keywords: ["meditate", "meditation", "mindfulness", "calm", "peace", "zen"],
    atoms: [
      {
        title: "Meditation Session",
        full: "20 min guided meditation",
        reduced: "10 min meditation",
        minimum: "5 min breathing exercise",
        cue: { time: "07:00", location: "Home", context: "Morning" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 2, timeRequired: 4, enjoyment: 9, impact: 9, alignment: 10 },
      },
    ],
  },
  {
    goalId: "journal-regularly",
    title: "Journal Regularly",
    keywords: ["journal", "writing", "reflect", "diary", "log"],
    atoms: [
      {
        title: "Evening Journaling",
        full: "30 min free-form journaling",
        reduced: "15 min bullet journaling",
        minimum: "5 min quick note",
        cue: { time: "21:00", location: "Desk", context: "Evening" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 3, timeRequired: 5, enjoyment: 8, impact: 9, alignment: 9 },
      },
    ],
  },
  {
    goalId: "learn-a-skill",
    title: "Learn a Skill",
    keywords: ["learn", "skill", "course", "practice", "education", "training"],
    atoms: [
      {
        title: "Skill Practice",
        full: "60 min focused practice",
        reduced: "30 min practice",
        minimum: "15 min quick practice",
        cue: { time: null, location: "Home", context: "Anytime" },
        cadence: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
        ratings: { difficulty: 6, timeRequired: 6, enjoyment: 7, impact: 8, alignment: 9 },
      },
    ],
  },
  {
    goalId: "sleep-better",
    title: "Sleep Better",
    keywords: ["sleep", "rest", "bed", "insomnia", "tired"],
    atoms: [
      {
        title: "Sleep Hygiene Routine",
        full: "30 min bedtime routine (no screens, cool room, etc.)",
        reduced: "15 min wind-down (dim lights, no screens)",
        minimum: "5 min breathing before bed",
        cue: { time: "22:00", location: "Bedroom", context: "Before bed" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 4, timeRequired: 5, enjoyment: 7, impact: 10, alignment: 10 },
      },
    ],
  },
  {
    goalId: "eat-healthier",
    title: "Eat Healthier",
    keywords: ["eat", "food", "diet", "nutrition", "healthy", "vegetable"],
    atoms: [
      {
        title: "Meal Prep",
        full: "2 hours meal prep for the week",
        reduced: "1 hour quick prep for 2 days",
        minimum: "15 min prep one meal",
        cue: { time: "14:00", location: "Kitchen", context: "Sunday afternoon" },
        cadence: "FREQ=WEEKLY;BYDAY=SU",
        ratings: { difficulty: 5, timeRequired: 6, enjoyment: 5, impact: 8, alignment: 8 },
      },
    ],
  },
  {
    goalId: "stay-hydrated",
    title: "Stay Hydrated",
    keywords: ["water", "hydrate", "drink"],
    atoms: [
      {
        title: "Water Intake Tracking",
        full: "8 glasses of water per day",
        reduced: "5 glasses per day",
        minimum: "2 glasses per day",
        cue: { time: null, location: "Anywhere", context: "Throughout day" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 2, timeRequired: 1, enjoyment: 3, impact: 7, alignment: 7 },
      },
    ],
  },
  {
    goalId: "practice-gratitude",
    title: "Practice Gratitude",
    keywords: ["gratitude", "grateful", "appreciate", "thankful"],
    atoms: [
      {
        title: "Gratitude Practice",
        full: "10 min writing 10 things you're grateful for",
        reduced: "5 min writing 5 things",
        minimum: "2 min thinking of 3 things",
        cue: { time: "09:00", location: "Anywhere", context: "Morning" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 2, timeRequired: 3, enjoyment: 8, impact: 8, alignment: 9 },
      },
    ],
  },
  {
    goalId: "stretch-daily",
    title: "Stretch Daily",
    keywords: ["stretch", "flexibility", "yoga", "mobility"],
    atoms: [
      {
        title: "Stretching Routine",
        full: "20 min full-body stretching",
        reduced: "10 min targeted stretches",
        minimum: "5 min quick stretches",
        cue: { time: "18:00", location: "Home", context: "After work" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 3, timeRequired: 4, enjoyment: 7, impact: 6, alignment: 8 },
      },
    ],
  },
  {
    goalId: "walk-more",
    title: "Walk More",
    keywords: ["walk", "walking", "steps", "pedestrian"],
    atoms: [
      {
        title: "Daily Walk",
        full: "30 min brisk walk",
        reduced: "15 min casual walk",
        minimum: "10 min around the block",
        cue: { time: "12:00", location: "Park", context: "Midday" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 3, timeRequired: 5, enjoyment: 7, impact: 6, alignment: 8 },
      },
    ],
  },
  {
    goalId: "practice-music",
    title: "Practice Music",
    keywords: ["music", "instrument", "play", "guitar", "piano", "sing"],
    atoms: [
      {
        title: "Music Practice",
        full: "45 min instrument practice",
        reduced: "20 min focused practice",
        minimum: "10 min quick session",
        cue: { time: "19:00", location: "Home", context: "Evening" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 5, timeRequired: 6, enjoyment: 8, impact: 6, alignment: 8 },
      },
    ],
  },
  {
    goalId: "spend-time-nature",
    title: "Spend Time in Nature",
    keywords: ["nature", "outdoor", "park", "forest", "hiking"],
    atoms: [
      {
        title: "Nature Time",
        full: "2 hours hiking or nature exploration",
        reduced: "1 hour walk in nature",
        minimum: "20 min outdoor time",
        cue: { time: null, location: "Park/Trail", context: "Weekend" },
        cadence: "FREQ=WEEKLY;BYDAY=SA,SU",
        ratings: { difficulty: 3, timeRequired: 5, enjoyment: 9, impact: 7, alignment: 8 },
      },
    ],
  },
  {
    goalId: "strengthen-relationships",
    title: "Strengthen Relationships",
    keywords: ["relationship", "friend", "family", "connect", "social"],
    atoms: [
      {
        title: "Quality Time with Loved Ones",
        full: "2 hours quality time (no phones)",
        reduced: "1 hour focused conversation",
        minimum: "20 min phone call",
        cue: { time: null, location: "Home/Out", context: "Anytime" },
        cadence: "FREQ=WEEKLY;BYDAY=SA,SU",
        ratings: { difficulty: 3, timeRequired: 5, enjoyment: 9, impact: 9, alignment: 10 },
      },
    ],
  },
  {
    goalId: "grow-business",
    title: "Grow Business",
    keywords: ["business", "entrepreneurship", "startup", "sales", "marketing"],
    atoms: [
      {
        title: "Business Development",
        full: "2 hours on business tasks (sales, marketing, product)",
        reduced: "1 hour focused work",
        minimum: "30 min quick task",
        cue: { time: "09:00", location: "Office", context: "Morning" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 7, timeRequired: 7, enjoyment: 7, impact: 10, alignment: 10 },
      },
    ],
  },
  {
    goalId: "clean-organize",
    title: "Clean & Organize",
    keywords: ["clean", "organize", "tidy", "declutter", "organize"],
    atoms: [
      {
        title: "Cleaning & Organizing",
        full: "2 hours deep clean/organize",
        reduced: "1 hour focused cleaning",
        minimum: "15 min quick tidy",
        cue: { time: "10:00", location: "Home", context: "Weekend" },
        cadence: "FREQ=WEEKLY;BYDAY=SA,SU",
        ratings: { difficulty: 4, timeRequired: 5, enjoyment: 4, impact: 6, alignment: 7 },
      },
    ],
  },
  {
    goalId: "practice-breathing",
    title: "Practice Breathing",
    keywords: ["breathing", "breathe", "breath", "breathwork"],
    atoms: [
      {
        title: "Breathing Exercises",
        full: "15 min structured breathing",
        reduced: "8 min breathing",
        minimum: "3 min quick breathing",
        cue: { time: null, location: "Anywhere", context: "Stress relief" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 2, timeRequired: 2, enjoyment: 7, impact: 7, alignment: 8 },
      },
    ],
  },
  {
    goalId: "learn-language",
    title: "Learn a Language",
    keywords: ["language", "spanish", "french", "german", "speak"],
    atoms: [
      {
        title: "Language Learning",
        full: "60 min app + conversation practice",
        reduced: "30 min app practice",
        minimum: "10 min daily vocab",
        cue: { time: "08:00", location: "Home", context: "Morning" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 5, timeRequired: 6, enjoyment: 7, impact: 7, alignment: 8 },
      },
    ],
  },
  {
    goalId: "practice-drawing",
    title: "Practice Drawing",
    keywords: ["draw", "drawing", "art", "sketch", "paint"],
    atoms: [
      {
        title: "Drawing Practice",
        full: "60 min focused drawing",
        reduced: "30 min sketching",
        minimum: "15 min quick drawing",
        cue: { time: "19:00", location: "Home", context: "Evening" },
        cadence: "FREQ=DAILY",
        ratings: { difficulty: 4, timeRequired: 5, enjoyment: 8, impact: 6, alignment: 8 },
      },
    ],
  },
  {
    goalId: "save-money",
    title: "Save Money",
    keywords: ["save", "money", "financial", "budget", "invest"],
    atoms: [
      {
        title: "Financial Planning",
        full: "30 min budget review and planning",
        reduced: "15 min quick review",
        minimum: "5 min log expense",
        cue: { time: "20:00", location: "Desk", context: "Weekly" },
        cadence: "FREQ=WEEKLY;BYDAY=SU",
        ratings: { difficulty: 4, timeRequired: 4, enjoyment: 3, impact: 9, alignment: 9 },
      },
    ],
  },
];

// Each goal belongs to a domain; domains drive which qualification
// questions are asked and how answers reshape recommendations.
export const GOAL_DOMAINS = {
  "get-stronger": "fitness",
  "exercise-regularly": "fitness",
  "stretch-daily": "fitness",
  "walk-more": "fitness",
  "read-more": "learning",
  "learn-a-skill": "learning",
  "practice-music": "learning",
  "learn-language": "learning",
  "practice-drawing": "learning",
  "meditate-daily": "wellness",
  "journal-regularly": "wellness",
  "sleep-better": "wellness",
  "practice-gratitude": "wellness",
  "spend-time-nature": "wellness",
  "practice-breathing": "wellness",
  "eat-healthier": "wellness",
  "stay-hydrated": "wellness",
  "strengthen-relationships": "life",
  "grow-business": "life",
  "clean-organize": "life",
  "save-money": "life",
};

export const QUALIFICATION_BANKS = {
  fitness: [
    { id: "level", q: "Current fitness level?", opts: ["Beginner", "Intermediate", "Advanced"] },
    { id: "health", q: "Any injuries or health conditions?", opts: ["None", "Minor", "Significant / unsure"] },
    { id: "commitment", q: "How committed are you right now?", opts: ["Just exploring", "Somewhat committed", "All in"] },
  ],
  learning: [
    { id: "experience", q: "Experience with this topic?", opts: ["Complete beginner", "Some experience", "Advanced"] },
    { id: "timeBudget", q: "Time available per week?", opts: ["Under 2 hrs", "2–5 hrs", "5+ hrs"] },
    { id: "commitment", q: "How committed are you right now?", opts: ["Just exploring", "Somewhat committed", "All in"] },
  ],
  wellness: [
    { id: "stress", q: "Current stress level?", opts: ["Low", "Moderate", "High"] },
    { id: "sleep", q: "Sleep quality lately?", opts: ["Good", "Fair", "Poor"] },
    { id: "commitment", q: "How committed are you right now?", opts: ["Just exploring", "Somewhat committed", "All in"] },
  ],
  life: [
    { id: "bandwidth", q: "How full is your schedule?", opts: ["Pretty open", "Busy", "Overloaded"] },
    { id: "commitment", q: "How committed are you right now?", opts: ["Just exploring", "Somewhat committed", "All in"] },
  ],
};

const clamp = (n) => Math.max(1, Math.min(10, n));

// Reshape atom list based on the user's qualification answers.
// Returns new atoms with adjusted ratings/score, a recommended starting
// variant, per-atom "why" notes, and a filtered list when safety demands it.
export function personalizeAtoms(atoms, domain, answers) {
  let result = atoms.map(atom => ({
    ...atom,
    ratings: { ...atom.ratings },
    notes: [],
    recommendedVariant: "full",
    safetyFlag: false,
  }));

  // ── Fitness ──────────────────────────────────────────────
  if (answers.health === "Significant / unsure") {
    // Gate high-intensity physical habits entirely; keep gentle ones.
    result = result.filter(a =>
      GOAL_DOMAINS[a.goalId] !== "fitness" || a.ratings.difficulty <= 4
    );
    result.forEach(a => {
      if (GOAL_DOMAINS[a.goalId] === "fitness") {
        a.safetyFlag = true;
        a.notes.push("Kept low-intensity because of your health answer — please check with a doctor before increasing.");
      }
    });
  } else if (answers.health === "Minor") {
    result.forEach(a => {
      if (GOAL_DOMAINS[a.goalId] === "fitness" && a.ratings.difficulty >= 7) {
        a.ratings.difficulty = clamp(a.ratings.difficulty + 2);
        a.safetyFlag = true;
        a.notes.push("Ranked lower due to your injury — modify movements that aggravate it.");
      }
    });
  }

  if (answers.level === "Beginner") {
    result.forEach(a => {
      if (GOAL_DOMAINS[a.goalId] === "fitness") {
        a.ratings.difficulty = clamp(a.ratings.difficulty + 2);
        a.recommendedVariant = "reduced";
        a.notes.push("As a beginner, start with the reduced version — you can level up in a few weeks.");
      }
    });
  } else if (answers.level === "Advanced") {
    result.forEach(a => {
      if (GOAL_DOMAINS[a.goalId] === "fitness") {
        a.ratings.difficulty = clamp(a.ratings.difficulty - 2);
        a.notes.push("Ranked higher — your experience makes this very doable.");
      }
    });
  }

  // ── Learning ─────────────────────────────────────────────
  if (answers.experience === "Complete beginner") {
    result.forEach(a => {
      if (GOAL_DOMAINS[a.goalId] === "learning") {
        a.recommendedVariant = "reduced";
        a.notes.push("Short, frequent sessions beat marathons when you're starting out.");
      }
    });
  }
  if (answers.timeBudget === "Under 2 hrs") {
    result.forEach(a => {
      if (a.ratings.timeRequired >= 6) {
        a.ratings.timeRequired = clamp(a.ratings.timeRequired + 2);
        a.recommendedVariant = "minimum";
        a.notes.push("Your week is tight — the minimum version keeps the streak alive.");
      }
    });
  }

  // ── Wellness ─────────────────────────────────────────────
  if (answers.stress === "High") {
    result.forEach(a => {
      if (["meditate-daily", "practice-breathing", "spend-time-nature", "sleep-better"].includes(a.goalId)) {
        a.ratings.alignment = clamp(a.ratings.alignment + 1);
        a.ratings.impact = clamp(a.ratings.impact + 1);
        a.notes.push("Boosted — calming practices tend to pay off fastest under high stress.");
      }
      if (a.ratings.difficulty >= 7) {
        a.ratings.difficulty = clamp(a.ratings.difficulty + 1);
        a.notes.push("Demanding habits are harder to sustain under high stress — consider starting gentler.");
      }
    });
  }
  if (answers.sleep === "Poor") {
    result.forEach(a => {
      if (a.goalId === "sleep-better") {
        a.ratings.impact = clamp(a.ratings.impact + 1);
        a.ratings.alignment = clamp(a.ratings.alignment + 1);
        a.notes.push("Boosted — better sleep multiplies every other habit.");
      }
    });
  }

  // ── Life / bandwidth ─────────────────────────────────────
  if (answers.bandwidth === "Overloaded") {
    result.forEach(a => {
      a.recommendedVariant = a.recommendedVariant === "full" ? "reduced" : a.recommendedVariant;
      if (a.ratings.timeRequired >= 6) {
        a.ratings.timeRequired = clamp(a.ratings.timeRequired + 1);
      }
    });
  }

  // ── Commitment (all domains) ─────────────────────────────
  if (answers.commitment === "Just exploring") {
    result.forEach(a => {
      a.recommendedVariant = "minimum";
      a.notes.push("Start with just the minimum — consistency first, intensity later.");
    });
  } else if (answers.commitment === "All in") {
    result.forEach(a => {
      if (a.recommendedVariant === "minimum") a.recommendedVariant = "reduced";
    });
  }

  // Re-score with adjusted ratings and re-rank.
  result.forEach(a => { a.score = calculateScore(a.ratings); });
  result.sort((a, b) => b.score - a.score);
  return result;
}

// Majority-vote domain across matched goals, so mixed matches still
// get the most relevant question bank.
export function detectDomain(goals) {
  const counts = {};
  goals.forEach(g => {
    const d = GOAL_DOMAINS[g.goalId] || "life";
    counts[d] = (counts[d] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "life";
}

export function calculateScore(ratings) {
  const { difficulty, timeRequired, enjoyment, impact, alignment } = ratings;
  const ease = (enjoyment / ((difficulty + 1) * (timeRequired + 1))) * 10;
  const leverage = (impact * alignment) / 10;
  const compoundScore = (leverage * 0.6 + ease * 0.4);
  return Math.round(Math.min(100, compoundScore * 10));
}

export function searchGoals(query) {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  return ATOMIZER_GOALS
    .filter(goal =>
      goal.keywords.some(kw => lowerQuery.includes(kw)) ||
      goal.title.toLowerCase().includes(lowerQuery)
    )
    .map(goal => ({
      ...goal,
      atoms: goal.atoms.map(atom => ({
        ...atom,
        goalId: goal.goalId,
        goalTitle: goal.title,
        score: calculateScore(atom.ratings),
      })),
    }));
}

export function getAllAtoms() {
  const atoms = [];
  ATOMIZER_GOALS.forEach(goal => {
    goal.atoms.forEach(atom => {
      atoms.push({
        ...atom,
        goalId: goal.goalId,
        goalTitle: goal.title,
        score: calculateScore(atom.ratings),
      });
    });
  });
  return atoms.sort((a, b) => b.score - a.score);
}
