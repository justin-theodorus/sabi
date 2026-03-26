#!/usr/bin/env node
/**
 * One-time script to pre-fetch ARASAAC pictogram icons.
 * Run: node scripts/fetch-icons.js
 * Output: frontend/public/icons/{category}/{keyword}.png
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ICONS = {
  core_words: ['want', 'go', 'stop', 'help', 'more', 'yes', 'no', 'please', 'finished', 'now', 'here', 'what', 'who', 'like', 'i', 'you'],
  social: ['hi', 'bye', 'thank-you', 'excuse-me', 'sorry', 'good', 'great', 'ok', 'wait', 'understand', 'see-you', 'help-me', 'nice-to-meet-you', 'how-are-you', 'good-morning', 'dont-understand'],
  emotions: ['happy', 'sad', 'angry', 'scared', 'confused', 'excited', 'tired', 'surprised', 'love', 'proud', 'nervous', 'calm', 'bored', 'sick', 'fine', 'frustrated'],
};

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'icons');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchIcon(keyword, category) {
  const searchKeyword = keyword.replace(/-/g, ' ');
  const searchUrl = `https://api.arasaac.org/api/pictograms/en/search/${encodeURIComponent(searchKeyword)}`;

  try {
    const searchRes = await get(searchUrl);
    if (searchRes.status !== 200) {
      console.warn(`  SKIP ${keyword}: search returned ${searchRes.status}`);
      return false;
    }

    const results = JSON.parse(searchRes.body.toString());
    if (!results || results.length === 0) {
      console.warn(`  SKIP ${keyword}: no results`);
      return false;
    }

    const id = results[0]._id;
    const imgUrl = `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
    const imgRes = await get(imgUrl);

    if (imgRes.status !== 200) {
      console.warn(`  SKIP ${keyword}: image returned ${imgRes.status}`);
      return false;
    }

    const catDir = path.join(OUT_DIR, category);
    fs.mkdirSync(catDir, { recursive: true });
    fs.writeFileSync(path.join(catDir, `${keyword}.png`), imgRes.body);
    console.log(`  OK  ${category}/${keyword}.png (id=${id})`);
    return true;
  } catch (err) {
    console.warn(`  ERR ${keyword}: ${err.message}`);
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0, fail = 0;

  for (const [category, keywords] of Object.entries(ICONS)) {
    console.log(`\n[${category}]`);
    for (const keyword of keywords) {
      const success = await fetchIcon(keyword, category);
      if (success) ok++; else fail++;
      // Small delay to be polite to the API
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\nDone: ${ok} fetched, ${fail} skipped/failed`);
}

main().catch(console.error);
