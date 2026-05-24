/**
 * TaskFlow — Project JS
 */

//  State 

let project       = null;
let tasks         = [];
let members       = [];
let projectId     = null;
let editingTaskId = null;
let deletingTaskId = null;
let draggedTaskId  = null;
let taskSearch    = '';
let priorityFilter = 'all';

const PRIORITY_LABELS = { haute: 'High', moyenne: 'Medium', basse: 'Low' };
const PRIORITY_COLORS = {
  haute:   { color: '#ff6584', bg: 'rgba(255,101,132,.12)' },
  moyenne: { color: '#f7971e', bg: 'rgba(247,151,30,.12)'  },
  basse:   { color: '#43e97b', bg: 'rgba(67,233,123,.12)'  },
};

const COLUMNS = [
  { id: 'à faire',  label: 'To Do',       dot: '#7b78a8', countBg: 'rgba(123,120,168,.12)', countColor: '#7b78a8' },
  { id: 'en cours', label: 'In Progress', dot: '#6c63ff', countBg: 'rgba(108,99,255,.12)',  countColor: '#6c63ff' },
  { id: 'terminé',  label: 'Done',        dot: '#43e97b', countBg: 'rgba(67,233,123,.12)',  countColor: '#2cb96a' },
];

const PROJECT_EMOJIS = ['📁','🚀','🎯','💡','🛠️','🌐','📱','🎨','📊','🔬','🏗️','⚡'];

//  Init 

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  projectId = new URLSearchParams(window.location.search).get('id');
  if (!projectId) { window.location.href = 'projects.html'; return; }

  populateUserUI(getCurrentUser());
  wireButtons();
  await loadProject();
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
  // Fallback: if no user object stored, read name from the JWT payload
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

//  Owner check 

function getLoggedInUserId() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.id || payload._id || payload.userId || '');
  } catch (e) {
    const u = getCurrentUser();
    return String(u?._id || u?.id || '');
  }
}

function isProjectOwner() {
  if (!project) return false;
  const ownerId = String(project.owner?._id || project.owner || '');
  const userId  = getLoggedInUserId();
  return ownerId !== '' && ownerId === userId;
}

// ── Load Project ──────────────────────────────────────────────────────────────

async function loadProject() {
  try {
    const [projRes, taskRes] = await Promise.all([
      axios.get(`/api/projects/${projectId}`),
      axios.get(`/api/tasks/project/${projectId}`),
    ]);

    project = projRes.data.project || projRes.data;
    tasks   = Array.isArray(taskRes.data)        ? taskRes.data
            : Array.isArray(taskRes.data.data)   ? taskRes.data.data
            : Array.isArray(taskRes.data.tasks)  ? taskRes.data.tasks
            : [];

    renderPage();
    await loadMembers();
    renderOwnerName();
    updateNavBadges();
  } catch (err) {
    console.error('Load project error:', err);
    if (err.response?.status === 404) {
      toast.error('Not found', 'This project does not exist.');
      setTimeout(() => window.location.href = 'projects.html', 1500);
    } else {
      toast.error('Error', 'Could not load project.');
    }
  }
}

//  Render Full Page 

function renderPage() {
  const color    = stringToColor(project.title || project.name || project._id);
  const emoji    = PROJECT_EMOJIS[Math.abs(hashStr(project._id)) % PROJECT_EMOJIS.length];
  const prog     = calcProgress();
  const chip     = statusChip(project.status || 'actif');

  document.getElementById('breadcrumbName').textContent = project.title || project.name;
  document.title = `${project.title || project.name} — TaskFlow`;

  const todoCount   = tasks.filter(t => !t.status || t.status === 'à faire').length;
  const inProgCount = tasks.filter(t => t.status === 'en cours').length;
  const doneCount   = tasks.filter(t => t.status === 'terminé').length;

  document.getElementById('pageBody').innerHTML = `
    <div class="project-hero fade-up">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:${color};border-radius:20px 20px 0 0"></div>
      <div class="hero-top">
        <div class="hero-icon" style="background:${color}22">${emoji}</div>
        <div class="hero-info">
          <div class="hero-name">${escHtml(project.title || project.name)}</div>
          <div class="hero-desc">${escHtml(project.description || 'No description.')}</div>
        </div>
        <div class="hero-actions">
          <span class="status-chip ${chip.cls}">${chip.label}</span>
          <button class="btn btn-outline btn-sm" onclick="openEditProjectModal()">✏️ Edit</button>
        </div>
      </div>
      <div class="hero-meta">
        <div class="meta-item">
          <span class="meta-label">Tasks</span>
          <span class="meta-value">${tasks.length} total</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Created</span>
          <span class="meta-value">${project.createdAt ? formatDate(project.createdAt) : '—'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Deadline</span>
          <span class="meta-value ${project.deadline && new Date(project.deadline) < new Date() ? 'overdue' : ''}">${project.deadline ? formatDate(project.deadline) : '—'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Owner</span>
          <span class="meta-value" id="heroOwnerName">—</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Members</span>
          <span class="meta-value">${(project.members || []).length || 1}</span>
        </div>
        <div class="hero-progress">
          <div class="hero-progress-top">
            <span class="meta-label">Progress</span>
            <span class="meta-label" style="color:var(--text);font-weight:700">${prog}%</span>
          </div>
          <div class="progress-bar" style="height:8px">
            <div class="progress-fill" style="width:${prog}%;background:${color}"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="project-tabs fade-up fade-up-1" id="projectTabs">
      <div class="project-tab active" data-tab="board">📋 Board <span class="tab-count">${tasks.length}</span></div>
      <div class="project-tab" data-tab="members">👥 Members <span class="tab-count">${(project.members || []).length || 1}</span></div>
      <div class="project-tab" data-tab="settings">⚙️ Settings</div>
    </div>

    <div class="tab-panel active fade-up fade-up-2" id="tab-board">
      <div class="kanban-toolbar">
        <div class="kanban-search">
          <span class="ks-icon">🔍</span>
          <input type="text" id="taskSearchInput" placeholder="Search tasks…" oninput="onTaskSearch(this.value)" />
        </div>
        <div class="priority-filter">
          <button class="pf-btn active" data-p="all"    onclick="onPriorityFilter(this)">All</button>
          <button class="pf-btn" data-p="haute"   onclick="onPriorityFilter(this)" style="color:#ff6584">High</button>
          <button class="pf-btn" data-p="moyenne" onclick="onPriorityFilter(this)" style="color:#f7971e">Med</button>
          <button class="pf-btn" data-p="basse"   onclick="onPriorityFilter(this)" style="color:#43e97b">Low</button>
        </div>
        <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openAddTaskModal()">＋ Add Task</button>
      </div>
      <div class="kanban-board" id="kanbanBoard">
        ${COLUMNS.map(col => renderColumn(col)).join('')}
      </div>
    </div>

    <div class="tab-panel" id="tab-members">${renderMembersTab()}</div>
    <div class="tab-panel" id="tab-settings">${renderSettingsTab()}</div>
  `;

  // Wire tabs only once
  if (!window._tabsWired) {
    window._tabsWired = true;
    document.body.addEventListener('click', (e) => {
      const tab = e.target.closest('.project-tab');
      if (!tab) return;
      document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  }
}

//  Owner Name 

function renderOwnerName() {
  const el = document.getElementById('heroOwnerName');
  if (!el) return;
  const owner = project.owner;
  if (!owner) { el.textContent = '—'; return; }
  if (typeof owner === 'object') {
    el.textContent = owner.fullName || owner.name || owner.username || '—';
    return;
  }
  // owner is bare string id — check if it's the current user
  const userId = getLoggedInUserId();
  if (String(owner) === userId) {
    // FIX: fall back to JWT decode if getCurrentUser() returns null
    const u = getCurrentUser() || decodeToken();
    el.textContent = u?.fullName || u?.name || u?.username || 'You';
    return;
  }
  // check members
  const m = members.find(m => String(m._id) === String(owner));
  el.textContent = m ? (m.fullName || m.name || '—') : '—';
}

//  Kanban 

function renderColumn(col) {
  // FIX: normalise status — DB has both 'à faire' and 'a faire' (written by old buggy toggleTask)
  const norm = s => (s || '').normalize('NFC').trim();
  const colTasks = getFilteredTasks().filter(t => {
    const s = norm(t.status);
    if (col.id === 'à faire') return !t.status || s === 'à faire' || s === 'a faire';
    if (col.id === 'terminé')  return s === 'terminé'  || s === 'termine';
    return s === col.id;
  });

  return `
    <div class="kanban-col" id="col-${col.id}" data-status="${col.id}"
         ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${col.id}')">
      <div class="col-header">
        <div class="col-title">
          <div class="col-dot" style="background:${col.dot}"></div>
          ${col.label}
          <span class="col-count" style="background:${col.countBg};color:${col.countColor}">${colTasks.length}</span>
        </div>
        <div class="col-add-btn" onclick="openAddTaskModal('${col.id}')" title="Add task">＋</div>
      </div>
      <div class="col-tasks" id="tasks-${col.id}">
        ${colTasks.length
          ? colTasks.map(t => taskCardHTML(t)).join('')
          : `<div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:.82rem">No tasks</div>`
        }
      </div>
    </div>`;
}

function getFilteredTasks() {
  let list = [...tasks];
  if (taskSearch.trim()) {
    const q = taskSearch.toLowerCase();
    list = list.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }
  if (priorityFilter !== 'all') {
    list = list.filter(t => (t.priority || 'moyenne') === priorityFilter);
  }
  return list;
}

function taskCardHTML(task) {
  const isDone   = task.status === 'terminé';
  const priority = task.priority || 'moyenne';
  // FIX: dueDateClass was not defined in this file — define it below as dueDateClass()
  const dueClass = isDone ? '' : dueDateClass(task.deadline);
  const dueLabel = task.deadline ? formatDate(task.deadline) : null;
  const assignee = task.assignedTo;
  const assigneeName = assignee?.fullName || assignee?.name || assignee?.username || '';
  const dueBgMap = { overdue: 'tdc-overdue', today: 'tdc-today', soon: 'tdc-soon', '': 'tdc-normal' };

  return `
    <div class="task-card" id="tc-${task._id}" draggable="true"
         ondragstart="onDragStart(event, '${task._id}')" ondragend="onDragEnd(event)">
      <div class="task-card-top">
        <div class="task-card-title ${isDone ? 'done' : ''}">${escHtml(task.title || task.name)}</div>
        <div class="task-card-menu" onclick="toggleTaskMenu(event, '${task._id}')">
          ⋯
          <div class="dropdown" id="tmenu-${task._id}">
            <button class="dropdown-item" onclick="openEditTaskModal(event, '${task._id}')">✏️ Edit</button>
            ${!isDone ? `<button class="dropdown-item" onclick="quickDone(event, '${task._id}')">✅ Mark Done</button>` : ''}
            <button class="dropdown-item danger" onclick="openDeleteTaskModal(event, '${task._id}', '${escAttr(task.title || task.name)}')">🗑️ Delete</button>
          </div>
        </div>
      </div>
      ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ''}
      <div class="task-card-footer">
        <span style="background:${PRIORITY_COLORS[priority]?.bg||'var(--bg)'};color:${PRIORITY_COLORS[priority]?.color||'var(--text-muted)'};padding:2px 9px;border-radius:6px;font-size:.7rem;font-weight:700;text-transform:uppercase">${PRIORITY_LABELS[priority]||priority}</span>
        ${dueLabel ? `<span class="task-due-chip ${dueBgMap[dueClass]}">${dueClass==='overdue'?'⚠️':'📅'} ${dueLabel}</span>` : ''}
        ${assigneeName ? `<div class="task-assignee" style="background:${stringToColor(assigneeName)}" title="${escAttr(assigneeName)}">${getInitials(assigneeName)}</div>` : ''}
      </div>
    </div>`;
}

// FIX: was missing from this file — caused ReferenceError on every task card render
function dueDateClass(dateStr) {
  if (!dateStr) return '';
  const diff = new Date(dateStr) - new Date();
  const days = diff / 86400000;
  if (days < 0)  return 'overdue';
  if (days < 1)  return 'today';
  if (days < 3)  return 'soon';
  return '';
}

//  Drag & Drop 

function onDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => document.getElementById(`tc-${taskId}`)?.classList.add('dragging'), 0);
}

function onDragEnd(e) {
  document.getElementById(`tc-${draggedTaskId}`)?.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedTaskId) return;
  const task = tasks.find(t => t._id === draggedTaskId);
  if (!task) return;
  const oldStatus = task.status || 'à faire';
  if (oldStatus === newStatus) return;

  task.status = newStatus;
  refreshBoard();

  try {
    await axios.patch(`/api/tasks/${draggedTaskId}/status`, { status: newStatus });
    toast.success(newStatus === 'terminé' ? 'Task done! 🎉' : 'Task moved', `Moved to ${COLUMNS.find(c => c.id === newStatus)?.label}`);
    updateHeroProgress();
  } catch (err) {
    task.status = oldStatus;
    refreshBoard();
    toast.error('Error', 'Could not move task.');
  }
}

async function reloadTasks() {
  try {
    const res = await axios.get(`/api/tasks/project/${projectId}`);
    tasks = Array.isArray(res.data)       ? res.data
          : Array.isArray(res.data.data)  ? res.data.data
          : Array.isArray(res.data.tasks) ? res.data.tasks
          : [];
    refreshBoard();
    updateHeroProgress();
  } catch (err) {
    console.error('Reload tasks error:', err);
    refreshBoard();
    updateHeroProgress();
  }
}

function refreshBoard() {
  const board = document.getElementById('kanbanBoard');
  if (board) board.innerHTML = COLUMNS.map(col => renderColumn(col)).join('');
}

function updateHeroProgress() {
  const prog = calcProgress();
  document.querySelectorAll('.progress-fill').forEach(el => {
    if (el.closest('.project-hero')) el.style.width = `${prog}%`;
  });
}

function onTaskSearch(val) { taskSearch = val; refreshBoard(); }

function onPriorityFilter(btn) {
  document.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  priorityFilter = btn.dataset.p;
  refreshBoard();
}

//  Task Modals 

function openAddTaskModal(defaultStatus) {
  if (!isProjectOwner()) {
    toast.error('Not allowed', 'Only the project owner can add tasks.');
    return;
  }
  editingTaskId = null;
  document.getElementById('taskModalTitle').textContent = 'Add Task';
  document.getElementById('saveTaskBtn').textContent    = 'Add Task';
  clearTaskForm();
  document.getElementById('tStatus').value = defaultStatus || 'à faire';
  const myId = getLoggedInUserId();
  populateAssigneeDropdown(myId);
  openModal('taskModal');
  setTimeout(offerDraftRestore, 50);
}

function openEditTaskModal(e, taskId) {
  e.stopPropagation();
  closeAllMenus();
  const task = tasks.find(t => t._id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('saveTaskBtn').textContent    = 'Save Changes';
  document.getElementById('tTitle').value    = task.title || task.name || '';
  document.getElementById('tDesc').value     = task.description || '';
  document.getElementById('tPriority').value = task.priority || 'moyenne';
  document.getElementById('tStatus').value   = task.status   || 'à faire';
  document.getElementById('tDue').value      = task.deadline ? task.deadline.split('T')[0] : '';
  populateAssigneeDropdown(task.assignedTo?._id || task.assignedTo || '');
  openModal('taskModal');
}

document.getElementById('saveTaskBtn')?.addEventListener('click', async () => {
  const title    = document.getElementById('tTitle')?.value.trim();
  const desc     = document.getElementById('tDesc')?.value.trim();
  const priority = document.getElementById('tPriority')?.value || 'moyenne';
  const status   = document.getElementById('tStatus')?.value || 'à faire';
  const dueDate  = document.getElementById('tDue')?.value;
  const assignedTo = document.getElementById('tAssignee')?.value || null;

  if (!title) { toast.warning('Title required', ''); document.getElementById('tTitle')?.focus(); return; }

  const btn = document.getElementById('saveTaskBtn');
  btn.disabled = true;
  btn.textContent = editingTaskId ? 'Saving…' : 'Adding…';

  try {
    const selectedAssignee = document.getElementById('tAssignee')?.value;
    const finalAssignee = (selectedAssignee && selectedAssignee !== '')
      ? selectedAssignee
      : getLoggedInUserId() || null;

    const payload = { title, description: desc, priority, status, deadline: dueDate || null, assignedTo: finalAssignee, project: projectId };

    if (editingTaskId) {
      await axios.put(`/api/tasks/${editingTaskId}`, payload);
      toast.success('Task updated!', '');
      await reloadTasks();
      closeModal('taskModal');
      clearTaskForm();
      clearDraft();
      refreshBoard();
      updateHeroProgress();
    } else {
      await axios.post('/api/tasks', payload);
      await reloadTasks();
      toast.success('Task added! ✅', '');
      closeModal('taskModal');
      clearTaskForm();
      clearDraft();
    }
  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Could not save task.');
  } finally {
    btn.disabled = false;
    btn.textContent = editingTaskId ? 'Save Changes' : 'Add Task';
  }
});

async function quickDone(e, taskId) {
  e.stopPropagation();
  closeAllMenus();
  const task = tasks.find(t => t._id === taskId);
  if (!task) return;
  const oldStatus = task.status;
  task.status = 'terminé';
  refreshBoard();
  updateHeroProgress();
  try {
    await axios.patch(`/api/tasks/${taskId}/status`, { status: 'terminé' });
    toast.success('Task done! 🎉', '');
  } catch (err) {
    task.status = oldStatus;
    refreshBoard();
    toast.error('Error', 'Could not update task.');
  }
}

function openDeleteTaskModal(e, taskId, name) {
  e.stopPropagation();
  closeAllMenus();
  deletingTaskId = taskId;
  document.getElementById('deleteTaskName').textContent = name;
  openModal('deleteTaskModal');
}

document.getElementById('confirmDeleteTaskBtn')?.addEventListener('click', async () => {
  if (!deletingTaskId) return;
  const btn = document.getElementById('confirmDeleteTaskBtn');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    await axios.delete(`/api/tasks/${deletingTaskId}`);
    tasks = tasks.filter(t => t._id !== deletingTaskId);
    toast.success('Task deleted', '');
    closeModal('deleteTaskModal');
    refreshBoard();
    updateHeroProgress();
  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Could not delete task.');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete'; deletingTaskId = null;
  }
});

//  Members 

async function loadMembers() {
  try {
    const res = await axios.get(`/api/projects/${projectId}/members`);
    members = Array.isArray(res.data)         ? res.data
            : Array.isArray(res.data.members) ? res.data.members
            : Array.isArray(res.data.data)    ? res.data.data
            : [];
    project.members = members;
    rerenderMembersTab();
  } catch (err) {
    console.error('Load members error:', err);
  }
}

function rerenderMembersTab() {
  const panel = document.getElementById('tab-members');
  if (panel) panel.innerHTML = renderMembersTab();
}

function renderMembersTab() {
  const ownerId = String(project.owner?._id || project.owner || '');

  const headerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h2 style="font-size:1.1rem;font-weight:700">Team Members</h2>
        <p style="color:var(--text-muted);font-size:.85rem;margin-top:3px">${members.length} member${members.length !== 1 ? 's' : ''} in this project</p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openInviteModal()">+ Invite Member</button>
    </div>`;

  if (!members.length) {
    return headerHTML + `<div class="empty-state"><div class="empty-icon" style="font-size:3rem;margin-bottom:12px">👥</div><h3>No members yet</h3><p>Invite your team.</p></div>`;
  }

  const cards = members.map(m => {
    const name  = m.fullName || m.name || m.username || 'Unknown';
    const email = m.email || '';
    const color = stringToColor(name);
    const isOwner   = String(m._id) === ownerId;
    const roleColor = isOwner ? '#ff6584' : '#6c63ff';
    const role      = isOwner ? 'owner' : 'member';
    const removeBtn = isOwner ? '' : `<button onclick="removeMember('${m._id}', '${escAttr(name)}')" style="margin-left:8px;background:rgba(255,101,132,.1);color:var(--accent-2);border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:.8rem;font-weight:600">Remove</button>`;
    return `<div class="member-card"><div class="member-av" style="background:${color}">${getInitials(name)}</div><div style="flex:1;min-width:0"><div class="member-name">${escHtml(name)}</div><div class="member-email">${escHtml(email)}</div></div><span class="member-role-badge" style="background:${roleColor}22;color:${roleColor}">${role}</span>${removeBtn}</div>`;
  }).join('');

  return headerHTML + `<div class="members-grid">${cards}</div>`;
}

function populateAssigneeDropdown(selectedId) {
  selectedId = String(selectedId || '');
  const select = document.getElementById('tAssignee');
  if (!select) return;

  const allPeople = [...members];

  if (project.owner && typeof project.owner === 'object' && project.owner._id) {
    const ownerId = String(project.owner._id);
    if (!allPeople.find(m => String(m._id) === ownerId)) {
      allPeople.unshift(project.owner);
    }
  }

  if (!allPeople.length) {
    const myId = getLoggedInUserId();
    // FIX: fall back to JWT decode if getCurrentUser() returns null
    const u    = getCurrentUser() || decodeToken();
    if (myId) {
      allPeople.push({
        _id:      myId,
        fullName: u?.fullName || u?.name || 'Me',
        email:    u?.email || '',
      });
    }
  }

  select.innerHTML = '<option value="">— Unassigned —</option>' +
    allPeople.map(m => {
      const name     = m.fullName || m.name || m.username || 'Unknown';
      const isSelected = String(m._id) === selectedId ? 'selected' : '';
      return `<option value="${m._id}" ${isSelected}>${escHtml(name)} — ${escHtml(m.email || '')}</option>`;
    }).join('');
}

function openInviteModal() {
  const el = document.getElementById('inviteEmail');
  if (el) el.value = '';
  const err = document.getElementById('inviteError');
  if (err) err.textContent = '';
  openModal('inviteMemberModal');
  setTimeout(() => { document.getElementById('inviteEmail')?.focus(); }, 100);
}

async function inviteMember() {
  const emailEl = document.getElementById('inviteEmail');
  const email   = emailEl ? emailEl.value.trim().toLowerCase() : '';
  const errEl   = document.getElementById('inviteError');

  if (!email) { if (errEl) errEl.textContent = 'Please enter an email address.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (errEl) errEl.textContent = 'Invalid email.'; return; }
  if (members.some(m => m.email === email)) { if (errEl) errEl.textContent = 'Already a member.'; return; }

  const btn = document.getElementById('inviteBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Inviting...'; }
  if (errEl) errEl.textContent = '';

  try {
    await axios.post(`/api/projects/${projectId}/members`, { email });
    toast.success('Member invited!', `${email} has been added.`);
    closeModal('inviteMemberModal');
    await loadMembers();
    renderOwnerName();
  } catch (err) {
    if (errEl) errEl.textContent = err.response?.data?.message || 'Could not invite member.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Invite'; }
  }
}

async function removeMember(userId, name) {
  if (!confirm(`Remove ${name} from this project?`)) return;
  try {
    await axios.delete(`/api/projects/${projectId}/members/${userId}`);
    toast.success('Member removed', `${name} has been removed.`);
    await loadMembers();
  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Could not remove member.');
  }
}

//  Settings 

function renderSettingsTab() {
  return `
    <div class="settings-section">
      <h3>Project Details</h3>
      <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:16px">Update your project information.</p>
      <button class="btn btn-primary" onclick="openEditProjectModal()">✏️ Edit Project</button>
    </div>
    <div class="settings-section danger-zone">
      <h3>⚠️ Danger Zone</h3>
      <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:16px">Permanently delete this project and all its tasks.</p>
      <button class="btn btn-danger" onclick="confirmDeleteProject()">🗑️ Delete Project</button>
    </div>`;
}

function openEditProjectModal() {
  if (!project) return;
  document.getElementById('epName').value     = project.title || project.name || '';
  document.getElementById('epDesc').value     = project.description || '';
  document.getElementById('epStart').value    = project.startDate ? project.startDate.split('T')[0] : '';
  document.getElementById('epEnd').value      = project.deadline  ? project.deadline.split('T')[0]  : '';
  document.getElementById('epStatus').value   = project.status    || 'actif';
  openModal('editProjectModal');
}

document.getElementById('saveEditProjectBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('epName')?.value.trim();
  if (!name) { toast.warning('Name required', ''); return; }

  const btn = document.getElementById('saveEditProjectBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const payload = {
      title:       name,
      description: document.getElementById('epDesc')?.value.trim(),
      deadline:    document.getElementById('epEnd')?.value  || null,
      status:      document.getElementById('epStatus')?.value,
    };
    const res = await axios.put(`/api/projects/${projectId}`, payload);
    project = { ...project, ...(res.data.project || res.data) };
    toast.success('Project updated!', '');
    closeModal('editProjectModal');
    renderPage();
    renderOwnerName();
  } catch (err) {
    toast.error('Error', err.response?.data?.message || 'Could not update project.');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
});

function confirmDeleteProject() {
  if (!confirm(`Delete "${project.title || project.name}"? This cannot be undone.`)) return;
  axios.delete(`/api/projects/${projectId}`)
    .then(() => { toast.success('Deleted', 'Redirecting…'); setTimeout(() => window.location.href = 'projects.html', 1000); })
    .catch(err => toast.error('Error', err.response?.data?.message || 'Could not delete.'));
}

//  Wire Buttons 

function wireButtons() {
  document.getElementById('addTaskBtn')?.addEventListener('click', () => openAddTaskModal());
  document.getElementById('logoutBtn')?.addEventListener('click', () => { if (confirm('Logout?')) logout(); });
  document.addEventListener('click', closeAllMenus);
  initDraftListeners();
}

function toggleTaskMenu(e, taskId) {
  e.stopPropagation();
  const menu = document.getElementById(`tmenu-${taskId}`);
  const isOpen = menu?.classList.contains('open');
  closeAllMenus();
  if (!isOpen) menu?.classList.add('open');
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
}

//  Helpers 

function calcProgress() {
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(t => t.status === 'terminé').length / tasks.length * 100);
}

async function updateNavBadges() {
  // Task count — we already have the tasks array
  const tc = document.getElementById('taskCount');
  if (tc) tc.textContent = tasks.length;

  // Project count — quick call, failures are silent
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

function statusChip(status) {
  const map = {
    actif:      { cls: 'chip-active',  label: 'Active'   },
    'en pause': { cls: 'chip-pending', label: 'On Hold'  },
    archivé:    { cls: 'chip-done',    label: 'Archived' },
  };
  return map[status] || { cls: 'chip-active', label: 'Active' };
}

//  Draft Auto-Save 

function draftKey() { return 'tf-task-draft-' + projectId; }

function saveDraft() {
  if (editingTaskId) return;
  localStorage.setItem(draftKey(), JSON.stringify({
    title:    document.getElementById('tTitle')?.value    || '',
    desc:     document.getElementById('tDesc')?.value     || '',
    priority: document.getElementById('tPriority')?.value || 'moyenne',
    status:   document.getElementById('tStatus')?.value   || 'à faire',
    deadline: document.getElementById('tDue')?.value      || '',
    assignee: document.getElementById('tAssignee')?.value || '',
  }));
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { return null; }
}

function clearDraft() { localStorage.removeItem(draftKey()); }

function initDraftListeners() {
  ['tTitle','tDesc','tDue'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveDraft);
  });
  ['tPriority','tStatus','tAssignee'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveDraft);
  });
}

function offerDraftRestore() {
  const draft = loadDraft();
  if (!draft || !draft.title) return;
  document.getElementById('draftBanner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'draftBanner';
  banner.style.cssText = 'background:rgba(108,99,255,.1);border:1.5px solid rgba(108,99,255,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.83rem';
  banner.innerHTML = `<span>📄 Unsaved draft: <strong>${escHtml(draft.title.slice(0,30))}${draft.title.length>30?'...':''}</strong></span><div style="display:flex;gap:6px"><button onclick="restoreDraft()" style="background:var(--accent-1);color:#fff;border:none;padding:4px 12px;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer">Restore</button><button onclick="discardDraft()" style="background:var(--bg);border:1.5px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:7px;font-size:.78rem;cursor:pointer">Discard</button></div>`;
  const firstGroup = document.querySelector('#taskModal .form-group');
  if (firstGroup) firstGroup.parentNode.insertBefore(banner, firstGroup);
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft) return;
  if (document.getElementById('tTitle')) document.getElementById('tTitle').value = draft.title || '';
  if (document.getElementById('tDesc'))  document.getElementById('tDesc').value  = draft.desc  || '';
  if (document.getElementById('tDue'))   document.getElementById('tDue').value   = draft.deadline || '';
  if (document.getElementById('tPriority') && draft.priority) document.getElementById('tPriority').value = draft.priority;
  if (document.getElementById('tStatus')   && draft.status)   document.getElementById('tStatus').value   = draft.status;
  if (document.getElementById('tAssignee') && draft.assignee) document.getElementById('tAssignee').value = draft.assignee;
  document.getElementById('draftBanner')?.remove();
  toast.info('Draft restored', 'Your previous work has been restored.');
}

function discardDraft() {
  clearDraft();
  document.getElementById('draftBanner')?.remove();
}

function clearTaskForm() {
  ['tTitle','tDesc','tDue'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const p = document.getElementById('tPriority'); if (p) p.value = 'moyenne';
  const s = document.getElementById('tStatus');   if (s) s.value = 'à faire';
  const a = document.getElementById('tAssignee'); if (a) a.value = '';
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

// Defined locally — project.html may not load the shared utils that contain this
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function hashStr(str) {
  str = str || ''; let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}