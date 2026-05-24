/**
 * TaskFlow — Projects JS
 * Features: fetch all projects, search, filter by status, sort,
 *           grid/list toggle, create, edit, delete
 */

//  State 

let allProjects  = [];
let activeFilter = 'all';
let activeSort   = 'newest';
let activeView   = 'grid';
let searchQuery  = '';
let editingId    = null;
let deletingId   = null;

// tasksByProject[projectId] = { total, completed }
let tasksByProject = {};

const PROJECT_EMOJIS = ['📁','🚀','🎯','💡','🛠️','🌐','📱','🎨','📊','🔬','🏗️','⚡'];

//  Init 

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  populateUserUI(getCurrentUser());
  wireButtons();

  const urlQ = new URLSearchParams(window.location.search).get('q');
  if (urlQ) {
    searchQuery = urlQ;
    const si = document.getElementById('searchInput');
    if (si) si.value = urlQ;
  }

  await loadProjects();
});

//  User UI 

function decodeToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { name: payload.name || payload.fullName, id: payload.id || payload._id };
  } catch (e) { return null; }
}

function populateUserUI(user) {
  if (!user || (!user.fullName && !user.name)) user = decodeToken();
  if (!user) return;
  const nameEl   = document.getElementById('userName');
  const roleEl   = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');
  const name     = user.fullName || user.name || user.username || 'User';
  if (nameEl)   nameEl.textContent = name;
  if (roleEl)   roleEl.textContent = user.role || 'Member';
  if (avatarEl) {
    avatarEl.textContent = getInitials(name);
    avatarEl.style.background = `linear-gradient(135deg, ${stringToColor(name)}, ${stringToColor(name + '1')})`;
  }
}

//  Load Projects 

async function loadProjects() {
  try {
    const [projRes, tasksRes] = await Promise.all([
      axios.get('/api/projects?limit=100'),
      axios.get('/api/tasks/my-tasks').catch(() => ({ data: [] }))
    ]);

    allProjects = Array.isArray(projRes.data)          ? projRes.data
                : Array.isArray(projRes.data.projects) ? projRes.data.projects
                : Array.isArray(projRes.data.data)     ? projRes.data.data
                : [];

    const raw      = tasksRes.data;
    const allTasks = Array.isArray(raw)      ? raw
                   : Array.isArray(raw.data) ? raw.data
                   : [];

    tasksByProject = {};
    allTasks.forEach(t => {
      let pid = '';
      if (t.project && typeof t.project === 'object') {
        pid = String(t.project._id || t.project.id || '');
      } else if (t.project) {
        pid = String(t.project);
      }
      if (!pid) return;
      if (!tasksByProject[pid]) tasksByProject[pid] = { total: 0, completed: 0 };
      tasksByProject[pid].total++;
      if (t.status === 'terminé' || t.status === 'termine') {
        tasksByProject[pid].completed++;
      }
    });

    updateStats();
    renderProjects();

    const tc = document.getElementById('taskCount');
    if (tc) tc.textContent = allTasks.length;

  } catch (err) {
    console.error('Load projects error:', err);
    toast.error('Error', 'Could not load projects.');
  }
}

//  Stats Chips 

function updateStats() {
  const total  = allProjects.length;
  const active = allProjects.filter(p => p.status === 'actif').length;
  const onHold = allProjects.filter(p => p.status === 'en pause').length;
  const done   = allProjects.filter(p => p.status === 'archivé').length;

  setText('statAll',         `${total} Total`);
  setText('statActive',      `${active} Active`);
  setText('statPlanning',    `${onHold} On Hold`);
  setText('statDone',        `${done} Completed`);
  setText('projectCount',    total);
  setText('projectSubtitle', `${total} project${total !== 1 ? 's' : ''} in your workspace`);
}

//  Filter + Sort + Search 

function getFilteredProjects() {
  let list = [...allProjects];
  const filterMap = {
    'active':   'actif',
    'actif':    'actif',
    'on-hold':  'en pause',
    'onhold':   'en pause',
    'en pause': 'en pause',
    'done':     'archivé',
    'archived': 'archivé',
    'archivé':  'archivé',
  };

  if (activeFilter !== 'all') {
    const mapped = filterMap[activeFilter] || activeFilter;
    list = list.filter(p => p.status === mapped);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      (p.title || p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    if (activeSort === 'newest')   return new Date(b.createdAt) - new Date(a.createdAt);
    if (activeSort === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt);
    if (activeSort === 'name')     return (a.title || a.name || '').localeCompare(b.title || b.name || '');
    if (activeSort === 'progress') return calcProgress(b) - calcProgress(a);
    return 0;
  });

  return list;
}

//  Render 

function renderProjects() {
  const projects = getFilteredProjects();
  if (activeView === 'grid') renderGrid(projects);
  else                       renderList(projects);
}

function renderGrid(projects) {
  const grid = document.getElementById('projectsGrid');
  const list = document.getElementById('projectsListView');
  if (!grid) return;
  grid.classList.remove('hidden');
  list?.classList.add('hidden');
  if (!projects.length) { grid.innerHTML = emptyHTML(); return; }
  grid.innerHTML = projects.map(p => projectCardHTML(p)).join('');
  grid.querySelectorAll('.project-card[data-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-menu')) return;
      window.location.href = `project.html?id=${card.dataset.id}`;
    });
  });
  wireMenus(grid);
}

function renderList(projects) {
  const grid = document.getElementById('projectsGrid');
  const list = document.getElementById('projectsListView');
  if (!list) return;
  list.classList.remove('hidden');
  grid?.classList.add('hidden');
  if (!projects.length) {
    list.innerHTML = `<div class="card" style="padding:60px;text-align:center">${emptyHTML()}</div>`;
    return;
  }
  list.innerHTML = projects.map(p => projectRowHTML(p)).join('');
  list.querySelectorAll('.project-row[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-menu')) return;
      window.location.href = `project.html?id=${row.dataset.id}`;
    });
  });
  wireMenus(list);
}

//  Card HTML 

function projectCardHTML(p) {
  const color       = stringToColor(p.title || p.name || p._id);
  const progress    = calcProgress(p);
  const taskCount   = tasksByProject[String(p._id)]?.total ?? (p.taskCount ?? 0);
  const memberCount = p.memberCount ?? (p.members?.length ?? 1);
  const emoji       = PROJECT_EMOJIS[Math.abs(hashStr(p._id)) % PROJECT_EMOJIS.length];
  const status      = p.status || 'actif';
  const chip        = statusChip(status);
  const due         = p.deadline ? formatDate(p.deadline) : null;
  const dueOverdue  = p.deadline && new Date(p.deadline) < new Date() && status !== 'archivé';

  return `
    <div class="project-card" data-id="${p._id}" style="--card-color:${color}">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color};border-radius:18px 18px 0 0"></div>
      <div class="project-card-header">
        <div class="project-icon" style="background:${color}22">${emoji}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="status-chip ${chip.cls}">${chip.label}</span>
          <div class="project-card-menu" onclick="toggleMenu(event, '${p._id}')">
            ⋯
            <div class="dropdown" id="menu-${p._id}">
              <button class="dropdown-item" onclick="openEditModal(event, '${p._id}')">✏️ Edit</button>
              <button class="dropdown-item danger" onclick="openDeleteModal(event, '${p._id}', '${escAttr(p.title || p.name)}')">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
      <div class="project-card-name">${escHtml(p.title || p.name)}</div>
      <div class="project-card-desc">${escHtml(p.description || 'No description provided.')}</div>
      <div class="project-card-stats">
        <div class="pstat">✅ <strong>${taskCount}</strong> tasks</div>
        <div class="pstat">👥 <strong>${memberCount}</strong> member${memberCount !== 1 ? 's' : ''}</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:5px">
          <span>Progress</span><span style="font-weight:700;color:var(--text)">${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%;background:${color}"></div>
        </div>
      </div>
      <div class="project-card-footer">
        <div style="display:flex;flex-direction:column;gap:2px">
          <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Owner</div>
          <div style="font-size:.8rem;font-weight:600">${escHtml(p.owner?.fullName || p.owner?.name || p.owner?.username || 'Unknown')}</div>
        </div>
        ${due ? `<div class="project-due ${dueOverdue ? 'overdue' : ''}">📅 ${due}</div>` : '<div></div>'}
      </div>
    </div>
  `;
}

function projectRowHTML(p) {
  const color     = stringToColor(p.title || p.name || p._id);
  const progress  = calcProgress(p);
  const taskCount = tasksByProject[String(p._id)]?.total ?? (p.taskCount ?? 0);
  const chip      = statusChip(p.status || 'actif');

  return `
    <div class="project-row" data-id="${p._id}">
      <div class="project-row-color" style="background:${color}"></div>
      <div class="project-row-name">${escHtml(p.title || p.name)}</div>
      <span class="status-chip ${chip.cls}">${chip.label}</span>
      <div class="project-row-meta">👤 ${escHtml(p.owner?.fullName || p.owner?.name || 'Unknown')}</div>
      <div class="project-row-meta">✅ ${taskCount} tasks</div>
      <div class="project-row-progress">
        <div class="project-row-progress-top">
          <span>Progress</span><span>${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%;background:${color}"></div>
        </div>
      </div>
      <div class="project-card-menu" onclick="toggleMenu(event, '${p._id}-row')" style="position:relative">
        ⋯
        <div class="dropdown" id="menu-${p._id}-row">
          <button class="dropdown-item" onclick="openEditModal(event, '${p._id}')">✏️ Edit</button>
          <button class="dropdown-item danger" onclick="openDeleteModal(event, '${p._id}', '${escAttr(p.title || p.name)}')">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `;
}

function emptyHTML() {
  const isSearch = searchQuery.trim() || activeFilter !== 'all';
  return `
    <div class="empty-projects">
      <div class="empty-icon">${isSearch ? '🔍' : '📁'}</div>
      <h2>${isSearch ? 'No projects found' : 'No projects yet'}</h2>
      <p>${isSearch ? 'Try a different search or filter.' : 'Create your first project to get started!'}</p>
      ${!isSearch ? `<button class="btn btn-primary" onclick="openNewModal()">＋ Create Project</button>` : ''}
    </div>
  `;
}

//  Dropdown Menus 

function toggleMenu(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.dropdown.open').forEach(d => {
    if (d.id !== `menu-${id}`) d.classList.remove('open');
  });
  document.getElementById(`menu-${id}`)?.classList.toggle('open');
}

function wireMenus(container) {
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }, { once: false });
}

//  Create / Edit Modal 

function openNewModal() {
  editingId = null;
  setText('modalTitle', 'New Project');
  setText('saveProjectBtn', 'Create Project');
  clearForm();
  const pStart = document.getElementById('pStart');
  if (pStart && !pStart.value) pStart.value = new Date().toISOString().split('T')[0];
  openModal('projectModal');
}

function openEditModal(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  const project = allProjects.find(p => p._id === id);
  if (!project) return;
  editingId = id;
  setText('modalTitle', 'Edit Project');
  setText('saveProjectBtn', 'Save Changes');
  setVal('pName',   project.title       || project.name || '');
  setVal('pDesc',   project.description || '');
  setVal('pStart',  project.startDate   ? project.startDate.split('T')[0] : '');
  setVal('pEnd',    project.deadline    ? project.deadline.split('T')[0]
                  : project.endDate     ? project.endDate.split('T')[0] : '');
  setVal('pStatus', project.status      || 'actif');
  openModal('projectModal');
}

async function handleSave() {
  const name      = getVal('pName').trim();
  const desc      = getVal('pDesc').trim();
  const startDate = getVal('pStart');
  const endDate   = getVal('pEnd');
  const status    = getVal('pStatus');

  if (!name) {
    toast.warning('Name required', 'Please enter a project name.');
    document.getElementById('pName')?.focus();
    return;
  }

  const btn = document.getElementById('saveProjectBtn');
  btn.disabled = true;
  btn.textContent = editingId ? 'Saving…' : 'Creating…';

  try {
    const payload = { title: name, description: desc, startDate, deadline: endDate || null, status };
    let project;

    if (editingId) {
      const res = await axios.put(`/api/projects/${editingId}`, payload);
      project = res.data.project || res.data;
      const idx = allProjects.findIndex(p => p._id === editingId);
      if (idx !== -1) allProjects[idx] = { ...allProjects[idx], ...project };
      toast.success('Project updated!', `"${name}" has been saved.`);
    } else {
      const res = await axios.post('/api/projects', payload);
      project = res.data.project || res.data;
      allProjects.unshift(project);
      toast.success('Project created! 🎉', `"${name}" is ready.`);
    }

    closeModal('projectModal');
    clearForm();
    updateStats();
    renderProjects();

    if (!editingId && project?._id) {
      setTimeout(() => window.location.href = `project.html?id=${project._id}`, 800);
    }

  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Something went wrong.');
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Save Changes' : 'Create Project';
  }
}

//  Delete Modal 

function openDeleteModal(e, id, name) {
  e.stopPropagation();
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  deletingId = id;
  setText('deleteProjectName', name);
  openModal('deleteModal');
}

async function handleDelete() {
  if (!deletingId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    await axios.delete(`/api/projects/${deletingId}`);
    allProjects = allProjects.filter(p => p._id !== deletingId);
    delete tasksByProject[deletingId];
    toast.success('Project deleted', 'The project has been removed.');
    closeModal('deleteModal');
    updateStats();
    renderProjects();
  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Could not delete project.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
    deletingId = null;
  }
}

//  Wire Buttons 

function wireButtons() {
  document.getElementById('saveProjectBtn')?.addEventListener('click', handleSave);
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDelete);
  document.getElementById('newProjectBtn')?.addEventListener('click',  openNewModal);
  document.getElementById('newProjectBtn2')?.addEventListener('click', openNewModal);

  ['searchInput', 'topbarSearch'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProjects();
    });
  });

  document.getElementById('filterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderProjects();
  });

  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    activeSort = e.target.value;
    renderProjects();
  });

  document.getElementById('gridViewBtn')?.addEventListener('click', () => {
    activeView = 'grid';
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    renderProjects();
  });

  document.getElementById('listViewBtn')?.addEventListener('click', () => {
    activeView = 'list';
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    renderProjects();
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) logout();
  });

  document.querySelector('[data-close="projectModal"]')?.addEventListener('click', () => {
    editingId = null;
    clearForm();
  });
}

//  Helpers 

function calcProgress(project) {
  if (typeof project.progress === 'number') return project.progress;
  const pid  = String(project._id || project.id || '');
  const data = tasksByProject[pid];
  if (!data || !data.total) return 0;
  return Math.round((data.completed / data.total) * 100);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusChip(status) {
  const map = {
    actif:      { cls: 'chip-active',  label: 'Active'   },
    archivé:    { cls: 'chip-done',    label: 'Archived' },
    'en pause': { cls: 'chip-pending', label: 'On Hold'  },
    planning:   { cls: 'chip-pending', label: 'Planning' },
    active:     { cls: 'chip-active',  label: 'Active'   },
  };
  return map[status] || { cls: 'chip-active', label: 'Active' };
}

function clearForm() {
  ['pName','pDesc','pStart','pEnd'].forEach(id => setVal(id, ''));
  setVal('pStatus', 'actif');
}

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str = '') {
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id) {
  return document.getElementById(id)?.value || '';
}

function hashStr(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}