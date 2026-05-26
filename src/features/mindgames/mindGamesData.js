// ── MindGames — shared metadata & static data ────────────

export const GAMES = [
  {
    id: "attention",
    title: "Attention Training",
    emoji: "🎯",
    skill: "Focus & Inhibition",
    description: "Filter the noise. Identify the direction of the center arrow — ignore the flankers.",
    color: "#E8B84B",
  },
  {
    id: "reaction",
    title: "Reaction Speed",
    emoji: "⚡",
    skill: "Alertness & Speed",
    description: "Wait for the signal, then tap as fast as you can. Don't jump the gun.",
    color: "#4F6EF7",
  },
  {
    id: "memory",
    title: "Memory Sequence",
    emoji: "🧠",
    skill: "Working Memory",
    description: "Watch the sequence light up. Repeat it back in the same order. Go as deep as you can.",
    color: "#8B5CF6",
  },
  {
    id: "pattern",
    title: "Pattern Logic",
    emoji: "🔷",
    skill: "Reasoning & Logic",
    description: "Each sequence follows a rule. Figure out the rule. Pick what comes next.",
    color: "#22C55E",
  },
];

// Pattern Logic — 20 questions, 10 drawn at random per session
export const PATTERNS = [
  { seq:[2,4,6,8],         answer:10,  choices:[9,10,11,12],     hint:"+2 each step" },
  { seq:[1,3,9,27],        answer:81,  choices:[54,72,81,90],    hint:"×3 each step" },
  { seq:[1,1,2,3,5,8],     answer:13,  choices:[11,12,13,14],    hint:"Fibonacci" },
  { seq:[3,6,12,24],       answer:48,  choices:[36,42,48,56],    hint:"×2 each step" },
  { seq:[100,50,25,12],    answer:6,   choices:[5,6,7,8],        hint:"÷2 each step" },
  { seq:[1,4,9,16],        answer:25,  choices:[20,23,25,28],    hint:"Perfect squares" },
  { seq:[1,8,27,64],       answer:125, choices:[100,108,125,144],hint:"Perfect cubes" },
  { seq:[5,10,20,40],      answer:80,  choices:[60,70,80,100],   hint:"×2 each step" },
  { seq:[2,6,12,20],       answer:30,  choices:[28,30,32,36],    hint:"Differences: +4,+6,+8,+10" },
  { seq:[7,14,21,28],      answer:35,  choices:[30,33,35,42],    hint:"Multiples of 7" },
  { seq:[1,2,4,7,11],      answer:16,  choices:[14,15,16,18],    hint:"Differences: +1,+2,+3,+4,+5" },
  { seq:[10,9,7,4],        answer:0,   choices:[-1,0,1,2],       hint:"Differences: -1,-2,-3,-4" },
  { seq:[3,5,8,13,21],     answer:34,  choices:[29,32,34,38],    hint:"Fibonacci-like sums" },
  { seq:[2,3,5,7,11],      answer:13,  choices:[12,13,14,15],    hint:"Prime numbers" },
  { seq:[4,8,16,32],       answer:64,  choices:[48,56,64,72],    hint:"×2 each step" },
  { seq:[1,3,6,10,15],     answer:21,  choices:[18,20,21,24],    hint:"Triangular numbers" },
  { seq:[2,4,8,14,22],     answer:32,  choices:[28,30,32,36],    hint:"Differences: +2,+4,+6,+8,+10" },
  { seq:[81,27,9,3],       answer:1,   choices:[0,1,2,3],        hint:"÷3 each step" },
  { seq:[0,1,3,6,10],      answer:15,  choices:[13,14,15,16],    hint:"Triangular numbers" },
  { seq:[2,5,10,17,26],    answer:37,  choices:[33,35,37,40],    hint:"Differences: +3,+5,+7,+9,+11" },
];
