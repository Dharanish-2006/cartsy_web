import { useEffect } from 'react'
import { useNotificationStore } from '../../../store/notificationStore'
import toast from 'react-hot-toast'

const WS_URL = `${import.meta.env.VITE_WS_URL}/ws/admin/notifications/`

export function useAdminSocket() {
  const addNotification = useNotificationStore(s => s.add)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'new_order') {
        addNotification(data)
        toast.success(`New order #${data.order_id} — ₹${data.amount}`, {
          duration: 6000,
          icon: '🛒',
        })
        new Audio('/notification.mp3').play().catch(() => {})
      }
    }

    ws.onerror = () => console.error('Admin WS error')

    return () => ws.close()
  }, [])
}