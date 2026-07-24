const QUEUE_KEY = "rentredi-offline-user-mutations";
const USERS_CHANGED_EVENT = "rentredi-users-changed";
// Feedback signals for the offline UX: PENDING_CHANGED fires whenever the queue
// length changes (drives the banner count); SYNC_COMPLETE carries the replay
// result { synced, failed } so the UI can confirm or warn.
const PENDING_CHANGED_EVENT = "rentredi-pending-changed";
const SYNC_COMPLETE_EVENT = "rentredi-sync-complete";

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(USERS_CHANGED_EVENT));
  window.dispatchEvent(new Event(PENDING_CHANGED_EVENT));
}

// How many offline mutations are waiting to sync.
export function pendingCount() {
  return readQueue().length;
}

// Subscribe to the pending count; returns an unsubscribe fn. Fires immediately
// with the current count so callers don't need a separate initial read.
export function onPendingChange(cb) {
  const handler = () => cb(pendingCount());
  window.addEventListener(PENDING_CHANGED_EVENT, handler);
  handler();
  return () => window.removeEventListener(PENDING_CHANGED_EVENT, handler);
}

// Short human label for a queued op, used in "couldn't sync X" warnings.
function describeOp(op) {
  const name = op.body?.name ? `${op.body.name}: ` : "";
  const location = op.body?.locationQuery || [op.body?.zip, op.body?.country].filter(Boolean).join(", ");
  return `${name}${location || op.path}`;
}

function temporaryUser(body, id) {
  return {
    id,
    name: body.name,
    zip: body.zip,
    country: body.country || "US",
    city: "Pending sync",
    lat: null,
    lon: null,
    timezone: null,
    timezoneName: null,
    pendingSync: true,
  };
}

function queueMutation(method, path, body) {
  const queue = readQueue();

  // Editing a user that was itself created offline should update that queued
  // POST instead of creating a PUT for a temporary id the server has never seen.
  const tempId = path.match(/^\/api\/users\/(offline-[^/]+)$/)?.[1];
  if (method === "PUT" && tempId) {
    const pendingCreate = queue.find((item) => item.method === "POST" && item.tempId === tempId);
    if (pendingCreate) {
      pendingCreate.body = { ...pendingCreate.body, ...body };
      writeQueue(queue);
      return { data: temporaryUser(pendingCreate.body, tempId), queued: true };
    }
  }

  const tempIdForCreate = method === "POST" && path === "/api/users"
    ? `offline-${crypto.randomUUID()}`
    : null;

  queue.push({
    id: crypto.randomUUID(),
    method,
    path,
    body,
    tempId: tempIdForCreate,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);

  return {
    data: tempIdForCreate ? temporaryUser(body, tempIdForCreate) : { ...body, pendingSync: true },
    queued: true,
  };
}

function applyPendingMutations(users) {
  return readQueue().reduce((current, mutation) => {
    if (mutation.method === "POST" && mutation.path === "/api/users") {
      return current.some((user) => user.id === mutation.tempId)
        ? current
        : [...current, temporaryUser(mutation.body, mutation.tempId)];
    }

    const userId = mutation.path.match(/^\/api\/users\/([^/]+)$/)?.[1];
    if (!userId) return current;

    if (mutation.method === "PUT") {
      return current.map((user) =>
        String(user.id) === userId
          ? { ...user, ...mutation.body, pendingSync: true }
          : user,
      );
    }

    if (mutation.method === "DELETE") {
      return current.filter((user) => String(user.id) !== userId);
    }

    return current;
  }, users);
}

async function request(method, path, body) {
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

let replaying = false;
export async function replayOfflineMutations() {
  if (replaying || !navigator.onLine) return { synced: 0, failed: [] };
  replaying = true;

  let synced = 0;
  const failed = [];
  try {
    let queue = readQueue();
    while (queue.length) {
      const mutation = queue[0];
      try {
        await request(mutation.method, mutation.path, mutation.body);
        synced += 1;
        queue = queue.slice(1);
        writeQueue(queue);
      } catch (error) {
        if (error instanceof TypeError) {
          // Still offline / network dropped mid-replay: keep the rest queued and
          // stop; the next reconnect retries from here.
          break;
        }
        // A real API error (validation/conflict, e.g. editing a user deleted on
        // the server): this op can never succeed, so drop it, record it for a
        // warning, and continue with the rest.
        failed.push({ label: describeOp(mutation), message: error.message || "Could not sync this change" });
        queue = queue.slice(1);
        writeQueue(queue);
      }
    }
  } finally {
    replaying = false;
  }

  if (synced > 0 || failed.length > 0) {
    window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT, { detail: { synced, failed } }));
  }
  return { synced, failed };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", replayOfflineMutations);
  queueMicrotask(replayOfflineMutations);
}

// Fetch wrapper that unwraps the API envelope. User mutations are queued when
// offline (or when fetch fails at the network layer), and GET /api/users overlays
// those pending writes so the UI updates immediately and survives reloads.
export async function api(method, path, body) {
  const isUserMutation = ["POST", "PUT", "DELETE"].includes(method)
    && (path === "/api/users" || path.startsWith("/api/users/"));

  if (isUserMutation && !navigator.onLine) {
    return queueMutation(method, path, body);
  }

  try {
    const json = await request(method, path, body);
    if (method === "GET" && path === "/api/users" && Array.isArray(json?.data)) {
      return { ...json, data: applyPendingMutations(json.data) };
    }
    return json;
  } catch (error) {
    if (isUserMutation && error instanceof TypeError) {
      return queueMutation(method, path, body);
    }
    throw error;
  }
}

export { USERS_CHANGED_EVENT, SYNC_COMPLETE_EVENT };
