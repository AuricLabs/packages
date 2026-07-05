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
  const handler = createJobsDashboardApiHandler();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers CORS preflight without routing', async () => {
    const response = await handler(createEvent('OPTIONS', '/api/jobs'));

    expect(response).toMatchObject({ statusCode: 200 });
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
