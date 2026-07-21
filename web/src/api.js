// Thin fetch wrapper that unwraps the API's { data } / { error } envelopes and
// throws a real Error (with optional field details) on non-2xx responses.
export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204, etc. */ }
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.details = json?.error?.details;
    throw err;
  }
  return json;
}
