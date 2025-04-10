"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";

export default function ClientBody({ children }: { children: ReactNode }) {
  // Remove any extension-added classes during hydration
  useEffect(() => {
    // This runs only on the client after hydration
    document.body.className = "antialiased";
  }, []);

  return (
    <SessionProvider>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </SessionProvider>
  );
}
