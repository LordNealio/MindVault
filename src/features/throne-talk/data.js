// ── Throne Talk Static Data ────────────────────────────────────────────────

export const WEEKLY_QUESTIONS = [
  {
    id: "q1",
    text: "What does it mean to truly listen — and how often do you actually do it?",
    scripture: {
      Christianity: { text: "Let every person be quick to hear, slow to speak, slow to anger.", source: "James 1:19" },
      Buddhism:     { text: "In the beginner's mind there are many possibilities; in the expert's mind there are few.", source: "Shunryu Suzuki" },
      Stoicism:     { text: "We have two ears and one mouth so that we can listen twice as much as we speak.", source: "Epictetus, Discourses" },
      Islam:        { text: "The heart of him who has no stillness has no mirror.", source: "Ibn Arabi" },
      Taoism:       { text: "Silence is a source of great strength.", source: "Tao Te Ching, Ch. 16" },
      Hinduism:     { text: "He who has conquered the mind — for him the mind is the best of friends.", source: "Bhagavad Gita 6.6" },
      Judaism:      { text: "A wise man's heart guides his mouth.", source: "Proverbs 16:23" },
      "Secular/Explorer": { text: "The most basic way to connect to another person is to listen.", source: "Rachel Naomi Remen" },
    },
  },
  {
    id: "q2",
    text: "Where in your life are you answering questions that haven't been asked?",
    scripture: {
      Christianity: { text: "Do not be anxious about tomorrow, for tomorrow will be anxious for itself.", source: "Matthew 6:34" },
      Buddhism:     { text: "Do not dwell in the past, do not dream of the future — concentrate the mind on the present moment.", source: "Dhammapada" },
      Stoicism:     { text: "It is not things that disturb us, but our judgments about things.", source: "Epictetus, Enchiridion" },
      Islam:        { text: "Trust in God, but tie your camel.", source: "Prophet Muhammad (Hadith)" },
      Taoism:       { text: "By letting go it all gets done. The world is won by those who let it go.", source: "Tao Te Ching, Ch. 48" },
      Hinduism:     { text: "Let right deeds be thy motive, not the fruit which comes from them.", source: "Bhagavad Gita 2.47" },
      Judaism:      { text: "Who is wise? One who learns from every person.", source: "Pirkei Avot 4:1" },
      "Secular/Explorer": { text: "We cannot solve our problems with the same thinking we used when we created them.", source: "Albert Einstein" },
    },
  },
  {
    id: "q3",
    text: "What assumption are you most afraid to question?",
    scripture: {
      Christianity: { text: "You will know the truth, and the truth will set you free.", source: "John 8:32" },
      Buddhism:     { text: "If you meet the Buddha on the road, kill him.", source: "Linji Yixuan" },
      Stoicism:     { text: "First say to yourself what you would be, then do what you have to do.", source: "Epictetus, Discourses" },
      Islam:        { text: "He who knows himself knows his Lord.", source: "Prophet Muhammad (Hadith)" },
      Taoism:       { text: "Knowing others is wisdom; knowing yourself is enlightenment.", source: "Tao Te Ching, Ch. 33" },
      Hinduism:     { text: "That which is not, shall never be. That which is, shall never cease to be.", source: "Bhagavad Gita 2.16" },
      Judaism:      { text: "Examine the words; then examine yourself.", source: "Talmud, Brachot 4a" },
      "Secular/Explorer": { text: "The unexamined life is not worth living.", source: "Socrates, Apology" },
    },
  },
  {
    id: "q4",
    text: "What would remain if you stripped away every role you play?",
    scripture: {
      Christianity: { text: "Be still and know that I am God.", source: "Psalm 46:10" },
      Buddhism:     { text: "The self is not a fixed point but a flowing process.", source: "Thich Nhat Hanh" },
      Stoicism:     { text: "Waste no more time arguing about what a good man should be. Be one.", source: "Marcus Aurelius, Meditations" },
      Islam:        { text: "Die before you die and discover there is no death.", source: "Prophet Muhammad (Hadith)" },
      Taoism:       { text: "To the mind that is still, the whole universe surrenders.", source: "Zhuangzi" },
      Hinduism:     { text: "You are not the body. You are not the mind. You are the witness.", source: "Upanishads" },
      Judaism:      { text: "Each person is a world entire.", source: "Talmud, Sanhedrin 37a" },
      "Secular/Explorer": { text: "I am not what happened to me; I am what I choose to become.", source: "Carl Jung" },
    },
  },
  {
    id: "q5",
    text: "When did you last change your mind about something important — and what changed it?",
    scripture: {
      Christianity: { text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind.", source: "Romans 12:2" },
      Buddhism:     { text: "Fixed views are the greatest impediment to awakening.", source: "Pali Canon, Majjhima Nikaya" },
      Stoicism:     { text: "If someone is able to show me that what I think or do is not right, I will happily change.", source: "Marcus Aurelius, Meditations" },
      Islam:        { text: "Consult those who know, if you do not know.", source: "Quran 16:43" },
      Taoism:       { text: "Water is the softest thing, yet it can penetrate mountains and earth.", source: "Tao Te Ching, Ch. 78" },
      Hinduism:     { text: "Knowledge is not separate from the knower.", source: "Adi Shankaracharya" },
      Judaism:      { text: "Better is one hour of turning back in this world than the whole life of the World to Come.", source: "Pirkei Avot 4:22" },
      "Secular/Explorer": { text: "A mind stretched by a new idea never returns to its original dimensions.", source: "Oliver Wendell Holmes" },
    },
  },
];

export const SOCRATIC_PROMPTS = {
  Clarification: [
    "What do you mean when you think about this?",
    "Can you state this more precisely?",
    "What is the core of what you're observing here?",
    "If you had to explain this to someone who knows nothing about it, what would you say?",
    "What words are doing the most work in your thinking right now?",
    "What would you say if you had only 10 words?",
  ],
  Assumption: [
    "What are you taking for granted?",
    "What would someone who disagrees assume instead?",
    "Which of your beliefs here are inherited, and which did you arrive at yourself?",
    "What would have to be true for the opposite to be equally valid?",
    "What assumption beneath this question do you not want to examine?",
    "Whose worldview is embedded in the way you're framing this?",
  ],
  Evidence: [
    "What makes you believe this?",
    "What would change your mind?",
    "What evidence are you ignoring that would complicate this?",
    "Is your certainty proportional to your evidence?",
    "What would a skeptic say about your strongest point?",
    "Have you actually tested this, or only imagined testing it?",
  ],
  Viewpoint: [
    "How might this look from a completely different lens?",
    "Whose perspective is absent here?",
    "If someone from a different tradition heard this, what might they see that you can't?",
    "What does this question look like to someone living 500 years ago? 500 years from now?",
    "What does this look like from below — from someone with less power?",
    "What would a child say about this that an adult would miss?",
  ],
  Consequence: [
    "If this were true, what follows?",
    "What are the implications you haven't considered?",
    "What becomes impossible if this is right?",
    "Who benefits from this being true, and who loses?",
    "What would the world look like if everyone believed this?",
    "What are you willing to give up to hold this position?",
  ],
  MetaQuestion: [
    "Why does this question matter?",
    "What question is beneath this question?",
    "Are you asking the right question, or the comfortable one?",
    "What does your resistance to this question tell you?",
    "What would you see if you stopped trying to answer and just sat with the question?",
    "Who benefits from this question staying unanswered?",
  ],
};

export const DAY_CATEGORIES = {
  0: ["Clarification", "MetaQuestion"],
  1: ["Clarification", "Assumption"],
  2: ["Clarification", "Assumption"],
  3: ["Assumption", "Evidence"],
  4: ["Evidence", "Viewpoint"],
  5: ["Viewpoint", "Consequence"],
  6: ["Consequence", "MetaQuestion"],
};

export const LEVELS = [
  { id: 1, name: "Observer",     bloom: "Remember + Understand", minPoints: 0,    color: "#9B9589" },
  { id: 2, name: "Questioner",   bloom: "Apply + Analyze",       minPoints: 150,  color: "#5B8FA8" },
  { id: 3, name: "Pattern Seer", bloom: "Analyze + Evaluate",    minPoints: 500,  color: "#2D6A4F" },
  { id: 4, name: "Mirror",       bloom: "Evaluate + Create",     minPoints: 1200, color: "#E8B84B" },
  { id: 5, name: "Witness",      bloom: "Create",                minPoints: 3000, color: "#C1121F" },
];

export const LENSES = [
  { id: "Buddhism",        label: "Buddhism",          icon: "☸",  color: "#8B5E3C" },
  { id: "Christianity",    label: "Christianity",      icon: "✝",  color: "#1D3557" },
  { id: "Islam",           label: "Islam",             icon: "☪",  color: "#2D6A4F" },
  { id: "Stoicism",        label: "Stoicism",          icon: "⚖",  color: "#4A4A4A" },
  { id: "Taoism",          label: "Taoism",            icon: "☯",  color: "#5B8FA8" },
  { id: "Hinduism",        label: "Hinduism",          icon: "◯",  color: "#C1440E" },
  { id: "Judaism",         label: "Judaism",           icon: "✡",  color: "#2B4590" },
  { id: "Secular/Explorer",label: "Secular / Explorer",icon: "◎",  color: "#6B4F9E" },
];

export const DEPTH_RATINGS = [
  { value: 1, label: "Surface",     description: "States the obvious; stays on the surface" },
  { value: 2, label: "Considered",  description: "Shows thought; goes one layer deeper" },
  { value: 3, label: "Deep",        description: "Reveals genuine inquiry; questions assumptions" },
  { value: 4, label: "Penetrating", description: "Shifts how I see the question entirely" },
];

export const SEED_OBSERVATIONS = [
  {
    id: "seed-1",
    text: "I notice I only listen when I'm waiting for my turn to speak. The pause before my response isn't receptivity — it's just reload time.",
    lens: "Stoicism",
    promptCategory: "Clarification",
    weekId: "seed",
    depthRatings: [3, 3, 4],
    timestamp: Date.now() - 86400000 * 3,
  },
  {
    id: "seed-2",
    text: "Every assumption I'm afraid to question has a payoff. The assumption keeps something comfortable — a story about myself, a reason not to act. The fear is not about the truth. It's about what changes if the truth lands.",
    lens: "Buddhism",
    promptCategory: "Assumption",
    weekId: "seed",
    depthRatings: [4, 3, 4],
    timestamp: Date.now() - 86400000 * 5,
  },
  {
    id: "seed-3",
    text: "When I strip away the roles — parent, professional, friend — what's left feels less like a self and more like a capacity. A readiness. I don't know if that's emptiness or freedom.",
    lens: "Taoism",
    promptCategory: "Viewpoint",
    weekId: "seed",
    depthRatings: [4, 4, 3],
    timestamp: Date.now() - 86400000 * 2,
  },
  {
    id: "seed-4",
    text: "I answered a question about listening and realized I was performing understanding rather than actually understanding. I described what good listening looks like. I didn't practice it while writing.",
    lens: "Secular/Explorer",
    promptCategory: "MetaQuestion",
    weekId: "seed",
    depthRatings: [4, 4, 4],
    timestamp: Date.now() - 86400000 * 1,
  },
  {
    id: "seed-5",
    text: "The question I'm most afraid to examine is whether the version of God I believe in is actually just a projection of what I want reality to be — a universe that cares about me specifically.",
    lens: "Christianity",
    promptCategory: "Assumption",
    weekId: "seed",
    depthRatings: [3, 4, 4],
    timestamp: Date.now() - 86400000 * 4,
  },
  {
    id: "seed-6",
    text: "I changed my mind about productivity last year. I used to think it was about output. Now I think it's a defense mechanism — if I'm always producing, I don't have to ask whether I'm pointed in the right direction.",
    lens: "Hinduism",
    promptCategory: "Evidence",
    weekId: "seed",
    depthRatings: [3, 3, 3],
    timestamp: Date.now() - 86400000 * 6,
  },
  {
    id: "seed-7",
    text: "I notice that when someone disagrees with me, I immediately look for the flaw in their reasoning rather than the truth in it. This is automatic. I didn't decide to do it.",
    lens: "Judaism",
    promptCategory: "Clarification",
    weekId: "seed",
    depthRatings: [2, 3, 3],
    timestamp: Date.now() - 86400000 * 2,
  },
  {
    id: "seed-8",
    text: "The question beneath every question I've asked today is: am I enough? I keep dressing it up in philosophy but the root is the same.",
    lens: "Islam",
    promptCategory: "MetaQuestion",
    weekId: "seed",
    depthRatings: [4, 3, 4],
    timestamp: Date.now() - 86400000 * 1,
  },
];

export function getCurrentWeekId() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getCurrentQuestion() {
  const weekId = getCurrentWeekId();
  let hash = 0;
  for (const c of weekId) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return WEEKLY_QUESTIONS[hash % WEEKLY_QUESTIONS.length];
}

export function getDayCategories() {
  return DAY_CATEGORIES[new Date().getDay()];
}

export function getTotalPoints(points) {
  return (points.depth ?? 0) + (points.clarity ?? 0) + (points.engagement ?? 0) + (points.acuity ?? 0);
}

export function getLevelForPoints(total) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (total >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(current) {
  return LEVELS.find(l => l.id === current.id + 1) || null;
}
