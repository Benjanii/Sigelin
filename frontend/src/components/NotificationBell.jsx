// frontend/src/components/NotificationBell.jsx
import { useEffect, useRef, useState } from "react";
import { getPendingPurchases } from "../api";
import { useNavigate } from "react-router-dom";

/**
 * Campanita de notificaciones para DIRECTOR.
 * Hace polling cada 10s a /purchases?status=PENDING
 * y muestra un badge con la cantidad.
 */
export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const audioRef = useRef(null);
  const prevCountRef = useRef(0);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    let interval = 5000; // 5s
    const poll = async () => {
      try {
        const list = await getPendingPurchases();
        const newCount = Array.isArray(list) ? list.length : (list?.total ?? 0);
        if (!alive) return;

        // si sube el número, reproducir un "ping" opcional
        if (newCount > prevCountRef.current && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
        prevCountRef.current = newCount;
        setCount(newCount);
        interval = 5000; // estable al OK
      } catch {
        interval = Math.min(interval * 2, 60000); // backoff hasta 60s
      } finally {
        if (alive) setTimeout(poll, interval);
      }
    };
    poll();
    return () => { alive = false; };
  }, []);

  return (
    <div className="relative">
      <button title="Solicitudes de compra pendientes" className="p-2" onClick={()=>nav('/approvals')}>
        <span className="material-icons">notifications</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5">
            {count}
          </span>
        )}
      </button>
      <audio ref={audioRef} src="/sounds/ping.mp3" preload="auto" />
    </div>
  );
}
