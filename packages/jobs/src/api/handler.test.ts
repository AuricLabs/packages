const mockRouteRequest = vi.hoisted(() => vi.fn());

vi.mock('./router', () => ({
  routeRequest: (...args: unknown[]) => mockRouteRequest(...args) as unknown,
}));

import { APIGatewayProxyEventV2 } from 'aws-lambda';

import { createJobsDashboardApiHandler } from './handler';

function createEvent(
  method: string,
  path: string,
  body?: string,
  queryStringParameters?: Record<string, string>,
): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    body,
    queryStringParameters,
    requestContext: { http: { method } },
  } as unknown as APIGatewayProxyEventV2;
}

describe('createJobsDashboardApiHandler', () => {
  const authorize = vi.fn<() => boolean>();
  const handler = createJobsDashboardApiHandler({ authorize });

  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockReturnValue(true);
  });

  it('refuses a missing authorization policy at creation', () => {
    expect(() => createJobsDashboardApiHandler({} as never)).toThrow(
      'Jobs dashboard API requires an authorization policy',
    );
  });

  it('answers CORS preflight without routing', async () => {
    const response = await handler(createEvent('OPTIONS', '/api/jobs'));

    expect(response).toMatchObject({ statusCode: 200 });
    expect(authorize).not.toHaveBeenCalled();
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('denies every data route before reaching the router', async () => {
    authorize.mockReturnValue(false);

    for (const [method, path] of [
      ['GET', '/api/jobs'],
      ['GET', '/api/jobs/summary'],
      ['GET', '/api/jobs/job-1'],
      ['POST', '/api/jobs/job-1/retry'],
      ['POST', '/api/jobs/job-1/cancel'],
      ['GET', '/api/session'],
    ]) {
      const response = await handler(createEvent(method, path));
      expect(response).toMatchObject({ statusCode: 403 });
    }
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('probes the authorized operator session without reading jobs', async () => {
    const response = await handler(createEvent('GET', '/api/session'));

    expect(response).toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ authenticated: true }),
    });
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('delegates to routeRequest and serializes the result', async () => {
    mockRouteRequest.mockResolvedValue({ statusCode: 200, body: { jobs: [] } });

    const response = await handler(
      createEvent('GET', '/api/jobs', undefined, { status: 'failed' }),
    );

    expect(mockRouteRequest).toHaveBeenCalledWith('GET', '/api/jobs', undefined, {
      status: 'failed',
    });
    expect(response).toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ jobs: [] }),
    });
  });

  it('returns 500 without leaking internals when routing throws', async () => {
    mockRouteRequest.mockRejectedValue(new Error('secret db detail'));

    const response = await handler(createEvent('GET', '/api/jobs'));

    expect(response).toMatchObject({
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    });
  });
});
