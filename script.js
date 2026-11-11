const rowsEl = document.getElementById('taskRows');
const search = document.getElementById('searchInput');
const modal = document.getElementById('modal');
const form = document.getElementById('taskForm');
const storageNotice = document.getElementById('storageNotice');
const storageKey = 'pgso-folder-tracker-logbook';
const pageSize = 10;

const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
sidebarToggle.addEventListener('click', () => {
  const collapsed = sidebar.classList.toggle('collapsed');
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  sidebarToggle.querySelector('span').textContent = collapsed ? '›' : '‹';
});

function updateLiveDateTime() {
  const now = new Date();
  document.getElementById('liveDateTime').textContent = now.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

updateLiveDateTime();
window.setInterval(updateLiveDateTime, 1000);

function sampleTasks() {
  return [
    ['Name 1', 'Design team', 'Borrowed'],
    ['Name 2', 'Design team', 'Borrowed'],
    ['Name 3', 'Design team', 'Returned'],
    ['Name 4', 'Design team', 'Borrowed'],
    ['Name 5', 'Design team', 'Borrowed'],
    ['Name 6', 'Design team', 'Returned'],
    ['Name 7', 'Design team', 'Borrowed'],
    ['Name 8', 'Design team', 'Borrowed'],
    ['Name 9', 'Design team', 'Returned'],
    ['Name 10', 'Design team', 'Returned']
  ].map((row, index) => ({
    id: index + 1,
    borrower: row[0],
    file: row[1],
    status: row[2],
    details: '',
    timeStarted: ''
  }));
}

function showStorageNotice(message) {
  storageNotice.textContent = message;
  storageNotice.hidden = false;
}

function isValidTask(task) {
  return task &&
    Number.isSafeInteger(task.id) &&
    typeof task.borrower === 'string' &&
    typeof task.file === 'string' &&
    typeof task.details === 'string' &&
    (task.timeStarted === undefined || typeof task.timeStarted === 'string') &&
    ['Borrowed', 'Returned', 'Not Started', 'In Progress', 'Completed'].includes(task.status);
}

function normalizeTask(task) {
  return {
    id: task.id,
    borrower: task.borrower,
    file: task.file,
    details: task.details,
    status: task.status === 'Completed' || task.status === 'Returned' ? 'Returned' : 'Borrowed',
    timeStarted: task.timeStarted || ''
  };
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return { tasks: sampleTasks(), deletedTasks: [], lastUpdated: null };

    const state = JSON.parse(saved);
    const savedDeletedTasks = state && state.deletedTasks !== undefined ? state.deletedTasks : [];
    if (!state ||
      !Array.isArray(state.tasks) ||
      !state.tasks.every(isValidTask) ||
      !Array.isArray(savedDeletedTasks) ||
      !savedDeletedTasks.every(task => isValidTask(task) && typeof task.deletedAt === 'string')) {
      throw new Error('The saved logbook data is not in the expected format.');
    }
    return {
      tasks: state.tasks.map(normalizeTask),
      deletedTasks: savedDeletedTasks.map(task => ({ ...normalizeTask(task), deletedAt: task.deletedAt })),
      lastUpdated: typeof state.lastUpdated === 'string' ? state.lastUpdated : null
    };
  } catch (error) {
    showStorageNotice(`Saved entries could not be loaded. The sample entries are shown instead. ${error.message}`);
    return { tasks: sampleTasks(), deletedTasks: [], lastUpdated: null };
  }
}

const savedState = loadSavedState();
let tasks = savedState.tasks;
let deletedTasks = savedState.deletedTasks;
let filter = 'All';
let page = 1;
let editing = null;
if (savedState.lastUpdated) {
  document.getElementById('lastUpdate').textContent = savedState.lastUpdated;
}

const statusClass = status => status === 'Returned' ? 'returned' : 'borrowed';
const isToday = value => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
};
const currentLocalDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDateTime = value => value
  ? new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  : 'Not recorded';

function getWeeklyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return { date, entries: [] };
  });

  tasks.forEach(task => {
    if (!task.timeStarted) return;
    const startedAt = new Date(task.timeStarted);
    if (Number.isNaN(startedAt.getTime()) || startedAt < weekStart || startedAt >= weekEnd) return;
    const dayIndex = (startedAt.getDay() + 6) % 7;
    days[dayIndex].entries.push(task);
  });

  const entries = days.flatMap(day => day.entries);
  const returned = entries.filter(task => task.status === 'Returned').length;
  return {
    weekStart,
    weekEnd: new Date(weekEnd.getTime() - 1),
    days,
    total: entries.length,
    borrowed: entries.length - returned,
    returned,
    returnRate: entries.length ? Math.round((returned / entries.length) * 100) : 0
  };
}

function renderDashboard() {
  const report = getWeeklyReport();
  const formatDate = date => date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  document.getElementById('weekRange').textContent =
    `${formatDate(report.weekStart)} – ${formatDate(report.weekEnd)}`;
  document.getElementById('weeklyTotal').textContent = report.total;
  document.getElementById('weeklyBorrowed').textContent = report.borrowed;
  document.getElementById('weeklyReturned').textContent = report.returned;
  document.getElementById('weeklyRate').textContent = `${report.returnRate}%`;
  document.getElementById('weeklyRateBar').style.width = `${report.returnRate}%`;
  document.getElementById('weeklyRows').innerHTML = report.days.map(day => {
    const borrowed = day.entries.filter(task => task.status === 'Borrowed').length;
    const returned = day.entries.length - borrowed;
    const dayLabel = day.date.toLocaleDateString('en-GB', { weekday: 'long' });
    return `<tr>
      <td>${dayLabel}, ${formatDate(day.date)}</td>
      <td>${day.entries.length}</td>
      <td>${borrowed}</td>
      <td>${returned}</td>
    </tr>`;
  }).join('');
  document.getElementById('weeklyEmpty').hidden = report.total > 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function render() {
  const query = search.value.trim().toLowerCase();
  const list = tasks.filter(task =>
    (filter === 'All' ||
      (filter === 'Today' ? task.status === 'Borrowed' && isToday(task.timeStarted) : task.status === filter)) &&
    `${task.borrower} ${task.file} ${task.details} ${task.status}`.toLowerCase().includes(query)
  );
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  page = Math.min(page, pages);
  const shown = list.slice((page - 1) * pageSize, page * pageSize);

  rowsEl.innerHTML = shown.map(task => `
    <tr>
      <td class="check"><input type="checkbox" data-delete="${task.id}" aria-label="Delete ${escapeHtml(task.borrower)}" title="Delete this entry"></td>
      <td>${escapeHtml(task.borrower)}</td>
      <td><span class="file-pill">▣ ${escapeHtml(task.file)}</span></td>
      <td class="details-cell" title="${escapeHtml(task.details)}">${task.details ? escapeHtml(task.details) : '—'}</td>
      <td>
        <select class="status-select ${statusClass(task.status)}" data-status="${task.id}" aria-label="Status for ${escapeHtml(task.borrower)}">
          <option value="Borrowed" ${task.status === 'Borrowed' ? 'selected' : ''}>Borrowed</option>
          <option value="Returned" ${task.status === 'Returned' ? 'selected' : ''}>Returned</option>
        </select>
      </td>
      <td><time datetime="${escapeHtml(task.timeStarted || '')}">${escapeHtml(formatDateTime(task.timeStarted))}</time></td>
      <td class="row-actions">
        <button class="more" type="button" data-menu-toggle="${task.id}" aria-haspopup="true" aria-expanded="false" title="Entry actions" aria-label="Actions for ${escapeHtml(task.borrower)}">⋯</button>
        <div class="row-menu" data-menu="${task.id}" hidden>
          <button type="button" data-edit="${task.id}">Edit entry</button>
          <button type="button" class="delete-entry" data-delete-entry="${task.id}">Delete entry</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('emptyState').hidden = shown.length > 0;
  document.getElementById('recordCount').textContent = `Showing ${shown.length} of ${list.length} records`;
  document.getElementById('pageLabel').textContent = page;
  document.getElementById('prevPage').disabled = page === 1;
  document.getElementById('nextPage').disabled = page === pages;
  document.getElementById('deletedCount').textContent = deletedTasks.length;
  renderDashboard();
  renderDeleted();
}

function saveState(nextTasks, lastUpdated, nextDeletedTasks = deletedTasks) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      tasks: nextTasks,
      deletedTasks: nextDeletedTasks,
      lastUpdated
    }));
    storageNotice.hidden = true;
    return true;
  } catch (error) {
    showStorageNotice(`Your changes could not be saved in this browser. Check browser storage settings and try again. ${error.message}`);
    return false;
  }
}

document.querySelectorAll('.tab').forEach(button => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    page = 1;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
    render();
  });
});

search.addEventListener('input', () => {
  page = 1;
  render();
});
document.getElementById('prevPage').addEventListener('click', () => {
  page -= 1;
  render();
});
document.getElementById('nextPage').addEventListener('click', () => {
  page += 1;
  render();
});
rowsEl.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-delete]');
  if (!checkbox) return;
  const id = Number(checkbox.dataset.delete);
  if (!deleteTask(id)) checkbox.checked = false;
});

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task || !window.confirm(`Move the log entry for ${task.borrower} to Recently Deleted?`)) return false;

  const remainingTasks = tasks.filter(item => item.id !== id);
  const nextDeletedTasks = [...deletedTasks, { ...task, deletedAt: new Date().toISOString() }];
  const lastUpdated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  if (!saveState(remainingTasks, lastUpdated, nextDeletedTasks)) return false;
  tasks = remainingTasks;
  deletedTasks = nextDeletedTasks;
  document.getElementById('lastUpdate').textContent = lastUpdated;
  render();
  return true;
}

function renderDeleted() {
  const deletedRows = document.getElementById('deletedRows');
  if (!deletedRows) return;
  deletedRows.innerHTML = deletedTasks.map(task => `
    <tr>
      <td>${escapeHtml(task.borrower)}</td>
      <td><span class="file-pill">▣ ${escapeHtml(task.file)}</span></td>
      <td>${escapeHtml(task.details || '—')}</td>
      <td><span class="status-select ${statusClass(task.status)}">${escapeHtml(task.status)}</span></td>
      <td><time datetime="${escapeHtml(task.deletedAt)}">${escapeHtml(formatDateTime(task.deletedAt))}</time></td>
      <td class="deleted-actions">
        <button type="button" class="restore-entry" data-restore="${task.id}">Restore</button>
        <button type="button" class="delete-entry" data-delete-permanently="${task.id}">Delete permanently</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('deletedEmpty').hidden = deletedTasks.length > 0;
  document.getElementById('deletedCount').textContent = deletedTasks.length;
}

function showRecentlyDeleted(show) {
  document.getElementById('logsHeading').hidden = show;
  document.getElementById('mainLogsPanel').hidden = show;
  document.getElementById('recentDeletedView').hidden = !show;
  if (show) renderDeleted();
}

document.getElementById('recentDeletedBtn').addEventListener('click', () => showRecentlyDeleted(true));
document.getElementById('backToLogsBtn').addEventListener('click', () => showRecentlyDeleted(false));
document.getElementById('deletedRows').addEventListener('click', event => {
  const restoreButton = event.target.closest('[data-restore]');
  if (restoreButton) {
    const id = Number(restoreButton.dataset.restore);
    const archivedTask = deletedTasks.find(task => task.id === id);
    if (!archivedTask) return;
    const { deletedAt, ...task } = archivedTask;
    const nextTasks = [task, ...tasks];
    const nextDeletedTasks = deletedTasks.filter(item => item.id !== id);
    const lastUpdated = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    if (!saveState(nextTasks, lastUpdated, nextDeletedTasks)) return;
    tasks = nextTasks;
    deletedTasks = nextDeletedTasks;
    document.getElementById('lastUpdate').textContent = lastUpdated;
    render();
    return;
  }

  const deleteButton = event.target.closest('[data-delete-permanently]');
  if (!deleteButton) return;
  const id = Number(deleteButton.dataset.deletePermanently);
  const task = deletedTasks.find(item => item.id === id);
  if (!task || !window.confirm(`Permanently delete the log entry for ${task.borrower}? This cannot be undone.`)) return;
  const nextDeletedTasks = deletedTasks.filter(item => item.id !== id);
  const lastUpdated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  if (!saveState(tasks, lastUpdated, nextDeletedTasks)) return;
  deletedTasks = nextDeletedTasks;
  document.getElementById('lastUpdate').textContent = lastUpdated;
  render();
});

function field(name) {
  return form.elements.namedItem(name);
}

function openModal(task = null) {
  editing = task;
  form.reset();
  document.getElementById('modalTitle').textContent = task ? 'Edit Logbook Entry' : 'Add Logbook Entry';
  field('timeStarted').value = task ? task.timeStarted || '' : currentLocalDateTime();
  if (task) {
    field('borrower').value = task.borrower;
    field('file').value = task.file;
    field('details').value = task.details;
    field('status').value = task.status;
  }
  modal.hidden = false;
  field('borrower').focus();
}

function closeModal() {
  modal.hidden = true;
  editing = null;
  form.reset();
}

document.getElementById('addBtn').addEventListener('click', () => openModal());
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', event => {
  if (event.target === modal) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
});

rowsEl.addEventListener('click', event => {
  const toggle = event.target.closest('[data-menu-toggle]');
  if (toggle) {
    const menu = rowsEl.querySelector(`[data-menu="${toggle.dataset.menuToggle}"]`);
    const willOpen = menu.hidden;
    rowsEl.querySelectorAll('.row-menu').forEach(item => { item.hidden = true; });
    rowsEl.querySelectorAll('[data-menu-toggle]').forEach(item => item.setAttribute('aria-expanded', 'false'));
    menu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    return;
  }

  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    const task = tasks.find(item => item.id === Number(editButton.dataset.edit));
    rowsEl.querySelectorAll('.row-menu').forEach(item => { item.hidden = true; });
    openModal(task);
    return;
  }

  const deleteButton = event.target.closest('[data-delete-entry]');
  if (deleteButton) {
    const id = Number(deleteButton.dataset.deleteEntry);
    rowsEl.querySelectorAll('.row-menu').forEach(item => { item.hidden = true; });
    deleteTask(id);
  }
});

document.addEventListener('click', event => {
  if (event.target.closest('.row-actions')) return;
  rowsEl.querySelectorAll('.row-menu').forEach(menu => { menu.hidden = true; });
  rowsEl.querySelectorAll('[data-menu-toggle]').forEach(button => button.setAttribute('aria-expanded', 'false'));
});

rowsEl.addEventListener('change', event => {
  const select = event.target.closest('[data-status]');
  if (!select) return;

  const task = tasks.find(item => item.id === Number(select.dataset.status));
  if (!task) return;
  const nextTasks = tasks.map(item => item.id === task.id ? { ...item, status: select.value } : item);
  const lastUpdated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  if (!saveState(nextTasks, lastUpdated)) {
    render();
    return;
  }
  tasks = nextTasks;
  document.getElementById('lastUpdate').textContent = lastUpdated;
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const status = field('status').value;
  const data = {
    borrower: field('borrower').value.trim(),
    file: field('file').value.trim(),
    details: field('details').value.trim(),
    status,
    timeStarted: field('timeStarted').value
  };
  const nextTasks = editing
    ? tasks.map(task => task.id === editing.id ? { ...task, ...data } : task)
    : [{ id: Math.max(0, ...tasks.map(task => task.id)) + 1, ...data }, ...tasks];
  const lastUpdated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  if (!saveState(nextTasks, lastUpdated)) return;
  tasks = nextTasks;
  closeModal();
  page = 1;
  document.getElementById('lastUpdate').textContent = lastUpdated;
  render();
});

document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    if (link.dataset.view === 'settings') {
      alert(`${link.textContent.trim()} page is a placeholder in this demo.`);
      return;
    }
    document.querySelectorAll('nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
    const isDashboard = link.dataset.view === 'dashboard';
    document.getElementById('dashboardView').hidden = !isDashboard;
    document.getElementById('logsView').hidden = isDashboard;
    showRecentlyDeleted(false);
    if (!isDashboard) {
      filter = 'All';
      document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === 'All'));
    }
    render();
  });
});

document.getElementById('viewLogsBtn').addEventListener('click', () => {
  document.querySelector('nav a[data-view="tasks"]').click();
});

render();
