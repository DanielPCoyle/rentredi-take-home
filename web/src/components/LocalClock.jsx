import { useEffect, useState } from "react";
import { localTime } from "../util.js";

// Creative addition: a live, ticking clock showing the user's local time,
// computed purely from the stored `timezone` offset.
export default function LocalClock({ offset }) {
  const [now, setNow] = useState(() => localTime(offset));
  useEffect(() => {
    const t = setInterval(() => setNow(localTime(offset)), 1000);
    return () => clearInterval(t);
  }, [offset]);
  return (
    <span className="clock">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}
