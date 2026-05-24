/**
 * TaskFlow — Dashboard JS
 * Loads: stats, recent projects, task overview, my tasks, activity feed
 * Handles: new project modal, theme, logout, quick actions
 */

//  Auth & Init 

document.addEventListener('DOMContentLoaded', async () => {
  // Guard
  const token = requireAuth();
  if (!token) return;

  // Populate user info
  const user = getCurrentUser();
  populateUserUI(user);
  // Wire buttons
  wireButtons();

  // Load all dashboard data in parallel
  await loadDashboard();
});




//  User UI 

function decodeToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { name: payload.name, id: payload.id };
  } catch (e) {
    return null;
  }
}

function populateUserUI(user) {
  // if auth.js didn't store a user object, decode it from the JWT
  if (!user || (!user.fullName && !user.name)) {
    user = decodeToken();
  }
  if (!user) return;

  // Sidebar user card
  const nameEl   = document.getElementById('userName');
  const roleEl   = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl)   nameEl.textContent   = user.fullName || user.name || user.username || 'User';
  if (roleEl)   roleEl.textContent   = user.role  || 'Member';
  if (avatarEl) {
    avatarEl.textContent = getInitials(user.fullName || user.name || user.username || 'U');
    avatarEl.style.background = `linear-gradient(135deg, ${stringToColor(user.fullName || user.name || '')}, ${stringToColor((user.fullName || user.name || '') + '1')})`;
  }

  // Welcome banner
  const wName = document.getElementById('welcomeName');
  const wSub  = document.getElementById('welcomeSub');
  const banner = document.getElementById('welcomeBanner');
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const el = banner?.querySelector('.welcome-greeting');
  if (el) el.textContent = `${greeting} 👋`;
  if (wName) wName.textContent = user.fullName || user.name || user.username || 'there';
  if (wSub)  wSub.textContent  = "Here's what's happening with your projects today.";
}


//  Stats 

async function loadDashboard() {
  try {
    // Single call to aggregation endpoint
    const [dashRes, projRes] = await Promise.all([
      axios.get('/api/dashboard'),
      axios.get('/api/projects?limit=5&sort=-createdAt'),
    ]);

    const d = dashRes.data;
    const activeProjects  = d.activeProjects  ?? 0;
    const assignedTasks   = d.assignedTasks   ?? 0;
    const completedTasks  = d.completedTasks  ?? 0;
    const overdueTasks    = d.overdueTasks    ?? 0;
    const inProgressTasks = d.inProgressTasks ?? [];

    // Render stat cards
    renderStats({ activeProjects, assignedTasks, completedTasks, overdueTasks });

    // Render donut
    const todoTasks = assignedTasks - completedTasks - inProgressTasks.length - overdueTasks;
    renderDonut({
      assignedTasks,
      completedTasks,
      inProgressCount: inProgressTasks.length,
      overdueTasks,
      todoTasks: Math.max(0, todoTasks),
    });

    // Render my tasks — fetch all assigned tasks (not just in-progress)
    try {
      const myTasksRes = await axios.get('/api/tasks/my-tasks');
      allMyTasks = Array.isArray(myTasksRes.data) ? myTasksRes.data : [];
    } catch (e) {
      allMyTasks = inProgressTasks; // fallback to dashboard data
    }
    renderTaskList(allMyTasks);

    // Nav badge — pending tasks
    const tc = document.getElementById('taskCount');
    if (tc) tc.textContent = assignedTasks - completedTasks;

    // Load recent projects separately
    const projects = Array.isArray(projRes.data)             ? projRes.data
                   : Array.isArray(projRes.data.projects)    ? projRes.data.projects
                   : Array.isArray(projRes.data.data)        ? projRes.data.data
                   : [];
    renderProjectList(projects);
    const pc = document.getElementById('projectCount');
    if (pc) pc.textContent = projects.length;

    // Load activity feed
    loadActivity();

  } catch (err) {
    console.error('Dashboard error:', err);
    toast.error('Error', 'Could not load dashboard data.');
    renderStatsError();
  }
}

function renderStats({ activeProjects, assignedTasks, completedTasks, overdueTasks }) {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;

  const completionRate = assignedTasks
    ? Math.round((completedTasks / assignedTasks) * 100)
    : 0;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon purple">&#128193;</div>
      <div>
        <div class="stat-value">${activeProjects}</div>
        <div class="stat-label">Active Projects</div>
        <div class="stat-change up">&#8593; currently active</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">&#9989;</div>
      <div>
        <div class="stat-value">${completedTasks}</div>
        <div class="stat-label">Tasks Done</div>
        <div class="stat-change up">&#8593; ${completionRate}% completion</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">&#128203;</div>
      <div>
        <div class="stat-value">${assignedTasks}</div>
        <div class="stat-label">Assigned Tasks</div>
        <div class="stat-change ${assignedTasks - completedTasks > 0 ? 'up' : 'down'}">${assignedTasks - completedTasks} remaining</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon pink">&#9888;</div>
      <div>
        <div class="stat-value">${overdueTasks}</div>
        <div class="stat-label">Overdue</div>
        <div class="stat-change ${overdueTasks > 0 ? 'down' : 'up'}">${overdueTasks > 0 ? 'Needs attention' : 'All on track!'}</div>
      </div>
    </div>
  `;
}

function renderStatsError() {
  const grid = document.getElementById('statsGrid');
  if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128202;</div><h3>Could not load stats</h3></div>';
}

function renderDonut({ assignedTasks, completedTasks, inProgressCount, overdueTasks, todoTasks }) {
  const wrap    = document.getElementById('donutWrap');
  const totalEl = document.getElementById('overviewTotal');
  if (!wrap) return;

  if (totalEl) totalEl.textContent = assignedTasks + ' assigned';

  const safeTotal = assignedTasks || 1;
  const segments  = [
    { label: 'Done',        val: completedTasks,  color: '#43e97b' },
    { label: 'In Progress', val: inProgressCount, color: '#6c63ff' },
    { label: 'Overdue',     val: overdueTasks,    color: '#ff6584' },
    { label: 'To Do',       val: todoTasks,       color: '#e8e6ff' },
  ];

  let deg = 0;
  const conicParts = segments.map(s => {
    const slice = (s.val / safeTotal) * 360;
    const part  = s.color + ' ' + deg + 'deg ' + (deg + slice) + 'deg';
    deg += slice;
    return part;
  }).join(', ');

  const pct = Math.round((completedTasks / safeTotal) * 100);

  wrap.innerHTML =
    '<div class="donut" style="background:conic-gradient(' + conicParts + ');filter:drop-shadow(0 4px 12px rgba(108,99,255,.2))">' +
      '<div class="donut-center">' +
        '<span class="donut-center-val" style="color:var(--accent-1)">' + pct + '%</span>' +
        '<span class="donut-center-label">Done</span>' +
      '</div>' +
    '</div>' +
    '<div class="donut-legend">' +
      segments.map(function(s) {
        return '<div class="legend-item"><div class="legend-dot" style="background:' + s.color + '"></div><span class="legend-label">' + s.label + '</span><span class="legend-val">' + s.val + '</span></div>';
      }).join('') +
    '</div>';
}

// My Tasks (uses inProgressTasks from /api/dashboard)
let allMyTasks = [];
let taskFilter = 'all';

function renderTaskList(tasks) {
  const list = document.getElementById('taskList');
  if (!list) return;

  if (!tasks || !tasks.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127881;</div><h3>All clear!</h3><p>No tasks in progress.</p></div>';
    return;
  }

  const PRIORITY_LABELS = { haute: 'High', moyenne: 'Medium', basse: 'Low' };
  const PRIORITY_CLASS  = { haute: 'high', moyenne: 'medium', basse: 'low' };

  list.innerHTML = tasks.slice(0, 6).map(function(task) {
    const isDone    = task.status === 'terminé';
    const priority  = task.priority || 'moyenne';
    const pLabel    = PRIORITY_LABELS[priority] || priority;
    const pClass    = PRIORITY_CLASS[priority]  || 'medium';
    const deadline  = task.deadline || task.dueDate;
    const dueClass  = isDone ? '' : deadlineClass(deadline);
    const projName  = task.project && (task.project.title || task.project.name) ? (task.project.title || task.project.name) : '';

    return '<div class="task-item" data-id="' + task._id + '">' +
      '<div class="task-check ' + (isDone ? 'checked' : '') + '" onclick="toggleTask(\'' + task._id + '\', this)">' +
        (isDone ? '&#10003;' : '') +
      '</div>' +
      '<div class="task-info">' +
        '<div class="task-name ' + (isDone ? 'done' : '') + '">' + escHtml(task.title || '') + '</div>' +
        '<div class="task-project">' +
          (projName ? '&#128193; ' + escHtml(projName) + ' &middot; ' : '') +
          '<span class="badge badge-' + pClass + '" style="padding:1px 7px;font-size:.65rem">' + pLabel + '</span>' +
        '</div>' +
      '</div>' +
      (deadline ? '<span class="task-due ' + dueClass + '">' + (dueClass === 'overdue' ? '&#9888; ' : '') + formatDate(deadline) + '</span>' : '') +
    '</div>';
  }).join('');
}

function deadlineClass(dateStr) {
  if (!dateStr) return '';
  const diff = new Date(dateStr) - new Date();
  const days = diff / 86400000;
  if (days < 0)  return 'overdue';
  if (days < 1)  return 'today';
  if (days < 3)  return 'soon';
  return '';
}

async function toggleTask(taskId, checkEl) {
  const isDone   = checkEl.classList.contains('checked');
  const newStatus = isDone ? 'à faire' : 'terminé';  // FIX: was 'a faire' / 'termine' (missing accents)
  try {
    await axios.patch('/api/tasks/' + taskId + '/status', { status: newStatus });
    checkEl.classList.toggle('checked');
    checkEl.innerHTML = !isDone ? '&#10003;' : '';
    const nameEl = checkEl.closest('.task-item').querySelector('.task-name');
    if (nameEl) nameEl.classList.toggle('done', !isDone);
    toast.success(!isDone ? 'Task done!' : 'Task reopened', '');
  } catch (err) {
    toast.error('Error', 'Could not update task.');
  }
}

//  Recent Projects 

async function loadRecentProjects() {
  try {
    const res = await axios.get('/api/projects?limit=5&sort=-createdAt');
    const projects = Array.isArray(res.data) ? res.data : Array.isArray(res.data.projects) ? res.data.projects : Array.isArray(res.data.data) ? res.data.data : [];
    renderProjectList(projects);
  } catch (err) {
    console.error('Projects error:', err);
    const list = document.getElementById('projectList');
    if (list) list.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><h3>No projects yet</h3><p>Create your first project!</p></div>';
  }
}

function renderProjectList(projects) {
  const list = document.getElementById('projectList');
  if (!list) return;

  if (!projects.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><h3>No projects yet</h3><p>Click "New Project" to get started.</p></div>';
    return;
  }

  list.innerHTML = projects.map(p => {
    const color    = stringToColor(p.title || p.name || p._id);
    const progress = p.progress ?? calcProgress(p);
    const taskCount = p.taskCount ?? (p.tasks?.length ?? '—');
    const statusClass = getStatusChip(p.status);

    return `
      <div class="project-item" onclick="window.location.href='project.html?id=${p._id}'">
        <div class="project-color" style="background:${color}"></div>
        <div class="project-item-info">
          <div class="project-item-name">${escHtml(p.title || p.name)}</div>
          <div class="project-item-meta">${taskCount} tasks · ${statusClass.label}</div>
        </div>
        <div class="project-item-progress">
          <div class="project-progress-pct">${progress}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%;background:${color}"></div>
          </div>
        </div>
        <span class="status-chip ${statusClass.cls}" style="font-size:.7rem;padding:3px 8px">${statusClass.label}</span>
      </div>
    `;
  }).join('');
}

function calcProgress(project) {
  const tasks = project.tasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter(t => t.status === 'done' || t.completed).length;
  return Math.round((done / tasks.length) * 100);
}

function getStatusChip(status) {
  const map = {
    actif:      { cls: 'chip-active',  label: 'Active'   },
    archivé:    { cls: 'chip-done',    label: 'Archived' },
    'en pause': { cls: 'chip-pending', label: 'On Hold'  },
    planning:   { cls: 'chip-pending', label: 'Planning' },
    active:     { cls: 'chip-active',  label: 'Active'   },
  };
  return map[status] || { cls: 'chip-active', label: 'Active' };
}


//  Task Overview Donut 



// Filter link
document.getElementById('filterTasks')?.addEventListener('click', () => {
  const filters = ['all', 'overdue', 'today'];
  const idx = filters.indexOf(taskFilter);
  taskFilter = filters[(idx + 1) % filters.length];
  document.getElementById('filterTasks').textContent = taskFilter.charAt(0).toUpperCase() + taskFilter.slice(1);

  let filtered = allMyTasks;
  if (taskFilter === 'overdue') filtered = allMyTasks.filter(t => deadlineClass(t.deadline) === 'overdue');
  if (taskFilter === 'today')   filtered = allMyTasks.filter(t => deadlineClass(t.deadline) === 'today');
  renderTaskList(filtered);
});


//  Activity Feed 

async function loadActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  try {
    const res = await axios.get('/api/notifications?limit=8');
    const items = Array.isArray(res.data) ? res.data : Array.isArray(res.data.notifications) ? res.data.notifications : Array.isArray(res.data.data) ? res.data.data : [];
    renderActivity(items);
  } catch (err) {
    // Fallback: show empty state
    feed.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No recent activity</h3></div>';
  }
}

function renderActivity(items) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  if (!items.length) {
    feed.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No recent activity</h3></div>';
    return;
  }

  const iconMap = {
    task_created:    { icon: '➕', bg: 'rgba(67,233,123,.15)' },
    task_completed:  { icon: '✅', bg: 'rgba(108,99,255,.15)' },
    task_updated:    { icon: '✏️', bg: 'rgba(247,151,30,.15)' },
    project_created: { icon: '📁', bg: 'rgba(108,99,255,.15)' },
    project_updated: { icon: '📝', bg: 'rgba(247,151,30,.15)' },
    member_added:    { icon: '👥', bg: 'rgba(67,233,123,.15)'  },
    comment_added:   { icon: '💬', bg: 'rgba(255,101,132,.15)' },
  };

  feed.innerHTML = items.map(item => {
    const style = iconMap[item.type] || { icon: '🔔', bg: 'rgba(108,99,255,.12)' };
    const msg   = item.message || item.title || 'Something happened';

    return `
      <div class="activity-item">
        <div class="activity-dot-wrap">
          <div class="activity-dot" style="background:${style.bg}">${style.icon}</div>
        </div>
        <div class="activity-content">
          <div class="activity-text">${escHtml(msg)}</div>
          <div class="activity-time">${relativeTime(item.createdAt)}</div>
        </div>
      </div>
    `;
  }).join('');
}


//  New Project Modal 

function openNewProjectModal() {
  openModal('newProjectModal');
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const npStart = document.getElementById('npStart');
  if (npStart && !npStart.value) npStart.value = today;
}

document.getElementById('createProjectBtn')?.addEventListener('click', async () => {
  const name     = document.getElementById('npName')?.value.trim();
  const desc     = document.getElementById('npDesc')?.value.trim();
  const startDate = document.getElementById('npStart')?.value;
  const endDate   = document.getElementById('npEnd')?.value;
  const priority  = document.getElementById('npPriority')?.value;

  if (!name) {
    toast.warning('Name required', 'Please enter a project name.');
    document.getElementById('npName')?.focus();
    return;
  }

  const btn = document.getElementById('createProjectBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const res = await axios.post('/api/projects', { title: name, description: desc, startDate, endDate, priority });
    const project = res.data.project || res.data;

    toast.success('Project created! 🎉', `"${name}" is ready.`);
    closeModal('newProjectModal');

    // Reset form
    ['npName','npDesc','npStart','npEnd'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Redirect to new project page
    setTimeout(() => {
      window.location.href = `project.html?id=${project._id}`;
    }, 800);

  } catch (err) {
    const msg = err.response?.data?.message || 'Could not create project.';
    toast.error('Error', msg);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Project';
  }
});


//  Wire Buttons 

function wireButtons() {
  // New project buttons
  document.getElementById('newProjectBtn')?.addEventListener('click',    openNewProjectModal);
  document.getElementById('bannerNewProject')?.addEventListener('click', openNewProjectModal);
  document.getElementById('qaNewProject')?.addEventListener('click',     openNewProjectModal);

  // Quick action: New task → go to projects page
  document.getElementById('qaNewTask')?.addEventListener('click', () => {
    window.location.href = 'projects.html';
  });

  // Invite
  document.getElementById('qaInvite')?.addEventListener('click', () => {
    toast.info('Coming soon!', 'Team invitations will be available soon.');
  });

  // Report
  document.getElementById('qaReport')?.addEventListener('click', () => {
    toast.info('Coming soon!', 'Reports are in progress.');
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) logout();
  });

  // Global search (future)
  document.getElementById('globalSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) window.location.href = `projects.html?q=${encodeURIComponent(q)}`;
    }
  });
}


//  Utility 

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}