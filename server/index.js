const path = require('path');
const express = require('express');
const store = require('./store');
const { scrapeProduct, parsePrice } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function notFound(res, what) {
  return res.status(404).json({ error: `${what} not found` });
}

// --- Lists -----------------------------------------------------------

app.get('/api/lists', (req, res) => {
  const data = store.load();
  const lists = data.lists.map((list) => {
    const items = data.items.filter((item) => item.listId === list.id);
    const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
    return { ...list, itemCount: items.length, total };
  });
  res.json(lists);
});

app.post('/api/lists', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const data = store.load();
  const list = { id: store.id(), name, createdAt: new Date().toISOString() };
  data.lists.push(list);
  store.save(data);
  res.status(201).json(list);
});

app.put('/api/lists/:id', (req, res) => {
  const data = store.load();
  const list = data.lists.find((l) => l.id === req.params.id);
  if (!list) return notFound(res, 'List');

  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  list.name = name;
  store.save(data);
  res.json(list);
});

app.delete('/api/lists/:id', (req, res) => {
  const data = store.load();
  const exists = data.lists.some((l) => l.id === req.params.id);
  if (!exists) return notFound(res, 'List');

  data.lists = data.lists.filter((l) => l.id !== req.params.id);
  data.items = data.items.filter((i) => i.listId !== req.params.id);
  store.save(data);
  res.status(204).end();
});

// --- Items -------------------------------------------------------------

app.get('/api/lists/:id/items', (req, res) => {
  const data = store.load();
  const list = data.lists.find((l) => l.id === req.params.id);
  if (!list) return notFound(res, 'List');

  const items = data.items.filter((item) => item.listId === req.params.id);
  res.json(items);
});

app.post('/api/lists/:id/items', async (req, res) => {
  const data = store.load();
  const list = data.lists.find((l) => l.id === req.params.id);
  if (!list) return notFound(res, 'List');

  const url = (req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'url must be a valid URL' });
  }

  let scraped = { title: null, image: null, price: null, currency: null };
  let scrapeError = null;
  if (req.body?.manual) {
    // Data captured client-side (e.g. via the quick-add bookmarklet) from
    // the real, already-rendered page — skip the server-side scrape.
    const rawPrice = req.body.price;
    scraped = {
      title: req.body.title ? String(req.body.title).trim().slice(0, 300) : null,
      image: req.body.image ? String(req.body.image).trim() : null,
      price: typeof rawPrice === 'number' ? rawPrice : parsePrice(rawPrice),
      currency: req.body.currency ? String(req.body.currency).trim() : null,
    };
  } else {
    try {
      scraped = await scrapeProduct(url);
    } catch (err) {
      scrapeError = err.message;
    }
  }

  const item = {
    id: store.id(),
    listId: list.id,
    url,
    title: scraped.title || url,
    image: scraped.image,
    price: scraped.price,
    currency: scraped.currency || 'EUR',
    createdAt: new Date().toISOString(),
  };

  data.items.push(item);
  store.save(data);
  res.status(201).json({ item, scrapeError });
});

app.put('/api/items/:id', (req, res) => {
  const data = store.load();
  const item = data.items.find((i) => i.id === req.params.id);
  if (!item) return notFound(res, 'Item');

  const { title, image, price, currency, url } = req.body || {};
  if (title !== undefined) item.title = String(title).slice(0, 300);
  if (image !== undefined) item.image = image || null;
  if (url !== undefined) item.url = url;
  if (currency !== undefined) item.currency = currency || 'EUR';
  if (price !== undefined) {
    const parsed = typeof price === 'number' ? price : parsePrice(price);
    item.price = parsed;
  }

  store.save(data);
  res.json(item);
});

app.post('/api/items/:id/refresh', async (req, res) => {
  const data = store.load();
  const item = data.items.find((i) => i.id === req.params.id);
  if (!item) return notFound(res, 'Item');

  try {
    const scraped = await scrapeProduct(item.url);
    if (scraped.title) item.title = scraped.title;
    if (scraped.image) item.image = scraped.image;
    if (scraped.price !== null) item.price = scraped.price;
    if (scraped.currency) item.currency = scraped.currency;
    store.save(data);
    res.json(item);
  } catch (err) {
    res.status(502).json({ error: `Could not refresh item: ${err.message}` });
  }
});

app.delete('/api/items/:id', (req, res) => {
  const data = store.load();
  const exists = data.items.some((i) => i.id === req.params.id);
  if (!exists) return notFound(res, 'Item');

  data.items = data.items.filter((i) => i.id !== req.params.id);
  store.save(data);
  res.status(204).end();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Scoop listening on port ${PORT}`);
});
