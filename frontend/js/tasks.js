/**
 * TaskFlow — My Tasks JS
 * Uses French status/priority values matching the backend schema:
 *   status:   'à faire' | 'en cours' | 'terminé'
 *   priority: 'basse'   | 'moyenne'  | 'haute'
 * Endpoint: GET /api/tasks/my-tasks
 *           PATCH /api/tasks/:id/status
 */

//  State 

let allTasks      = [];
let searchQuery   = '';
let priorityFilter = 'all';
let projectFilter  = 'all';

const COLUMNS = [
  {
    id:         'à faire',
    label:      'To Do',
    dot:        '#7b78a8',
    countBg:    'rgba(123,120,168,.12)',
    countColor: '#7b78a8',
    emptyMsg:   'No tasks to do',
  },
  {
    id:         'en cours',
    label:      'In Progress',
    dot:        '#6c63ff',
    countBg:    'rgba(108,99,255,.12)',
    countColor: '#6c63ff',
    emptyMsg:   'Nothing in progress',
  },
  {
    id:         'terminé',
    label:      'Done',
    dot:        '#43e97b',
    countBg:    'rgba(67,233,123,.12)',
    countColor: '#2cb96a',
    emptyMsg:   'No completed tasks yet',
  },
];

const PRIORITY_MAP = {
  haute:   { label: 'High',   color: '#ff6584', bg: 'rgba(255,101,132,.12)' },
  moyenne: { label: 'Medium', color: '#f7971e', bg: 'rgba(247,151,30,.12)'  },
  basse:   { label: 'Low',    color: '#43e97b', bg: 'rgba(67,233,123,.12)'  },
};

//  Init 

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  populateUserUI(getCurrentUser());
  wireButtons();
  await loadTasks();
});

//  User UI 

// no 'user' key in localStorage — decode name directly from the JWT payload
function decodeToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { name: payload.name || payload.fullName, id: payload.id || payload._id };
  } catch (e) { return null; }
}

function populateUserUI(user) {
  // Fallback to JWT when getCurrentUser() returns null
  if (!user || (!user.fullName && !user.name)) {
    user = decodeToken();
  }
  if (!user) return;

  const n = document.getElementById('userName');
  const r = document.getElementById('userRole');
  const a = document.getElementById('userAvatar');
  const name = user.fullName || user.name || user.username || 'User';
  if (n) n.textContent = name;
  if (r) r.textContent = user.role || 'Member';
  if (a) {
    a.textContent = getInitials(name);
    a.style.background = `linear-gradient(135deg, ${stringToColor(name)}, ${stringToColor(name + '1')})`;
  }
}

//  Load Tasks 

async function loadTasks() {
  try {
    const [myRes, dashRes] = await Promise.all([
      axios.get('/api/tasks/my-tasks').catch(() => ({ data: [] })),
      axios.get('/api/dashboard').catch(() => ({ data: {} })),
    ]);

    const myTasks = Array.isArray(myRes.data)       ? myRes.data
                  : Array.isArray(myRes.data.tasks)  ? myRes.data.tasks
                  : [];

    const dashData = dashRes.data || {};
    const inProg   = Array.isArray(dashData.inProgressTasks) ? dashData.inProgressTasks : [];

    // Merge, deduplicate by _id
    const seen     = new Set();
    const combined = [];
    [...myTasks, ...inProg].forEach(t => {
      if (!seen.has(t._id)) { seen.add(t._id); combined.push(t); }
    });

    allTasks = combined;

    buildProjectFilter();
    updateStats();
    renderBoard();
    updateNavBadges();

    const total   = allTasks.length;
    const pending = allTasks.filter(t => t.status !== 'terminé').length;

    const sub = document.getElementById('pageSubtitle');
    if (sub) sub.textContent = `${total} task${total !== 1 ? 's' : ''} assigned to you`;

    const badge = document.getElementById('pendingCount');
    if (badge) badge.textContent = pending;

  } catch (err) {
    console.error('Load tasks error:', err);
    toast.error('Error', 'Could not load your tasks.');
    const board = document.getElementById('kanbanBoard');
    if (board) board.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">&#9888;</div><h3>Could not load tasks</h3></div>';
  }
}

// ── Build Project Filter ──────────────────────────────────────────────────────

function buildProjectFilter() {
  const container = document.getElementById('projectFilter');
  if (!container) return;

  const projects = [];
  const seen = new Set();
  allTasks.forEach(t => {
    const proj = t.project;
    if (!proj) return;
    const id = proj._id || proj;
    if (!seen.has(String(id))) {
      seen.add(String(id));
      projects.push({ id: String(id), name: proj.title || proj.name || 'Unnamed' });
    }
  });

  if (!projects.length) return;

  container.innerHTML =
    `<div class="filter-chip active" data-proj="all">All Projects</div>` +
    projects.map(p =>
      `<div class="filter-chip" data-proj="${p.id}">${escHtml(p.name)}</div>`
    ).join('');

  container.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    projectFilter = chip.dataset.proj;
    renderBoard();
  });
}

//  Stats 

function updateStats() {
  // FIX: 'à faire' check also covers null/undefined status
  const todo       = allTasks.filter(t => !t.status || t.status === 'à faire').length;
  const inProgress = allTasks.filter(t => t.status === 'en cours').length;
  const done       = allTasks.filter(t => t.status === 'terminé').length;
  const overdue    = allTasks.filter(t => {
    const dl = t.deadline || t.dueDate;
    return dl && new Date(dl) < new Date() && t.status !== 'terminé';
  }).length;

  setText('statTodo',       todo);
  setText('statInProgress', inProgress);
  setText('statDone',       done);
  setText('statOverdue',    overdue);
}

//  Filter 

function getFilteredTasks() {
  let list = [...allTasks];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }

  if (priorityFilter !== 'all') {
    list = list.filter(t => t.priority === priorityFilter);
  }

  if (projectFilter !== 'all') {
    list = list.filter(t => {
      const id = t.project?._id || t.project;
      return String(id) === projectFilter;
    });
  }

  // Sort: haute first, then by deadline
  const priorityOrder = { haute: 0, moyenne: 1, basse: 2 };
  list.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return list;
}

// ── Render Board ──────────────────────────────────────────────────────────────

function renderBoard() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  board.innerHTML = COLUMNS.map(col => renderColumn(col)).join('');
}

function renderColumn(col) {
  const filtered = getFilteredTasks();

  // FIX: normalise status — DB has both 'à faire' and 'a faire' (written by old buggy toggleTask)
  const norm = s => (s || '').normalize('NFC').trim();
  const colTasks = filtered.filter(t => {
    const s = norm(t.status);
    if (col.id === 'à faire') return !t.status || s === 'à faire' || s === 'a faire';
    if (col.id === 'terminé')  return s === 'terminé'  || s === 'termine';
    return s === col.id;
  });

  const tasksHTML = colTasks.length
    ? colTasks.map(t => taskCardHTML(t, col.id)).join('')
    : `<div class="col-empty">
         <div class="col-empty-icon">&#128203;</div>
         <div>${col.emptyMsg}</div>
       </div>`;

  return `
    <div class="kanban-col">
      <div class="col-header">
        <div class="col-dot" style="background:${col.dot}"></div>
        <div class="col-title">${col.label}</div>
        <span class="col-count" style="background:${col.countBg};color:${col.countColor}">${colTasks.length}</span>
      </div>
      <div class="col-tasks">${tasksHTML}</div>
    </div>
  `;
}

//  Task Card 

function taskCardHTML(task, currentStatus) {
  const priority    = task.priority || 'moyenne';
  const pInfo       = PRIORITY_MAP[priority] || PRIORITY_MAP.moyenne;
  const projectName = task.project?.title || task.project?.name || '';
  const isDone      = currentStatus === 'terminé';

  // Deadline chip
  let deadlineHTML = '';
  const dl = task.deadline || task.dueDate;
  if (dl) {
    const diff = new Date(dl) - new Date();
    const days = diff / 86400000;
    let cls = 'dl-normal', icon = '&#128197;';
    if (!isDone) {
      if (days < 0)       { cls = 'dl-overdue'; icon = '&#9888;'; }
      else if (days < 1)  { cls = 'dl-today';   icon = '&#128197;'; }
      else if (days < 3)  { cls = 'dl-soon';    icon = '&#128197;'; }
    }
    deadlineHTML = `<span class="deadline-chip ${cls}">${icon} ${formatDate(dl)}</span>`;
  }

  // Move buttons — columns other than the current one
  const moveBtns = COLUMNS
    .filter(c => c.id !== currentStatus)
    .map(c => `
      <button class="move-btn" onclick="moveTask(event, '${task._id}', '${c.id}')">
        ${c.label}
      </button>
    `).join('');

  return `
    <div class="task-card" id="tc-${task._id}">
      <div class="task-card-title ${isDone ? 'done' : ''}">${escHtml(task.title)}</div>
      ${projectName ? `<div class="task-card-project">&#128193; ${escHtml(projectName)}</div>` : ''}
      ${task.description
        ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(task.description)}</div>`
        : ''}
      <div class="task-card-footer">
        <span style="background:${pInfo.bg};color:${pInfo.color};padding:2px 9px;border-radius:6px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px">
          ${pInfo.label}
        </span>
        ${deadlineHTML}
      </div>
      <div class="move-btns">${moveBtns}</div>
    </div>
  `;
}

//  Move Task 

async function moveTask(e, taskId, newStatus) {
  e.stopPropagation();

  const task = allTasks.find(t => t._id === taskId);
  if (!task) return;

  const oldStatus = task.status;
  task.status = newStatus; // optimistic update
  renderBoard();
  updateStats();

  try {
    await axios.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
    const labels = { 'à faire': 'To Do', 'en cours': 'In Progress', 'terminé': 'Done' };
    toast.success(
      newStatus === 'terminé' ? 'Task done! 🎉' : 'Task moved',
      `Moved to ${labels[newStatus]}`
    );
  } catch (err) {
    task.status = oldStatus; // revert on failure
    renderBoard();
    updateStats();
    toast.error('Error', err.response?.data?.message || 'Could not update task status.');
  }
}

//  Nav Badges 

async function updateNavBadges() {
  // Task count — already loaded
  const tc = document.getElementById('taskCount');
  if (tc) tc.textContent = allTasks.length;

  // Project count — quick fetch
  const pc = document.getElementById('projectCount');
  if (!pc) return;
  try {
    const res = await axios.get('/api/projects');
    const projects = Array.isArray(res.data)          ? res.data
                   : Array.isArray(res.data.projects) ? res.data.projects
                   : Array.isArray(res.data.data)     ? res.data.data
                   : [];
    pc.textContent = projects.length;
  } catch {
    pc.textContent = '—';
  }
}

//  Wire Buttons 

function wireButtons() {
  document.getElementById('searchInput')?.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderBoard();
  });

  document.getElementById('priorityFilter')?.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('#priorityFilter .filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    priorityFilter = chip.dataset.p;
    renderBoard();
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) logout();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Defined locally — tasks.html may not load the shared utils that contain this
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}