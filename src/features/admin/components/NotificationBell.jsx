import { Bell } from 'lucide-react'
import { useNotificationStore } from '../../../store/notificationStore'
import { useState } from 'react'

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotificationStore()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); markAllRead() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: 'var(--text)' }}>
        <Bell size={22} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: 'var(--accent)', color: 'white',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 36,
          width: 320, background: 'var(--bg-2)',
          border: '1px solid var(--border)', borderRadius: 12,
          zIndex: 200, maxHeight: 400, overflowY: 'auto'
        }}>
          {notifications.length === 0
            ? <p style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No notifications</p>
            : notifications.map((n, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Order #{n.order_id}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {n.customer} — ₹{n.amount}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}