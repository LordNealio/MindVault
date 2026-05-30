// Metrics Service: Local-only usage tracking and aggregation
// Events stored in IndexedDB (mindvault_v1.metrics_events)

const DB_NAME = "mindvault_v1";
const STORE_NAME = "metrics_events";

// Initialize IndexedDB store for metrics
export async function initMetricsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("eventType", "eventType", { unique: false });
        store.createIndex("feature", "feature", { unique: false });
        store.createIndex("dateKey", "dateKey", { unique: false }); // YYYY-MM-DD for daily grouping
      }
    };
  });
}

// Log a single event
export async function trackEvent(eventType, feature, metadata = {}) {
  const db = await initMetricsDB();
  const now = new Date();
  const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD

  const event = {
    timestamp: now.toISOString(),
    dateKey,
    eventType,
    feature,
    duration: metadata.duration || null,
    metadata,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(event);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(event);
  });
}

// Get all events in date range
export async function getMetricsForDateRange(startDate, endDate) {
  const db = await initMetricsDB();
  const startKey = startDate.toISOString().split("T")[0];
  const endKey = endDate.toISOString().split("T")[0];

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("dateKey");
    const range = IDBKeyRange.bound(startKey, endKey);
    const req = index.getAll(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

// Calculate aggregated metrics
export async function calculateMetrics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allEvents = await getMetricsForDateRange(thirtyDaysAgo, now);
  const todayEvents = allEvents.filter(e => e.dateKey === today.toISOString().split("T")[0]);
  const weekEvents = allEvents.filter(e => {
    const eventDate = new Date(e.dateKey);
    return eventDate >= sevenDaysAgo && eventDate <= today;
  });

  // Daily active users (unique dates with app_open)
  const activeDates = new Set(
    allEvents
      .filter(e => e.eventType === "app_open")
      .map(e => e.dateKey)
  );

  // Feature usage breakdown
  const featureUsage = {};
  allEvents.forEach(e => {
    if (e.feature) {
      featureUsage[e.feature] = (featureUsage[e.feature] || 0) + 1;
    }
  });

  // Event type breakdown
  const eventTypeBreakdown = {};
  allEvents.forEach(e => {
    eventTypeBreakdown[e.eventType] = (eventTypeBreakdown[e.eventType] || 0) + 1;
  });

  // Daily opens (for chart)
  const dailyOpens = {};
  allEvents
    .filter(e => e.eventType === "app_open")
    .forEach(e => {
      dailyOpens[e.dateKey] = (dailyOpens[e.dateKey] || 0) + 1;
    });

  // Entry creation stats
  const entriesCreated = weekEvents.filter(e => e.eventType === "entry_created").length;
  const entriesThisWeek = entriesCreated;

  // Session duration (avg of meditation/journaling sessions)
  const timedEvents = allEvents.filter(e => e.duration !== null && e.duration !== undefined);
  const avgSessionDuration = timedEvents.length > 0
    ? Math.round(timedEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / timedEvents.length)
    : 0;

  // Onboarding funnel (screen views)
  const onboardingScreens = {
    "onboarding_screen_0": 0,
    "onboarding_screen_1": 0,
    "onboarding_screen_2": 0,
    "onboarding_screen_3": 0,
    "onboarding_screen_4": 0,
    "onboarding_screen_5": 0,
  };
  allEvents
    .filter(e => e.eventType === "onboarding_screen_view")
    .forEach(e => {
      const screenKey = `onboarding_screen_${e.metadata?.screenIndex || 0}`;
      if (screenKey in onboardingScreens) {
        onboardingScreens[screenKey]++;
      }
    });

  // Days active (how many unique dates user opened app)
  const daysActive = activeDates.size;

  return {
    summary: {
      daysActive,
      entriesThisWeek,
      avgSessionDurationMs: avgSessionDuration,
      totalEventsAllTime: allEvents.length,
    },
    daily: {
      todayEvents: todayEvents.length,
      todayOpens: todayEvents.filter(e => e.eventType === "app_open").length,
      todayEntries: todayEvents.filter(e => e.eventType === "entry_created").length,
    },
    usage: {
      featureBreakdown: featureUsage,
      eventTypeBreakdown,
      dailyOpensLast30Days: dailyOpens,
    },
    onboarding: {
      screens: onboardingScreens,
      completionRate: onboardingScreens["onboarding_screen_5"] > 0
        ? Math.round((onboardingScreens["onboarding_screen_5"] / (onboardingScreens["onboarding_screen_0"] || 1)) * 100)
        : 0,
    },
    timeframe: {
      calculatedAt: now.toISOString(),
      rangeStart: thirtyDaysAgo.toISOString(),
      rangeEnd: now.toISOString(),
    },
  };
}

// Clear all metrics (for privacy reset)
export async function clearMetrics() {
  const db = await initMetricsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

// Export metrics as JSON (for analysis)
export async function exportMetricsJSON() {
  const db = await initMetricsDB();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const events = await getMetricsForDateRange(ninetyDaysAgo, now);
  const metrics = await calculateMetrics();

  return {
    metadata: {
      exportedAt: now.toISOString(),
      totalEvents: events.length,
    },
    events,
    aggregated: metrics,
  };
}
