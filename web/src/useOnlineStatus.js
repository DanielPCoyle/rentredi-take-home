import { useSyncExternalStore } from "react";

// Live connectivity, straight from the browser. useSyncExternalStore keeps React
// in sync with the online/offline events so the UI re-renders when it flips.
function subscribe(cb) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
