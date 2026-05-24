/**
 * 
 * axios-config.js — automatically adds Bearer token to every request
 * 
**/ 

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// if token expired, redirect to login
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/index.html'
    }
    return Promise.reject(error)
  }
)