import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';

const UID = process.env.BILIBILI_UID || '3494372658121066';
const URL = `https://space.bilibili.com/${UID}/dynamic`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getExistingIds() {
  if (!existsSync('dynamic.json')) return new Set();
  try {
    const data = JSON.parse(readFileSync('dynamic.json', 'utf-8'));
    return new Set(data.dynamics.map((d) => d.id));
  } catch {
    return new Set();
  }
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
});

const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});

const page = await context.newPage();
page.setDefaultTimeout(30000);

const MAX_RETRIES = 2;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  if (attempt > 1) {
    console.warn(`Retry ${attempt}/${MAX_RETRIES}...`);
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 }).catch(() => {
      console.warn(`Navigation timeout on retry ${attempt}, continuing...`);
    });
  } else {
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 }).catch(() => {
      console.warn('Navigation timeout, continuing...');
    });
  }

  await page.waitForSelector('.bili-dyn-list__item', { timeout: 20000 }).catch(() => {
    console.warn(`Dynamic items not found (attempt ${attempt}), page may have changed.`);
  });

  await sleep(2000);

  const dynamics = await page.evaluate(() => {
    const items = document.querySelectorAll('.bili-dyn-list__item');
    return Array.from(items).map((item) => {
      const tagText =
        item.querySelector('.bili-dyn-tag__text')?.textContent?.trim() || '';
      const forwDesc = item.querySelector('.bili-dyn-content__forw__desc');
      const videoCard = item.querySelector('.bili-dyn-card-video');
      const opusEl = item.querySelector('[data-url*="/opus/"]');
      const videoLink = item.querySelector('a[href*="/video/"]');

      let type = '动态';
      if (tagText === '置顶') type = '置顶';
      else if (forwDesc) type = '转发';
      else if (videoCard) type = '视频';

      let id = '';
      if (opusEl) {
        const dataUrl = opusEl.getAttribute('data-url') || '';
        id = dataUrl.split('/opus/')[1]?.split('?')[0] || '';
      }
      if (!id && videoLink) {
        const href = videoLink.getAttribute('href') || '';
        const bvMatch = href.match(/BV\w+/);
        if (bvMatch) id = bvMatch[0];
      }

      const content =
        item
          .querySelector('.bili-dyn-content')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() || '';

      const time =
        item.querySelector('.bili-dyn-time')?.textContent?.trim() || '';

      let url = '';
      if (id) {
        url = id.startsWith('BV')
          ? `https://www.bilibili.com/video/${id}`
          : `https://www.bilibili.com/opus/${id}`;
      }

      return { id, type, content, time, url };
    });
  });

  if (dynamics.length === 0) {
    if (attempt < MAX_RETRIES) {
      console.warn('No dynamics loaded, waiting 5s before retry...');
      await sleep(5000);
      continue;
    }
    console.log('No dynamics found, skipping update.');
    await browser.close();
    process.exit(0);
  }

  const existingIds = getExistingIds();
  const newDynamics = dynamics.filter((d) => d.id && !existingIds.has(d.id));

  if (newDynamics.length === 0) {
    console.log('No new dynamics (all IDs already in dynamic.json).');
  } else {
    console.log(`Found ${newDynamics.length} new dynamic(s):`);
    for (const d of newDynamics) {
      console.log(`  [${d.type}] ${d.content.slice(0, 60)}`);
      console.log(`    ${d.url}`);
    }
  }

  const output = {
    uid: UID,
    fetched_at: new Date().toISOString(),
    count: dynamics.length,
    dynamics,
  };

  writeFileSync('dynamic.json', JSON.stringify(output, null, 2));
  console.log(`Updated dynamic.json (${dynamics.length} dynamics total).`);
  await browser.close();
  process.exit(0);
}

await browser.close();
