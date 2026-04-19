import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  add: (notif) => set(s => ({
    notifications: [notif, ...s.notifications],
    unreadCount: s.unreadCount + 1,
  })),

  markAllRead: () => set({ unreadCount: 0 }),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}))