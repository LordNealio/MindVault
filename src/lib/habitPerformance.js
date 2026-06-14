// Performance Monitoring for Habit System
// Tracks load times and validates against baselines

const PERFORMANCE_BASELINES = {
  todayScreenLoad: { target: 500, warning: 800 },        // ms
  detailScreenLoad: { target: 300, warning: 600 },       // ms
  formScreenLoad: { target: 200, warning: 400 },         // ms
  checkInModalShow: { target: 100, warning: 300 },       // ms
  occurrenceCompletion: { target: 500, warning: 1000 },  // ms
  habitCreation: { target: 1000, warning: 2000 },        // ms
};

class PerformanceMonitor {
  constructor() {
    this.measurements = {};
    this.logs = [];
  }

  start(label) {
    if (!this.measurements[label]) {
      this.measurements[label] = [];
    }
    const startTime = performance.now();
    return {
      end: () => this.end(label, startTime),
      cancel: () => delete this.measurements[label],
    };
  }

  end(label, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    this.measurements[label].push(duration);

    // Log if exceeds warning threshold
    const baseline = PERFORMANCE_BASELINES[label];
    if (baseline && duration > baseline.warning) {
      const status = duration > baseline.target ? "⚠️ WARNING" : "ℹ️ INFO";
      const message = `${status} ${label}: ${duration.toFixed(0)}ms (target: ${baseline.target}ms)`;
      console.warn(message);
      this.logs.push({ timestamp: new Date().toISOString(), label, duration, status });
    }

    return duration;
  }

  getStats(label) {
    const measurements = this.measurements[label] || [];
    if (measurements.length === 0) return null;

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return {
      count: measurements.length,
      avg: avg.toFixed(0),
      min: min.toFixed(0),
      max: max.toFixed(0),
      baseline: PERFORMANCE_BASELINES[label],
    };
  }

  getAllStats() {
    const stats = {};
    Object.keys(this.measurements).forEach(label => {
      stats[label] = this.getStats(label);
    });
    return stats;
  }

  reset() {
    this.measurements = {};
    this.logs = [];
  }

  exportReport() {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getAllStats(),
      logs: this.logs,
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : "unknown",
      },
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React Hook for performance measurement
export function usePerformanceTracker(label) {
  const tracker = performanceMonitor.start(label);
  return tracker;
}

// Utility to measure async operations
export async function measureAsync(label, asyncFn) {
  const tracker = performanceMonitor.start(label);
  try {
    const result = await asyncFn();
    tracker.end();
    return result;
  } catch (err) {
    tracker.end();
    throw err;
  }
}
