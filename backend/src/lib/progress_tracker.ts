/**
 * In-memory progress tracker for sellers.json fetching during validation
 * Maps progress_id -> progress state
 */

export interface DomainProgress {
  domain: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  updated_at: string;
}

export interface ValidationProgress {
  progress_id: string;
  overall_status: 'processing' | 'completed' | 'partial';
  domains: Record<string, DomainProgress>;
  created_at: string;
  updated_at: string;
}

class ProgressTracker {
  private progress = new Map<string, ValidationProgress>();
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Create a new validation progress tracker
   */
  createProgress(progressId: string, domains: string[]): ValidationProgress {
    const now = new Date().toISOString();
    const progress: ValidationProgress = {
      progress_id: progressId,
      overall_status: 'processing',
      domains: {},
      created_at: now,
      updated_at: now,
    };

    // Initialize all domains as processing
    domains.forEach((domain) => {
      progress.domains[domain] = {
        domain,
        status: 'processing',
        updated_at: now,
      };
    });

    this.progress.set(progressId, progress);
    return progress;
  }

  /**
   * Update progress for a specific domain
   */
  updateDomainProgress(
    progressId: string,
    domain: string,
    status: 'completed' | 'failed',
    error?: string,
  ): ValidationProgress | null {
    const progress = this.progress.get(progressId);
    if (!progress) return null;

    const now = new Date().toISOString();
    progress.domains[domain] = {
      domain,
      status,
      error,
      updated_at: now,
    };

    progress.updated_at = now;

    // Update overall status
    const allDomains = Object.values(progress.domains);
    const allProcessed = allDomains.every((d) => d.status !== 'processing');
    progress.overall_status = allProcessed ? 'completed' : 'partial';

    return progress;
  }

  /**
   * Get current progress
   */
  getProgress(progressId: string): ValidationProgress | null {
    return this.progress.get(progressId) || null;
  }

  /**
   * Get progress summary
   */
  getProgressSummary(progressId: string) {
    const progress = this.getProgress(progressId);
    if (!progress) return null;

    const domains = Object.values(progress.domains);
    return {
      progress_id: progressId,
      overall_status: progress.overall_status,
      summary: {
        processing: domains.filter((d) => d.status === 'processing').length,
        completed: domains.filter((d) => d.status === 'completed').length,
        failed: domains.filter((d) => d.status === 'failed').length,
      },
      domains: {
        processing: domains.filter((d) => d.status === 'processing').map((d) => d.domain),
        completed: domains.filter((d) => d.status === 'completed').map((d) => d.domain),
        failed: domains.filter((d) => d.status === 'failed').map((d) => ({
          domain: d.domain,
          error: d.error,
        })),
      },
    };
  }

  /**
   * Cleanup old progress entries
   */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.CLEANUP_INTERVAL;

      for (const [key, progress] of this.progress.entries()) {
        const createdAt = new Date(progress.created_at).getTime();
        if (createdAt < cutoff) {
          this.progress.delete(key);
          console.log(`Cleaned up old progress tracker: ${key}`);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Destroy (for testing)
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.progress.clear();
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();
