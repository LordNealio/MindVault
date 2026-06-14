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
