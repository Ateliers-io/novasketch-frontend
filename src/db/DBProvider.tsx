import { useEffect, useState } from "react";
import { db } from "./index";
import { syncService } from "../services/sync.service";

export function DBProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await db.open();
        setReady(true);
        // Process any pending sync operations once DB is ready
        syncService.processQueue();
      } catch (err) {
        console.error("DB init failed:", err);
      }
    }

    init();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Initializing database...
      </div>
    );
  }

  return <>{children}</>;
}
