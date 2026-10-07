"use client";

import React, { useEffect, useState } from "react";
import { pmsBodyMarkup } from "./pms-markup.js";

export default function HotelPMSApp() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Ensure bootstrap script is loaded once
    if (!document.getElementById("pms-bootstrap-script")) {
      const script = document.createElement("script");
      script.id = "pms-bootstrap-script";
      script.type = "module";
      script.src = "/pms-bootstrap.js";
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div
      id="pms-next-root"
      style={{ width: "100%", height: "100%", minHeight: "100vh" }}
      dangerouslySetInnerHTML={{ __html: pmsBodyMarkup }}
    />
  );
}
