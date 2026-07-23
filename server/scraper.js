const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

const BOT_BLOCK_PATTERNS = [
  /captcha/i,
  /enter the characters you see/i,
  /robot check/i,
  /pardon our interruption/i,
  /are you a human/i,
  /automated access/i,
  /unusual traffic/i,
  /access to this page has been denied/i,
  /request blocked/i,
  /verify you are a human/i,
];

function looksBotBlocked(html) {
  const sample = html.slice(0, 20000);
  return BOT_BLOCK_PATTERNS.some((pattern) => pattern.test(sample));
}

function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Strip everything except digits, separators and minus sign.
  const cleaned = str.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "1.299,90").
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1 && lastDot > lastComma) {
    // Dot is the decimal separator (e.g. "1,299.90").
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function findJsonLdOffer($) {
  let result = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result) return;
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const candidates = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
    for (const node of candidates) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) continue;

      let offers = node.offers;
      if (Array.isArray(offers)) offers = offers[0];

      const price = offers?.price ?? offers?.priceSpecification?.price;
      const currency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
      const image = Array.isArray(node.image) ? node.image[0] : node.image;

      if (price !== undefined || node.name || image) {
        result = {
          title: node.name || null,
          image: image || null,
          price: parsePrice(price),
          currency: currency || null,
        };
        break;
      }
    }
  });
  return result;
}

function meta($, ...selectors) {
  for (const sel of selectors) {
    const val = $(sel).attr('content');
    if (val) return val;
  }
  return null;
}

function text($, ...selectors) {
  for (const sel of selectors) {
    const val = $(sel).first().text().trim();
    if (val) return val;
  }
  return null;
}

function attr($, selector, ...attrs) {
  const el = $(selector).first();
  if (!el.length) return null;
  for (const a of attrs) {
    const val = el.attr(a);
    if (val) return val;
  }
  return null;
}

// Amazon and eBay rarely expose price through standard meta tags or
// JSON-LD, so we fall back to their known page structure when the
// generic extraction above comes up short. These selectors are
// best-effort and may need updates if the sites change their markup.
const SITE_EXTRACTORS = {
  'amazon.': ($) => ({
    title: text($, '#productTitle'),
    price: parsePrice(
      text(
        $,
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice'
      )
    ),
    image: (() => {
      const dynamic = attr($, '#landingImage', 'data-old-hires');
      if (dynamic) return dynamic;
      const dynamicJson = attr($, '#landingImage', 'data-a-dynamic-image');
      if (dynamicJson) {
        try {
          const urls = Object.keys(JSON.parse(dynamicJson));
          if (urls[0]) return urls[0];
        } catch {
          // ignore malformed attribute
        }
      }
      return attr($, '#landingImage, #imgTagWrapperId img', 'src');
    })(),
  }),
  'ebay.': ($) => ({
    title: text($, 'h1.x-item-title__mainTitle span.ux-textspans', '.x-item-title__mainTitle'),
    price: parsePrice(
      text($, '.x-price-primary .ux-textspans', '[itemprop="price"]') ||
        attr($, '[itemprop="price"]', 'content')
    ),
    image: attr($, '.ux-image-carousel-item img, #icImg', 'src'),
  }),
};

async function scrapeProduct(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let html;
  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  const jsonLd = findJsonLdOffer($) || {};

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    // already validated by the caller; ignore here
  }
  const siteKey = Object.keys(SITE_EXTRACTORS).find((k) => hostname.includes(k));
  let site = {};
  if (siteKey) {
    try {
      site = SITE_EXTRACTORS[siteKey]($);
    } catch {
      site = {};
    }
  }

  const metaTitle = meta($, 'meta[property="og:title"]', 'meta[name="twitter:title"]');
  const bareTitle = $('title').first().text().trim();
  // JSON-LD and known-site selectors are curated/structured, so they take
  // priority over generic meta tags, and the bare <title> tag is the
  // weakest signal (also picks up junk like "Robot Check" on block pages).
  const title = jsonLd.title || site.title || metaTitle || bareTitle || null;

  const image =
    jsonLd.image ||
    site.image ||
    meta($, 'meta[property="og:image"]', 'meta[name="twitter:image"]') ||
    null;

  let price = jsonLd.price ?? site.price ?? null;
  if (price === null) {
    const priceRaw = meta(
      $,
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]'
    );
    price = parsePrice(priceRaw ?? $('[itemprop="price"]').first().attr('content') ?? $('[itemprop="price"]').first().text());
  }

  let currency = jsonLd.currency;
  if (!currency) {
    currency = meta(
      $,
      'meta[property="product:price:currency"]',
      'meta[property="og:price:currency"]',
      'meta[itemprop="priceCurrency"]'
    );
  }

  const result = {
    title: title ? title.slice(0, 300) : null,
    image: image || null,
    price: price ?? null,
    currency: currency || null,
  };

  if (result.price === null && !result.image && looksBotBlocked(html)) {
    throw new Error('Bot-Schutz der Seite erkannt (Zugriff blockiert)');
  }

  return result;
}

module.exports = { scrapeProduct, parsePrice };
