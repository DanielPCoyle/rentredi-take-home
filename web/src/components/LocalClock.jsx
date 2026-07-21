import { useEffect, useState } from "react";
import { localTimeString } from "../util.js";

// Creative addition: a live, ticking clock showing the user's local time,
// from the resolved IANA zone (DST-correct) or the stored UTC offset.
export default function LocalClock({ zone, offset }) {
  const [str, setStr] = useState(() => localTimeString(zone, offset));
  useEffect(() => {
    const t = setInterval(() => setStr(localTimeString(zone, offset)), 1000);
    return () => clearInterval(t);
  }, [zone, offset]);
  return <span className="clock">{str}</span>;
}
