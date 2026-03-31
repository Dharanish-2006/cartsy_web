import { api } from '../utils/api'


export const productService = {
  list: () => api.get('/api/home/').then(r => r.data),
  get: (id) => api.get(`/api/products/${id}/`).then(r => r.data),
}


export const cartService = {
  get: () => api.get('/api/cart/').then(r => r.data),
  add: (productId, quantity = 1) =>
    api.post('/api/cart/', { product_id: productId, quantity }).then(r => r.data),
  update: (itemId, action) =>
    api.post('/api/cart/update/', { item_id: itemId, action }).then(r => r.data),
}


export const orderService = {
  list: () => api.get('/api/orders/').then(r => r.data),

  createCOD: (shippingForm) =>
    api.post('/api/orders/create/', { ...shippingForm, payment_method: 'COD' }).then(r => r.data),

  createRazorpay: (shippingForm) =>
    api.post('/api/orders/razorpay/', shippingForm).then(r => r.data),

  verifyRazorpay: (payload) =>
    api.post('/api/orders/razorpay/verify/', payload).then(r => r.data),
}


export const authService = {
  signup: (form) => api.post('/api/signup/', form).then(r => r.data),
  login: (form) => api.post('/api/login/', form).then(r => r.data),
  verifyOTP: (email, otp) => api.post('/api/verify-otp/', { email, otp }).then(r => r.data),
}