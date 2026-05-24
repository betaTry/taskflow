/**
 * TaskFlow — Notifications & Toast System
 * Handles:
 *  - Toast messages (success / error / info / warning)
 *  - Notification bell badge
 *  - Polling every 30s via setInterval
 *  - Mark as read via PATCH /api/notifications/:id/read
 *  - Read notifications archived in localStorage
 */


// Toast

var TOAST_COLORS = { success: 'var(--accent-3)', error: 'var(--accent-2)', warning: 'var(--accent-4)', info: 'var(--accent-1)' };
var TOAST_ICONS  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

function showToast(title, message, type, duration) {
  message  = message  || '';
  type     = type     || 'info';
  duration = duration || 4000;
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span class="toast-icon" style="color:' + TOAST_COLORS[type] + '">' + TOAST_ICONS[type] + '</span><div class="toast-body"><div class="toast-title">' + title + '</div>' + (message ? '<div class="toast-msg">' + message + '</div>' : '') + '</div><button class="toast-close" onclick="dismissToast(this.parentElement)">✕</button>';
  container.appendChild(el);
  setTimeout(function() { dismissToast(el); }, duration);
}

function dismissToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(function() { if (el.parentElement) el.remove(); }, 300);
}

var toast = {
  success: function(t, m, d) { showToast(t, m, 'success', d); },
  error:   function(t, m, d) { showToast(t, m, 'error',   d); },
  warning: function(t, m, d) { showToast(t, m, 'warning', d); },
  info:    function(t, m, d) { showToast(t, m, 'info',    d); },
};

// Notification State

var _notifInMemory   = [];
var _pollingInterval = null;
var POLLING_MS       = 30000;
var LS_ARCHIVE_KEY   = 'tf-notif-archive';

// Badge

function updateNotifBadge(count) {
  var badge = document.getElementById('notifBadge');
  var dot   = document.getElementById('notifDot');
  if (badge) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
  if (dot)   { dot.style.display = count > 0 ? 'block' : 'none'; }
}

// Fetch Notifications

async function fetchNotifications() {
  try {
    var res = await axios.get('/api/notifications');
    var data = res.data;
    var all = Array.isArray(data) ? data : Array.isArray(data.notifications) ? data.notifications : Array.isArray(data.data) ? data.data : [];

    var unread = all.filter(function(n) { return !n.read; });
    var read   = all.filter(function(n) { return  n.read; });

    // Show toast for brand new notifications
    var existingIds = _notifInMemory.map(function(n) { return n._id; });
    var brandNew    = unread.filter(function(n) { return existingIds.indexOf(n._id) === -1; });
    if (_notifInMemory.length > 0 && brandNew.length > 0) {
      brandNew.forEach(function(n) { showToast('New notification', n.message, 'info', 5000); });
    }

    _notifInMemory = unread;
    archiveReadNotifications(read);
    updateNotifBadge(unread.length);
    return unread;
  } catch (err) {
    console.warn('Notification fetch failed:', err && err.message ? err.message : '');
    return [];
  }
}

// Mark As Read

async function markAsRead(notifId) {
  try {
    await axios.patch('/api/notifications/' + notifId + '/read');
    var notif = _notifInMemory.find(function(n) { return n._id === notifId; });
    if (notif) {
      notif.read     = true;
      _notifInMemory = _notifInMemory.filter(function(n) { return n._id !== notifId; });
      archiveReadNotifications([notif]);
    }
    updateNotifBadge(_notifInMemory.length);
    return true;
  } catch (err) { return false; }
}

async function markAllNotifsRead() {
  try {
    await Promise.all(_notifInMemory.map(function(n) { return axios.patch('/api/notifications/' + n._id + '/read'); }));
    archiveReadNotifications(_notifInMemory.map(function(n) { return Object.assign({}, n, { read: true }); }));
    _notifInMemory = [];
    updateNotifBadge(0);
    toast.success('All caught up!', 'All notifications marked as read.');
  } catch (err) { toast.error('Error', 'Could not mark all as read.'); }
}

// localStorage Archive

function archiveReadNotifications(readNotifs) {
  if (!readNotifs || !readNotifs.length) return;
  try {
    var existing    = getArchivedNotifications();
    var existingIds = existing.map(function(n) { return n._id; });
    var toAdd       = readNotifs.filter(function(n) { return existingIds.indexOf(n._id) === -1; });
    var merged      = toAdd.concat(existing).slice(0, 50);
    localStorage.setItem(LS_ARCHIVE_KEY, JSON.stringify(merged));
  } catch (e) { console.warn('Archive failed:', e); }
}

function getArchivedNotifications() {
  try { return JSON.parse(localStorage.getItem(LS_ARCHIVE_KEY) || '[]'); }
  catch (e) { return []; }
}

function clearArchivedNotifications() { localStorage.removeItem(LS_ARCHIVE_KEY); }

// Polling

function startNotifPolling() {
  fetchNotifications();
  _pollingInterval = setInterval(fetchNotifications, POLLING_MS);
}

function stopNotifPolling() {
  if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
}

// Pause polling when tab hidden, resume when visible
document.addEventListener('visibilitychange', function() {
  if (document.hidden) { stopNotifPolling(); } else { if (localStorage.getItem('token')) startNotifPolling(); }
});

// Theme

function initTheme() {
  var saved = localStorage.getItem('tf-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tf-theme', next);
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  var btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = theme === 'dark' ? '&#9728;' : '&#127769;';
}

// Sidebar Toggle

function initSidebarToggle() {
  var toggle  = document.getElementById('sidebarToggle');
  var sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', function() { sidebar.classList.toggle('open'); });
  document.addEventListener('click', function(e) {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) sidebar.classList.remove('open');
  });
}

// Modal Helpers

function openModal(id)  { var el = document.getElementById(id); if (el) el.classList.add('open');    }
function closeModal(id) { var el = document.getElementById(id); if (el) el.classList.remove('open'); }

// Auth Helpers

function requireAuth() {
  var token = localStorage.getItem('token');
  if (!token) { window.location.href = 'index.html'; return null; }
  return token;
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; }
}

function logout() {
  stopNotifPolling();
  clearArchivedNotifications();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// Date Helpers

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  var diff = Date.now() - new Date(dateStr).getTime();
  var m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h / 24);
  if (d < 7)  return d + 'd ago';
  return formatDate(dateStr);
}

function dueDateClass(dateStr) {
  if (!dateStr) return '';
  var days = (new Date(dateStr) - new Date()) / 86400000;
  if (days < 0) return 'overdue';
  if (days < 1) return 'today';
  if (days < 3) return 'soon';
  return '';
}

function stringToColor(str) {
  var colors = ['#6c63ff','#ff6584','#43e97b','#f7971e','#38b2ac','#ed64a6','#667eea','#f6ad55'];
  var hash = 0; str = str || '';
  for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  return (name || '').split(' ').map(function(w) { return w[0] || ''; }).join('').toUpperCase().slice(0, 2) || '?';
}

// Boot

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-close]').forEach(function(btn) {
    btn.addEventListener('click', function() { closeModal(btn.dataset.close); });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.classList.remove('open'); });
  });
  initTheme();
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  initSidebarToggle();
  if (localStorage.getItem('token')) startNotifPolling();
});

// Notification Dropdown (bell icon in topbar)

function initNotifDropdown() {
  var btn = document.getElementById('notifBtn');
  if (!btn) return;

  // Create dropdown element
  var dropdown = document.createElement('div');
  dropdown.id = 'notifDropdown';
  dropdown.style.cssText = [
    'position:fixed',
    'top:64px',
    'right:16px',
    'width:340px',
    'max-height:420px',
    'background:var(--bg-card)',
    'border:1.5px solid var(--border)',
    'border-radius:16px',
    'box-shadow:var(--shadow-lg)',
    'z-index:999',
    'display:none',
    'flex-direction:column',
    'overflow:hidden',
  ].join(';');

  dropdown.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)">' +
      '<span style="font-family:Syne,sans-serif;font-weight:700;font-size:.95rem">Notifications</span>' +
      '<div style="display:flex;gap:6px">' +
        '<button onclick="markAllNotifsRead();renderDropdown()" style="font-size:.75rem;color:var(--accent-1);font-weight:600;background:none;border:none;cursor:pointer;padding:3px 8px;border-radius:6px" onmouseover="this.style.background=\'rgba(108,99,255,.1)\'" onmouseout="this.style.background=\'none\'">Mark all read</button>' +
        '<a href="notifications.html" style="font-size:.75rem;color:var(--text-muted);font-weight:600;padding:3px 8px;border-radius:6px;text-decoration:none" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'none\'">View all</a>' +
      '</div>' +
    '</div>' +
    '<div id="dropdownList" style="overflow-y:auto;max-height:340px;padding:8px"></div>';

  document.body.appendChild(dropdown);

  // Toggle on bell click
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = dropdown.style.display === 'flex';
    dropdown.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) renderDropdown();
  });

  // Close on outside click
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.style.display = 'none';
    }
  });
}

function renderDropdown() {
  var list = document.getElementById('dropdownList');
  if (!list) return;

  var notifs = _notifInMemory;

  if (!notifs.length) {
    list.innerHTML =
      '<div style="text-align:center;padding:32px 16px;color:var(--text-muted)">' +
        '<div style="font-size:2rem;margin-bottom:8px">&#128276;</div>' +
        '<div style="font-size:.85rem">All caught up!</div>' +
      '</div>';
    return;
  }

  list.innerHTML = notifs.slice(0, 8).map(function(n) {
    return '<div style="display:flex;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .15s;align-items:flex-start" ' +
      'onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'none\'" ' +
      'onclick="handleDropdownRead(\'' + n._id + '\')">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent-1);flex-shrink:0;margin-top:6px"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:.83rem;font-weight:500;line-height:1.4">' + escHtmlDropdown(n.message) + '</div>' +
        '<div style="font-size:.72rem;color:var(--text-muted);margin-top:3px">' + relativeTime(n.createdAt) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function handleDropdownRead(id) {
  await markAsRead(id);
  renderDropdown();
}

function escHtmlDropdown(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Init dropdown on page load
document.addEventListener('DOMContentLoaded', function() {
  initNotifDropdown();
});