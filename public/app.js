const state = {
  lists: [],
  currentListId: null,
  items: [],
};

const el = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarClose: document.getElementById('sidebarClose'),
  listNav: document.getElementById('listNav'),
  newListForm: document.getElementById('newListForm'),
  newListName: document.getElementById('newListName'),
  listStatus: document.getElementById('listStatus'),
  currentListName: document.getElementById('currentListName'),
  renameListBtn: document.getElementById('renameListBtn'),
  deleteListBtn: document.getElementById('deleteListBtn'),
  addItemForm: document.getElementById('addItemForm'),
  productUrl: document.getElementById('productUrl'),
  addStatus: document.getElementById('addStatus'),
  itemsGrid: document.getElementById('itemsGrid'),
  emptyState: document.getElementById('emptyState'),
  noListState: document.getElementById('noListState'),
  totalBar: document.getElementById('totalBar'),
  totalCount: document.getElementById('totalCount'),
  totalAmount: document.getElementById('totalAmount'),
};

const desktopQuery = window.matchMedia('(min-width: 901px)');
const SIDEBAR_PREF_KEY = 'scoop:sidebarOpen';

function isDesktop() {
  return desktopQuery.matches;
}

function getStoredSidebarOpen() {
  const stored = localStorage.getItem(SIDEBAR_PREF_KEY);
  return stored === null ? true : stored === 'true';
}

let sidebarOpen = isDesktop() ? getStoredSidebarOpen() : false;

function applySidebarState() {
  el.sidebar.classList.toggle('open', sidebarOpen);
  el.sidebarBackdrop.classList.toggle('visible', sidebarOpen && !isDesktop());
}

function openSidebar() {
  sidebarOpen = true;
  if (isDesktop()) localStorage.setItem(SIDEBAR_PREF_KEY, 'true');
  applySidebarState();
}

function closeSidebar() {
  sidebarOpen = false;
  if (isDesktop()) localStorage.setItem(SIDEBAR_PREF_KEY, 'false');
  applySidebarState();
}

function toggleSidebar() {
  if (sidebarOpen) closeSidebar();
  else openSidebar();
}

applySidebarState();
el.sidebarToggle.addEventListener('click', toggleSidebar);
el.sidebarClose.addEventListener('click', closeSidebar);
el.sidebarBackdrop.addEventListener('click', closeSidebar);
desktopQuery.addEventListener('change', applySidebarState);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '–';
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(
      amount
    );
  } catch {
    return `${amount.toFixed(2)} ${currency || ''}`.trim();
  }
}

async function loadLists() {
  state.lists = await api('/api/lists');
  renderListNav();

  if (!state.currentListId && state.lists.length > 0) {
    selectList(state.lists[0].id);
  } else if (state.currentListId) {
    if (!state.lists.some((l) => l.id === state.currentListId)) {
      state.currentListId = state.lists[0]?.id || null;
    }
    renderHeader();
    if (state.currentListId) await loadItems();
  } else {
    renderHeader();
  }
}

function renderListNav() {
  el.listNav.innerHTML = '';
  for (const list of state.lists) {
    const item = document.createElement('div');
    item.className = 'list-nav-item' + (list.id === state.currentListId ? ' active' : '');
    item.innerHTML = `<span>${escapeHtml(list.name)}</span><span class="count">${list.itemCount}</span>`;
    item.addEventListener('click', () => selectList(list.id));
    el.listNav.appendChild(item);
  }
}

async function selectList(id) {
  state.currentListId = id;
  renderListNav();
  renderHeader();
  await loadItems();
  if (!isDesktop()) closeSidebar();
}

function renderHeader() {
  const list = state.lists.find((l) => l.id === state.currentListId);
  const hasList = Boolean(list);

  el.currentListName.textContent = list ? list.name : 'Willkommen';
  el.renameListBtn.hidden = !hasList;
  el.deleteListBtn.hidden = !hasList;
  el.addItemForm.hidden = !hasList;
  el.noListState.hidden = hasList;
  el.totalBar.hidden = !hasList;
}

async function loadItems() {
  if (!state.currentListId) {
    state.items = [];
    renderItems();
    return;
  }
  state.items = await api(`/api/lists/${state.currentListId}/items`);
  renderItems();
}

function renderItems() {
  el.itemsGrid.innerHTML = '';
  el.emptyState.hidden = state.items.length > 0 || !state.currentListId;

  for (const item of state.items) {
    el.itemsGrid.appendChild(renderItemCard(item));
  }
  renderTotal();
}

function renderItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'item-image-wrap';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      imageWrap.innerHTML = '<span class="placeholder">🛒</span>';
    });
    imageWrap.appendChild(img);
  } else {
    imageWrap.innerHTML = '<span class="placeholder">🛒</span>';
  }

  const body = document.createElement('div');
  body.className = 'item-body';

  const title = document.createElement('a');
  title.className = 'item-title';
  title.href = item.url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = item.title || item.url;

  const priceRow = document.createElement('div');
  priceRow.className = 'item-price-row';

  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.step = '0.01';
  priceInput.min = '0';
  priceInput.placeholder = 'Preis';
  priceInput.value = item.price ?? '';
  priceInput.addEventListener('change', async () => {
    const value = priceInput.value === '' ? null : parseFloat(priceInput.value);
    try {
      const updated = await api(`/api/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ price: value }),
      });
      item.price = updated.price;
      renderTotal();
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  const currency = document.createElement('span');
  currency.className = 'item-currency';
  currency.textContent = item.currency || 'EUR';

  priceRow.appendChild(priceInput);
  priceRow.appendChild(currency);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⟳ Aktualisieren';
  refreshBtn.title = 'Bild/Preis neu vom Link laden';
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await api(`/api/items/${item.id}/refresh`, { method: 'POST' });
      await loadItems();
    } catch (err) {
      showStatus(err.message, true);
    } finally {
      refreshBtn.disabled = false;
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '✕ Entfernen';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Dieses Produkt aus der Liste entfernen?')) return;
    await api(`/api/items/${item.id}`, { method: 'DELETE' });
    await Promise.all([loadItems(), loadLists()]);
  });

  actions.appendChild(refreshBtn);
  actions.appendChild(deleteBtn);

  body.appendChild(title);
  body.appendChild(priceRow);
  body.appendChild(actions);

  card.appendChild(imageWrap);
  card.appendChild(body);
  return card;
}

function renderTotal() {
  const priced = state.items.filter((i) => typeof i.price === 'number');
  const currencies = new Set(priced.map((i) => i.currency || 'EUR'));
  const total = priced.reduce((sum, i) => sum + i.price, 0);
  const currency = currencies.size === 1 ? [...currencies][0] : 'EUR';

  el.totalCount.textContent = `${state.items.length} Artikel${
    priced.length !== state.items.length ? ` (${state.items.length - priced.length} ohne Preis)` : ''
  }${currencies.size > 1 ? ' · gemischte Währungen' : ''}`;
  el.totalAmount.textContent = formatMoney(total, currency);
}

function showStatus(message, isError = false, target = el.addStatus) {
  target.textContent = message;
  target.classList.toggle('error', isError);
  if (message) {
    setTimeout(() => {
      if (target.textContent === message) target.textContent = '';
    }, 5000);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

el.newListForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = el.newListName.value.trim();
  if (!name) return;

  const submitBtn = el.newListForm.querySelector('button');
  submitBtn.disabled = true;
  try {
    const list = await api('/api/lists', { method: 'POST', body: JSON.stringify({ name }) });
    el.newListName.value = '';
    showStatus('', false, el.listStatus);
    await loadLists();
    selectList(list.id);
  } catch (err) {
    showStatus(err.message, true, el.listStatus);
  } finally {
    submitBtn.disabled = false;
  }
});

el.renameListBtn.addEventListener('click', async () => {
  const list = state.lists.find((l) => l.id === state.currentListId);
  if (!list) return;
  const name = prompt('Neuer Listenname:', list.name);
  if (!name || !name.trim()) return;
  await api(`/api/lists/${list.id}`, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
  await loadLists();
});

el.deleteListBtn.addEventListener('click', async () => {
  const list = state.lists.find((l) => l.id === state.currentListId);
  if (!list) return;
  if (!confirm(`Liste "${list.name}" inklusive aller Produkte löschen?`)) return;
  await api(`/api/lists/${list.id}`, { method: 'DELETE' });
  state.currentListId = null;
  await loadLists();
});

el.addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = el.productUrl.value.trim();
  if (!url || !state.currentListId) return;

  const submitBtn = el.addItemForm.querySelector('button');
  submitBtn.disabled = true;
  showStatus('Lade Produktinformationen…');

  try {
    const { item, scrapeError } = await api(`/api/lists/${state.currentListId}/items`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    el.productUrl.value = '';
    showStatus(
      scrapeError
        ? `Hinzugefügt, aber Bild/Preis konnten nicht automatisch geladen werden (${scrapeError}). Bitte manuell ergänzen.`
        : ''
    );
    await Promise.all([loadItems(), loadLists()]);
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

loadLists().catch((err) => showStatus(err.message, true));
