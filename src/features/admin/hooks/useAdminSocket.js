import { useEffect, useRef, useCallback, useState } from "react";

export function useAdminWS(onNewOrder) {
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryCount = useRef(0);
  const [connected, setConnected] = useState(false);
  const isUnmounting = useRef(false);

  const connect = useCallback(() => {
    const WS_BASE = (
      import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000"
    ).replace(/\/$/, "");

    const token = localStorage.getItem("access_token");
    const url = `${WS_BASE}/ws/admin/notifications/?token=${token || ""}`;

    console.log("🔌 Connecting:", url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Connected");
        setConnected(true);
        retryCount.current = 0;
        clearTimeout(retryRef.current);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_order") {
            onNewOrder(data);
          }
        } catch (err) {
          console.error("❌ Parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("⚠️ WS error:", err);
      };

      ws.onclose = (e) => {
        console.log("❌ Closed:", e.code);
        setConnected(false);

        // 🛑 Stop reconnect if component unmounted
        if (isUnmounting.current) return;

        // 🛑 Stop reconnect on normal close
        if (e.code === 1000) return;

        // 🔁 Reconnect only on real failures
        const delay = Math.min(2000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;

        retryRef.current = setTimeout(connect, delay);
      };
    } catch (err) {
      console.error("❌ Connection failed:", err);
    }
  }, [onNewOrder]);

  useEffect(() => {
    isUnmounting.current = false;
    connect();

    return () => {
      isUnmounting.current = true;
      clearTimeout(retryRef.current);

      if (wsRef.current) {
        wsRef.current.onclose = null; // 🚨 prevents loop
        wsRef.current.close(1000, "Unmount");
      }
    };
  }, [connect]);

  return connected;
}