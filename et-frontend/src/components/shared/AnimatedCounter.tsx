"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1.5,
  className = "",
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState("0");
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration,
      ease: "easeOut",
      onUpdate(v) {
        const rounded = Math.round(v);
        if (prefix === "₹") {
          setDisplay(
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(rounded)
          );
        } else {
          setDisplay(
            `${prefix}${new Intl.NumberFormat("en-IN").format(rounded)}${suffix}`
          );
        }
      },
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, prefix, suffix, duration]);

  return <span className={className}>{display}</span>;
}
