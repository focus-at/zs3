export interface CapturedRequest {
  url: URL;
  init: RequestInit;
}

type MockResponse = Response | ((request: CapturedRequest, index: number) => Response | Promise<Response>);

let restoreCurrentFetch: (() => void) | undefined;

/** Replace fetch and record requests while returning queued deterministic responses. */
export function mockFetch(...responses: MockResponse[]) {
  restoreMockFetch();
  const originalFetch = globalThis.fetch;
  const requests: CapturedRequest[] = [];

  globalThis.fetch = (async (input: URL | RequestInfo, init: RequestInit = {}) => {
    const url = input instanceof URL
      ? input
      : input instanceof Request
      ? new URL(input.url)
      : new URL(input.toString());
    const request = { url, init };
    const index = requests.push(request) - 1;
    const response = responses[index] ?? new Response("", { status: 200 });
    return typeof response === "function" ? response(request, index) : response;
  }) as typeof fetch;

  restoreCurrentFetch = () => {
    globalThis.fetch = originalFetch;
    restoreCurrentFetch = undefined;
  };

  return requests;
}

export function restoreMockFetch() {
  restoreCurrentFetch?.();
}
