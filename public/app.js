const state = {
  lists: [],
  currentListId: null,
  items: [],
  editingItemId: null,
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
  productQuantity: document.getElementById('productQuantity'),
  addStatus: document.getElementById('addStatus'),
  itemsGrid: document.getElementById('itemsGrid'),
  emptyState: document.getElementById('emptyState'),
  noListState: document.getElementById('noListState'),
  totalBar: document.getElementById('totalBar'),
  totalCount: document.getElementById('totalCount'),
  totalAmount: document.getElementById('totalAmount'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  bookmarkletBtn: document.getElementById('bookmarkletBtn'),
  bookmarkletModal: document.getElementById('bookmarkletModal'),
  bookmarkletLink: document.getElementById('bookmarkletLink'),
  bookmarkletCloseBtn: document.getElementById('bookmarkletCloseBtn'),
  quickAddModal: document.getElementById('quickAddModal'),
  quickAddForm: document.getElementById('quickAddForm'),
  quickAddList: document.getElementById('quickAddList'),
  quickAddTitle: document.getElementById('quickAddTitle'),
  quickAddImage: document.getElementById('quickAddImage'),
  quickAddPrice: document.getElementById('quickAddPrice'),
  quickAddCurrency: document.getElementById('quickAddCurrency'),
  quickAddQuantity: document.getElementById('quickAddQuantity'),
  quickAddStatus: document.getElementById('quickAddStatus'),
  quickAddCancelBtn: document.getElementById('quickAddCancelBtn'),
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
    el.itemsGrid.appendChild(
      item.id === state.editingItemId ? renderItemEditForm(item) : renderItemCard(item)
    );
  }
  renderTotal();
}

function renderItemEditForm(item) {
  const card = document.createElement('div');
  card.className = 'item-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'item-image-wrap';
  const preview = document.createElement('img');
  preview.alt = '';
  preview.hidden = !item.image;
  if (item.image) preview.src = item.image;
  const placeholder = document.createElement('span');
  placeholder.className = 'placeholder';
  placeholder.textContent = '🛒';
  placeholder.hidden = Boolean(item.image);
  imageWrap.appendChild(preview);
  imageWrap.appendChild(placeholder);

  const form = document.createElement('form');
  form.className = 'item-edit-form';

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Titel';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = item.title || '';
  titleLabel.appendChild(titleInput);

  const imageLabel = document.createElement('label');
  imageLabel.textContent = 'Bild-URL';
  const imageInput = document.createElement('input');
  imageInput.type = 'url';
  imageInput.placeholder = 'https://…';
  imageInput.value = item.image || '';
  imageInput.addEventListener('input', () => {
    const url = imageInput.value.trim();
    if (url) {
      preview.src = url;
      preview.hidden = false;
      placeholder.hidden = true;
    } else {
      preview.hidden = true;
      placeholder.hidden = false;
    }
  });
  preview.addEventListener('error', () => {
    preview.hidden = true;
    placeholder.hidden = false;
  });
  imageLabel.appendChild(imageInput);

  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'Produkt-Link';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.required = true;
  urlInput.value = item.url || '';
  urlLabel.appendChild(urlInput);

  const priceRow = document.createElement('div');
  priceRow.className = 'item-price-row';
  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.step = '0.01';
  priceInput.min = '0';
  priceInput.placeholder = 'Preis';
  priceInput.value = item.price ?? '';
  const currencyInput = document.createElement('input');
  currencyInput.type = 'text';
  currencyInput.className = 'item-currency-input';
  currencyInput.maxLength = 3;
  currencyInput.value = item.currency || 'EUR';
  priceRow.appendChild(priceInput);
  priceRow.appendChild(currencyInput);
  const priceLabel = document.createElement('label');
  priceLabel.textContent = 'Preis';
  priceLabel.appendChild(priceRow);

  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = 'Menge';
  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.step = '1';
  quantityInput.min = '1';
  quantityInput.value = item.quantity ?? 1;
  quantityLabel.appendChild(quantityInput);

  const editStatus = document.createElement('p');
  editStatus.className = 'status-msg';

  const actions = document.createElement('div');
  actions.className = 'item-edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Speichern';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-ghost';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.addEventListener('click', () => {
    state.editingItemId = null;
    renderItems();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;
    saveBtn.disabled = true;
    try {
      await api(`/api/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: titleInput.value.trim(),
          image: imageInput.value.trim() || null,
          url,
          price: priceInput.value === '' ? null : parseFloat(priceInput.value),
          currency: currencyInput.value.trim() || 'EUR',
          quantity: quantityInput.value,
        }),
      });
      state.editingItemId = null;
      await Promise.all([loadItems(), loadLists()]);
    } catch (err) {
      showStatus(err.message, true, editStatus);
      saveBtn.disabled = false;
    }
  });

  form.appendChild(titleLabel);
  form.appendChild(imageLabel);
  form.appendChild(urlLabel);
  form.appendChild(priceLabel);
  form.appendChild(quantityLabel);
  form.appendChild(editStatus);
  form.appendChild(actions);

  card.appendChild(imageWrap);
  card.appendChild(form);
  return card;
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
  priceRow.className = 'item-price-row item-price-row-view';

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

  const qtyTimes = document.createElement('span');
  qtyTimes.className = 'item-qty-times';
  qtyTimes.textContent = '×';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'item-qty-input';
  qtyInput.step = '1';
  qtyInput.min = '1';
  qtyInput.title = 'Menge';
  qtyInput.value = item.quantity ?? 1;
  qtyInput.addEventListener('change', async () => {
    try {
      const updated = await api(`/api/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: qtyInput.value }),
      });
      item.quantity = updated.quantity;
      qtyInput.value = updated.quantity;
      renderTotal();
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  priceRow.appendChild(priceInput);
  priceRow.appendChild(currency);
  priceRow.appendChild(qtyTimes);
  priceRow.appendChild(qtyInput);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const editBtn = document.createElement('button');
  editBtn.textContent = '✎';
  editBtn.setAttribute('aria-label', 'Bearbeiten');
  editBtn.title = 'Titel, Bild oder Preis manuell eintragen';
  editBtn.addEventListener('click', () => {
    state.editingItemId = item.id;
    renderItems();
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⟳';
  refreshBtn.setAttribute('aria-label', 'Aktualisieren');
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
  deleteBtn.textContent = '✕';
  deleteBtn.className = 'item-action-danger';
  deleteBtn.setAttribute('aria-label', 'Entfernen');
  deleteBtn.title = 'Aus der Liste entfernen';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Dieses Produkt aus der Liste entfernen?')) return;
    await api(`/api/items/${item.id}`, { method: 'DELETE' });
    await Promise.all([loadItems(), loadLists()]);
  });

  actions.appendChild(editBtn);
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
  const total = priced.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
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
      body: JSON.stringify({ url, quantity: el.productQuantity.value }),
    });
    el.productUrl.value = '';
    el.productQuantity.value = 1;
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

// --- Quick-Add bookmarklet -------------------------------------------

function buildBookmarkletHref() {
  const src = `
    (function(){
      function pick(sels){
        for (var i = 0; i < sels.length; i++) {
          var e = document.querySelector(sels[i]);
          if (!e) continue;
          var v = e.getAttribute('content') || e.getAttribute('data-old-hires') || e.getAttribute('src') || e.textContent;
          if (v && v.trim()) return v.trim();
        }
        return '';
      }
      var title = pick(['#productTitle', 'h1.x-item-title__mainTitle .ux-textspans', 'meta[property="og:title"]']) || document.title || '';
      var image = pick(['#landingImage', '.ux-image-carousel-item img', '#icImg', 'meta[property="og:image"]']) || '';
      var price = pick(['#corePrice_feature_div .a-price .a-offscreen', '.a-price .a-offscreen', '.x-price-primary .ux-textspans', 'meta[property="product:price:amount"]', 'meta[property="og:price:amount"]', '[itemprop="price"]']) || '';
      var params = new URLSearchParams();
      params.set('add', '1');
      params.set('url', location.href);
      if (title) params.set('title', title.slice(0, 300));
      if (image) params.set('image', image);
      if (price) params.set('price', price);
      window.open('${window.location.origin}/?' + params.toString(), '_blank');
    })();
  `.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(src)}`;
}

function openModal(modal) {
  el.modalBackdrop.hidden = false;
  modal.hidden = false;
}

function closeModals() {
  el.modalBackdrop.hidden = true;
  el.bookmarkletModal.hidden = true;
  el.quickAddModal.hidden = true;
}

el.bookmarkletLink.href = buildBookmarkletHref();
el.bookmarkletBtn.addEventListener('click', () => openModal(el.bookmarkletModal));
el.bookmarkletCloseBtn.addEventListener('click', closeModals);
el.modalBackdrop.addEventListener('click', closeModals);

function populateQuickAddListSelect() {
  el.quickAddList.innerHTML = '';
  for (const list of state.lists) {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = list.name;
    el.quickAddList.appendChild(option);
  }
  if (state.currentListId) el.quickAddList.value = state.currentListId;
}

function checkPendingQuickAdd() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('add') !== '1') return;

  const url = params.get('url') || '';
  const title = params.get('title') || '';
  const image = params.get('image') || '';
  const price = params.get('price') || '';
  history.replaceState(null, '', window.location.pathname);

  if (!url) return;
  if (state.lists.length === 0) {
    showStatus('Bitte zuerst eine Liste anlegen, dann den Bookmarklet-Link erneut verwenden.', true, el.addStatus);
    return;
  }

  el.quickAddForm.dataset.url = url;
  populateQuickAddListSelect();
  el.quickAddTitle.value = title;
  el.quickAddImage.value = image;
  el.quickAddPrice.value = price ? (parseGermanOrUsPrice(price) ?? '') : '';
  el.quickAddCurrency.value = 'EUR';
  el.quickAddQuantity.value = 1;
  showStatus('', false, el.quickAddStatus);
  openModal(el.quickAddModal);
}

function parseGermanOrUsPrice(raw) {
  const cleaned = String(raw).replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized;
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, '');
  else normalized = cleaned.replace(/,/g, '');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

el.quickAddCancelBtn.addEventListener('click', closeModals);

el.quickAddForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const listId = el.quickAddList.value;
  const url = el.quickAddForm.dataset.url;
  if (!listId || !url) return;

  const submitBtn = el.quickAddForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await api(`/api/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        url,
        manual: true,
        title: el.quickAddTitle.value.trim(),
        image: el.quickAddImage.value.trim() || null,
        price: el.quickAddPrice.value === '' ? null : parseFloat(el.quickAddPrice.value),
        currency: el.quickAddCurrency.value.trim() || 'EUR',
        quantity: el.quickAddQuantity.value,
      }),
    });
    closeModals();
    if (listId !== state.currentListId) {
      await loadLists();
      selectList(listId);
    } else {
      await Promise.all([loadItems(), loadLists()]);
    }
  } catch (err) {
    showStatus(err.message, true, el.quickAddStatus);
  } finally {
    submitBtn.disabled = false;
  }
});

loadLists()
  .then(checkPendingQuickAdd)
  .catch((err) => showStatus(err.message, true));
