/** Shared SWR fetcher: throws on HTTP errors instead of returning the error body as data. */
export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(message);
  }
  return res.json();
}
