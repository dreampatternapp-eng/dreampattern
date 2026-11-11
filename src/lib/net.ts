const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch() that retries when the request fails before any response arrives.
 *
 * iOS keeps connections to our server open between requests. If the server has quietly closed one,
 * the next POST fails at once with "The network connection was lost" (NSURLError -1005), and iOS
 * does not retry POSTs on its own. A fresh attempt opens a new connection and normally succeeds.
 * HTTP error statuses are returned as is and never retried.
 */
export async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(attempt === 0 ? 300 : 1200);
    }
  }
}
