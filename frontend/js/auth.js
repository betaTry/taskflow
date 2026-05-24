/**
 *
 * auth.js — handles token storage, login, register, logout
 *  
**/ 

const API = 'http://localhost:3000/api'

//  TOKEN MANAGEMENT 
function saveToken(token) {
  localStorage.setItem('token', token)
}

function getToken() {
  return localStorage.getItem('token')
}

function removeToken() {
  localStorage.removeItem('token')
}

function isLoggedIn() {
  return getToken() !== null
}

//  REDIRECT IF NOT LOGGED IN 
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html'
  }
}

//  LOGOUT 
function logout() {
  removeToken()
  window.location.href = '/index.html'
}

//  REGISTER 
async function register(fullName, email, password) {
  try {
    const res = await axios.post(`${API}/auth/register`, { fullName, email, password })
    return res.data
  } catch (err) {
    throw err.response.data
  }
}

//  LOGIN 
async function login(email, password) {
  try {
    const res = await axios.post(`${API}/auth/login`, { email, password })
    saveToken(res.data.token)
    return res.data
  } catch (err) {
    throw err.response.data
  }
}