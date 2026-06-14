// Habit Validation & Constraints

import { listHabits } from "./habitService.js";

export const VALIDATION_RULES = {
  title: {
    minLength: 1,
    maxLength: 100,
    required: true,
  },
  category: {
    required: true,
    validValues: ["wellness", "learning", "productivity", "creativity", "relationships", "health", "finance"],
  },
  rrule: {
    required: true,
  },
  durations: {
    full: { min: 1, max: 1440 },      // 1 min to 24 hours
    reduced: { min: 1, max: 1440 },
    minimum: { min: 1, max: 1440 },
  },
  ratings: {
    min: 1,
    max: 10,
  },
};

export async function validateHabitData(habitData, habitId = null) {
  const errors = [];

  // Title validation
  if (!habitData.title || !habitData.title.trim()) {
    errors.push("Title is required");
  } else if (habitData.title.length > VALIDATION_RULES.title.maxLength) {
    errors.push(`Title must be ${VALIDATION_RULES.title.maxLength} characters or less`);
  }

  // Category validation
  if (!habitData.category || !VALIDATION_RULES.category.validValues.includes(habitData.category)) {
    errors.push("Invalid category");
  }

  // Durations validation
  if (habitData.durations) {
    ["full", "reduced", "minimum"].forEach(variant => {
      const duration = habitData.durations[variant];
      if (duration < VALIDATION_RULES.durations[variant].min || duration > VALIDATION_RULES.durations[variant].max) {
        errors.push(`${variant} duration must be between ${VALIDATION_RULES.durations[variant].min} and ${VALIDATION_RULES.durations[variant].max} minutes`);
      }
    });

    // Check that reduced < full and minimum < reduced
    if (habitData.durations.reduced > habitData.durations.full) {
      errors.push("Reduced duration should be less than Full duration");
    }
    if (habitData.durations.minimum > habitData.durations.reduced) {
      errors.push("Minimum duration should be less than Reduced duration");
    }
  }

  // Ratings validation
  if (habitData.ratings) {
    Object.entries(habitData.ratings).forEach(([key, value]) => {
      if (value < VALIDATION_RULES.ratings.min || value > VALIDATION_RULES.ratings.max) {
        errors.push(`${key} must be between ${VALIDATION_RULES.ratings.min} and ${VALIDATION_RULES.ratings.max}`);
      }
    });
  }

  // Duplicate check (case-insensitive)
  const allHabits = await listHabits(true);
  const titleLower = habitData.title.toLowerCase().trim();
  const isDuplicate = allHabits.some(h =>
    h.id !== habitId &&
    h.title.toLowerCase() === titleLower &&
    h.category === habitData.category &&
    h.status === "active"
  );

  if (isDuplicate) {
    errors.push("A habit with this name already exists in this category");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateOccurrenceData(occurrenceData) {
  const errors = [];

  if (!occurrenceData.variant || !["full", "reduced", "minimum"].includes(occurrenceData.variant)) {
    errors.push("Invalid variant selected");
  }

  if (occurrenceData.actualDurationMin !== null) {
    if (occurrenceData.actualDurationMin < 0 || occurrenceData.actualDurationMin > 1440) {
      errors.push("Duration must be between 0 and 1440 minutes");
    }
  }

  if (occurrenceData.notes && occurrenceData.notes.length > 1000) {
    errors.push("Notes must be 1000 characters or less");
  }

  if (occurrenceData.mood && !["great", "good", "ok", "tough", "struggled"].includes(occurrenceData.mood)) {
    errors.push("Invalid mood selected");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateNoteData(noteData) {
  const errors = [];

  const validNoteTypes = ["reflection", "lesson_learned", "optimization", "success_log", "friction_log"];
  if (!noteData.noteType || !validNoteTypes.includes(noteData.noteType)) {
    errors.push("Invalid note type");
  }

  if (!noteData.body || !noteData.body.trim()) {
    errors.push("Note content is required");
  } else if (noteData.body.length > 5000) {
    errors.push("Note must be 5000 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateSOPData(sopData) {
  const errors = [];

  if (!sopData.title || !sopData.title.trim()) {
    errors.push("SOP title is required");
  } else if (sopData.title.length > 200) {
    errors.push("Title must be 200 characters or less");
  }

  if (!sopData.body || !sopData.body.trim()) {
    errors.push("SOP content is required");
  } else if (sopData.body.length > 10000) {
    errors.push("SOP must be 10000 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
