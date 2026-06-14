# MindVault Habit System - Phase 1 Implementation

## Overview

The Habit System enables users to build and track recurring habits through a local-first, privacy-respecting interface. All data is stored in IndexedDB on the user's device with no server synchronization in Phase 1.

**Status:** Phase 1 Complete (Weeks 1-4)  
**Last Updated:** 2025-01-15  
**Version:** 1.0.0

## Architecture

### Data Model

```
habits                    → Habit metadata (title, category, status)
  └─ habit_versions       → Versioned snapshots (immutable, audit trail)
      └─ habit_occurrences → One record per scheduled instance
          └─ metadata: variant, mood, actualDuration, notes
  ├─ habit_notes          → Habit-level reflections (lessons, optimization)
  └─ habit_sops           → Standard Operating Procedures (checklists)
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Local-first storage (IndexedDB)** | Privacy by default, works offline, scales to 1000+ records |
| **Immutable versioning** | Full audit trail, prevents retroactive surprises |
| **RRULE-based recurrence** | Standard format (RFC 5545), portable, extensible |
| **90-day occurrence pre-materialization** | Scales cleanly without infinite loops |
| **Nightly housekeeping job** | Extends occurrences 30 days; runs async, non-blocking |
| **Compound scoring (ease + leverage)** | Recommends habits that are both enjoyable AND impactful |

## Features

### Core Functionality

#### 1. **Create Habits**
- Manual form with validation
- **OR** AI-powered Atomizer discovery:
  - 20 goal templates (Get Stronger, Read More, Learn, Sleep, etc.)
  - Keyword search + scoring
  - Pre-filled durations, cues, ratings
  - Edit before confirming

#### 2. **Track Habits (Today Screen)**
- View all pending habits for the day
- One-tap check-in with 3 variants:
  - **Full** (complete version)
  - **Reduced** (50% time)
  - **Minimum** (25% time)
- Capture:
  - Actual duration
  - Mood (great/good/ok/tough/struggled)
  - Quick notes
- Auto-complete habit or mark as skipped

#### 3. **Habit Details (5 Tabs)**

**Overview**
- Ratings visualization (difficulty, time, enjoyment, impact, alignment)
- Cue (time, location, context)
- Current durations (full/reduced/minimum)
- Edit or Archive buttons

**Timeline**
- Chronological list of all completions/skips (past 90 days)
- Shows date, variant, mood, notes for each occurrence

**Notes**
- Add habit-level reflections:
  - Reflection: general thoughts
  - Lesson Learned: key insights
  - Optimization: ideas for improvement
  - Success Log: wins to celebrate
  - Friction Log: obstacles encountered
- Notes are AI-visible (opt-in) for Phase 2 alignment engine

**SOPs (Standard Operating Procedures)**
- Create checklist for habit execution
- Example: "Strength Session Warm-up"
  - [ ] 5-min cardio
  - [ ] Dynamic stretches
  - [ ] Mobility work

**Versions**
- Complete edit history with change reasons
- Click habit details, edit, click "Edit Habit" to create new version
- Old occurrences stay linked to old version (no retroactive changes)

#### 4. **Box Breathing Integration**
- Complete meditation → "Save as Daily Habit" button
- Auto-creates daily habit with pre-filled durations
- Example: "4-4-4-4 Box Breathing" (30 min full, 15 min reduced, 5 min min)

### Data Validation

| Field | Validation |
|-------|-----------|
| **Title** | 1-100 chars, required, case-insensitive uniqueness per category |
| **RRULE** | RFC 5545 syntax, must generate occurrences |
| **Durations** | 1-1440 min (1 min to 24 hours), reduced < full < minimum |
| **Ratings** | 1-10 scale |
| **Notes** | Max 5000 chars |
| **SOPs** | Title: 1-200 chars, Body: 1-10000 chars |

### Scoring Algorithm

```javascript
ease = enjoyment / ((difficulty + 1) * (timeRequired + 1)) * 10
leverage = (impact * alignment) / 10
compoundScore = (leverage * 0.6 + ease * 0.4) * 10  // 0-100 range
```

**Interpretation:**
- **Score 80+**: Highly recommended (enjoyable, impactful, quick)
- **Score 60-80**: Good fit (balanced ease/leverage)
- **Score <60**: Challenging (difficult, time-consuming, or low impact)

## Performance Baselines

| Operation | Target | Warning |
|-----------|--------|---------|
| Today screen load | 500ms | 800ms |
| Detail screen load | 300ms | 600ms |
| Check-in modal | 100ms | 300ms |
| Occurrence completion | 500ms | 1000ms |
| Habit creation | 1000ms | 2000ms |

**Measurement:** Use `src/lib/habitPerformance.js` or browser DevTools.

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Vercel auto-deploys on push
# Check deployment: https://vercel.com/[your-team]/mindvault
```

**Environment Variables (Optional)**
```
CRON_SECRET=your-secret-key  # For nightly job (Phase 2)
```

### Nightly Job Setup

**Option 1: Vercel Cron (Free, Recommended)**
```javascript
// api/cron/materialize-occurrences.js
export const config = {
  api: {
    route: '/api/cron/materialize-occurrences',
  },
};

export default async function handler(req, res) {
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const result = await materializeOccurrencesNightly();
  return res.status(200).json({ success: true, ...result });
}
```

**Option 2: AWS Lambda ($0.20/month)**
- Create Lambda function
- Add EventBridge trigger: `cron(0 2 * * ? *)` (02:00 UTC daily)
- Set timeout: 60 seconds

See `src/lib/nightlyJobSetup.js` for detailed setup.

## File Structure

```
src/
├── lib/
│   ├── habitDB.js                    # IndexedDB initialization
│   ├── habitService.js               # CRUD operations
│   ├── habitValidation.js            # Form validation
│   ├── habitPerformance.js           # Performance monitoring
│   ├── atomizer-rules.js             # 20 habit goal templates
│   └── nightlyJobSetup.js            # Nightly job documentation
│
└── features/
    └── habits/
        ├── TodayHabitsScreen.jsx     # Today view
        ├── CheckInModal.jsx          # Check-in form
        ├── HabitDetailScreen.jsx     # 5-tab detail view
        ├── HabitFormScreen.jsx       # Create/edit form
        ├── HabitsListScreen.jsx      # Hub (Today, List, Detail, Atomizer)
        └── AtomizerFlow.jsx          # AI discovery flow
```

## Testing Checklist

### Functional Testing
- [ ] Create habit manually (form validation works)
- [ ] Create habit via Atomizer (search, edit, create flow)
- [ ] Check in with all 3 variants
- [ ] Add notes, mood, duration
- [ ] Edit habit (creates new version)
- [ ] View version history
- [ ] Archive habit
- [ ] Box Breathing → Save as habit
- [ ] Verify occurrences created for 90 days

### Data Integrity Testing
- [ ] Old occurrences stay on old version after edit
- [ ] Duplicate habit name blocked (same category)
- [ ] RRULE parsing works for all presets
- [ ] Notes persist across page reloads
- [ ] Scoring calculates correctly

### Mobile Testing (480px, 900px breakpoints)
- [ ] Forms fit without horizontal scroll
- [ ] Modals responsive on small screens
- [ ] Tabs render properly
- [ ] Buttons accessible with touch
- [ ] Collapsible cards work on mobile

### Performance Testing
- [ ] Today screen loads < 500ms
- [ ] Detail screen loads < 300ms
- [ ] Check-in modal shows < 100ms
- [ ] Habit creation < 1000ms

## Common Tasks

### Manual Occurrence Materialization
If nightly job fails or you need to manually extend occurrences:
```javascript
// In browser console:
import { materializeOccurrencesNightly } from '/src/lib/habitService.js';
await materializeOccurrencesNightly();
```

### Export All Habit Data
```javascript
// In console:
import { exportAllData } from '/src/lib/habitService.js';
const data = await exportAllData();
console.log(JSON.stringify(data, null, 2));
```

### Clear All Data (Caution!)
```javascript
// In console:
import { clearMetrics } from '/src/lib/metrics.js';
await clearMetrics();
// Also clear habits:
const db = await indexedDB.open('mindvault_v1');
// Navigate to Application > Storage > IndexedDB, delete tables
```

## Known Limitations (Phase 1)

| Limitation | Phase for Fix |
|------------|--------------|
| No cloud sync (local only) | Phase 2 |
| No AI insights (manually added notes) | Phase 2 |
| No habit vault (goals → habits linking) | Phase 2 |
| No privacy mode (all notes visible) | Phase 2 |
| No habit analytics dashboard | Phase 2 |
| No batch operations (delete multiple) | Phase 2 |

## Troubleshooting

### Habit appears in list but not Today screen
- Check `dueAt` timestamp in IndexedDB (should be today's date)
- Run occurrence materialization manually
- Verify RRULE is RFC 5545 compliant

### Check-in modal takes >100ms to appear
- Profile with DevTools Performance tab
- Check IndexedDB latency (may need transaction optimization)

### Validation says "duplicate habit" but name is unique
- Validation is case-insensitive + category-specific
- Example: "Morning Run" (wellness) ≠ "Morning Run" (health)

## Git Commits

```
a0f1762 - feat: implement Atomizer with 20 habit goal templates
bed97ee - feat: implement Habit Detail screen with 5 tabs and versioning  
3918498 - feat: implement Today Habits screen with creation and management
899d7f3 - feat: integrate Box Breathing with habit creation
7988c6f - feat: add habit schema and service layer (CRUD, versions, occurrences)
```

## Next Steps (Phase 2-5)

**Phase 2 (Vault Alignment)**: Link habits to goals, AI-generated insights  
**Phase 3 (Analytics)**: Habit trends, streak tracking, recommendations  
**Phase 4 (Privacy & Sync)**: Optional cloud sync, end-to-end encryption  
**Phase 5 (Advanced)**: Mobile app, wearable integration, calendar sync

## Support

For issues or questions:
1. Check HABIT_SYSTEM_README.md (this file)
2. Review git commits for implementation details
3. Check src/lib/habitValidation.js for validation rules
4. Profile with DevTools Performance for speed issues

---

**Built with ❤️ for mindful habit formation**
