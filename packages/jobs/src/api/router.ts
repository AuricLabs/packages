import { NotFoundError } from 'http-errors-enhanced';

import { getJobService } from '../init';
import { jobStatus } from '../types';

import { executeCancelJob, executeRetryJob } from './routes/actions';
import { getJobById, getJobs, getJobsSummary, isJobStatus } from './routes/jobs';

export interface RouteResult {
  statusCode: number;
  body: unknown;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

const invalidPath: RouteResult = { statusCode: 400, body: { error: 'Invalid path encoding' } };

export async function routeRequest(
  method: string,
  path: string,
  body: string | undefined,
  query: Record<string, string | undefined> = {},
): Promise<RouteResult> {
  // Normalize path — strip trailing slash
  const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  try {
    // GET /api/jobs/summary
    if (method === 'GET' && normalizedPath === '/api/jobs/summary') {
      const summary = await getJobsSummary();
      return { statusCode: 200, body: summary };
    }

    // POST /api/jobs/:id/retry
    const retryMatch = /^\/api\/jobs\/([^/]+)\/retry$/.exec(normalizedPath);
    if (method === 'POST' && retryMatch) {
      let parsed: { scheduledAt?: string } = {};
      if (body) {
        try {
          parsed = JSON.parse(body) as { scheduledAt?: string };
        } catch {
          return { statusCode: 400, body: { error: 'Invalid JSON' } };
        }
      }
      const jobId = safeDecode(retryMatch[1]);
      if (jobId === null) {
        return invalidPath;
      }
      try {
        const result = await executeRetryJob(jobId, parsed.scheduledAt);
        return { statusCode: 200, body: result };
      } catch (error) {
        if (error instanceof NotFoundError) {
          // the conditional write reports both missing and non-retryable jobs
          // as not-found — distinguish so the UI can show an honest message
          const job = await getJobService()
            .getJob(jobId)
            .catch(() => undefined);
          if (job && (job.status === jobStatus.running || job.status === jobStatus.cancelled)) {
            return {
              statusCode: 409,
              body: { retried: false, error: `Job is ${job.status}` },
            };
          }
        }
        throw error;
      }
    }

    // POST /api/jobs/:id/cancel
    const cancelMatch = /^\/api\/jobs\/([^/]+)\/cancel$/.exec(normalizedPath);
    if (method === 'POST' && cancelMatch) {
      const jobId = safeDecode(cancelMatch[1]);
      if (jobId === null) {
        return invalidPath;
      }
      const result = await executeCancelJob(jobId);
      return { statusCode: result.cancelled ? 200 : 409, body: result };
    }

    // GET /api/jobs/:id
    const jobIdMatch = /^\/api\/jobs\/([^/]+)$/.exec(normalizedPath);
    if (method === 'GET' && jobIdMatch) {
      const jobId = safeDecode(jobIdMatch[1]);
      if (jobId === null) {
        return invalidPath;
      }
      const detail = await getJobById(jobId);
      return { statusCode: 200, body: detail };
    }

    // GET /api/jobs
    if (method === 'GET' && normalizedPath === '/api/jobs') {
      const status = query.status;
      if (status !== undefined && !isJobStatus(status)) {
        return { statusCode: 400, body: { error: `Invalid status "${status}"` } };
      }
      const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 1 || limit > 500)) {
        return { statusCode: 400, body: { error: 'limit must be between 1 and 500' } };
      }
      const result = await getJobs({ status, limit });
      return { statusCode: 200, body: result };
    }

    return { statusCode: 404, body: { error: 'Not found' } };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { statusCode: 404, body: { error: error.message } };
    }
    throw error;
  }
}
