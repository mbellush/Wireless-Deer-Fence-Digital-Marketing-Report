// ═══════════════════════════════════════════════
//  WDF DASHBOARD  –  data.js
//  Default data + CSV parsers
// ═══════════════════════════════════════════════

const DEFAULT_DATA = {
  period: "January 2026",
  reportDate: "January 2026",      // shown on Organic Rankings
  dateStart: "January 1, 2026",    // parsed from CSVs
  dateEnd: "January 31, 2026",   // parsed from CSVs
  googleAds: {
    revenue: 6453, spend: 1414, impressions: 79873,
    clicks: 2371, roas: 4.56, cpa: 24.14, avgOrderValue: 110.14, conversions: 58,
    // Prior-period comparison values
    revenuePrior: 5820, spendPrior: 1280, impressionsPrior: 71200,
    clicksPrior: 2100, roasPrior: 4.55, cpaPrior: 26.50, conversionsPrior: 48
  },
  analytics: {
    mau: 41204, mauPrior: 32450, priorMonthName: "December",
    paidSocialImpressions: 26818, paidSocialImpressionsPrior: 22400,
    paidSocialSessions: 327, paidSocialSessionsPrior: 290,
    channels: [
      { name: "Paid Search", newUsers: 2371 },
      { name: "Organic Search", newUsers: 1500 },
      { name: "Direct", newUsers: 1200 },
      { name: "Organic Shopping", newUsers: 800 },
      { name: "Paid Social", newUsers: 327 },
      { name: "Referral", newUsers: 230 }
    ],
    topPages: [
      { title: "Wireless Deer Fence - Innovative Deer Repellent", views: 61448, users: 23823 },
      { title: "Deer Repellent - Wireless Deer Fence®", views: 20233, users: 8539 },
      { title: "How It Works - Wireless Deer Fence®", views: 9995, users: 4534 },
      { title: "Shop | The Wireless Deer Fence®", views: 9347, users: 3057 },
      { title: "Order Page - The Wireless Deer Fence®", views: 1957, users: 1373 },
      { title: "Shopping Cart - Wireless Deer Fence®", views: 1523, users: 1012 },
      { title: "Other Deer Control Methods", views: 285, users: 124 },
      { title: "Baited Electric Fence for Deer", views: 184, users: 92 },
      { title: "Urban and Suburban Deer Control", views: 182, users: 88 },
      { title: "Common Sense Deer Control", views: 92, users: 45 }
    ]
  },
  searchConsole: {
    avgPosition: 4.4, avgPositionPrior: 5.1,
    impressions: 5842, impressionsPrior: 4930,
    clicks: 221, clicksPrior: 188,
    ctr: 3.8, ctrPrior: 3.8,
    queries: [
      { query: "wireless deer fence", clicks: 168, impressions: 427, ctr: 39.3, position: 4.4 },
      { query: "deer repellent devices", clicks: 7, impressions: 658, ctr: 1.0, position: 14.8 },
      { query: "electric deer fence", clicks: 7, impressions: 341, ctr: 2.1, position: 14.7 },
      { query: "do deer eat potato plants", clicks: 5, impressions: 140, ctr: 3.5, position: 3.2 },
      { query: "do deer eat carrots", clicks: 4, impressions: 1693, ctr: 0.2, position: 1.6 }
    ]
  },
  organicRankings: [],
  execSummary: null
};

// ── Merge defaults into saved data (so new fields are never missing) ──
function mergeDefaults(saved, defaults) {
  const out = Object.assign({}, saved);
  for (const key of Object.keys(defaults)) {
    if (out[key] === undefined) {
      out[key] = JSON.parse(JSON.stringify(defaults[key]));
    } else if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && defaults[key] !== null) {
      out[key] = mergeDefaults(out[key] || {}, defaults[key]);
    }
  }
  return out;
}

// ── Load from localStorage or use defaults ──
let reportData = (() => {
  try {
    const saved = localStorage.getItem('wdfReportData');
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    return mergeDefaults(JSON.parse(saved), DEFAULT_DATA);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
})();

function saveReportData() {
  localStorage.setItem('wdfReportData', JSON.stringify(reportData));
}
function resetReportData() {
  localStorage.removeItem('wdfReportData');
  reportData = JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// ═══════════════════════════════════════════════
//  CSV UTILITIES
// ═══════════════════════════════════════════════

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function cleanNum(s) {
  if (s == null) return 0;
  return parseFloat(String(s).replace(/[$,%\s]/g, '').replace(/,/g, '')) || 0;
}

function colIdx(headers, patterns) {
  for (const p of patterns) {
    const re = new RegExp(p, 'i');
    const i = headers.findIndex(h => re.test(h));
    if (i !== -1) return i;
  }
  return -1;
}

// ── Extract date range from CSV metadata lines ──
// Google Ads CSVs have lines like: "# Start date: 2026-01-01" / "# End date: 2026-01-31"
// GSC CSVs have: "Dates: Jan 1, 2026 to Jan 31, 2026" etc.
function extractDateRange(lines) {
  let dateStart = null, dateEnd = null;

  // Only look in the first 10 lines (the metadata/comment block)
  // Stop as soon as we have BOTH start and end — prevents picking up comparison period dates
  for (const line of lines.slice(0, 10)) {
    if (dateStart && dateEnd) break;

    // ISO format: "# Start date: 2026-01-01" / "# End date: 2026-01-31"
    if (!dateStart) {
      const m = line.match(/start.*?(\d{4}-\d{2}-\d{2})/i);
      if (m) dateStart = formatDateFromISO(m[1]);
    }
    if (!dateEnd) {
      const m = line.match(/end.*?(\d{4}-\d{2}-\d{2})/i);
      if (m) dateEnd = formatDateFromISO(m[1]);
    }

    // Plain range on one line: "Feb 1, 2026 – Feb 28, 2026" or "... to ..."
    if (!dateStart || !dateEnd) {
      const r = line.match(/(\w+\s+\d{1,2},?\s+\d{4})\s*(?:\u2013|-|to)\s*(\w+\s+\d{1,2},?\s+\d{4})/i);
      if (r) {
        if (!dateStart) dateStart = r[1].replace(',', '').trim();
        if (!dateEnd) dateEnd = r[2].replace(',', '').trim();
      }
    }
  }
  return { dateStart, dateEnd };
}

function formatDateFromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${monthNames[m - 1]} ${d}, ${y}`;
}

// ═══════════════════════════════════════════════
//  GOOGLE ADS PARSER
// ═══════════════════════════════════════════════
function parseGoogleAds(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);

  // Try to extract date range from header comments
  const { dateStart, dateEnd } = extractDateRange(lines);

  let headers = [], headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const j = row.join(' ').toLowerCase();
    if ((j.includes('click') || j.includes('impr')) && j.includes('cost')) {
      headers = row.map(h => h.toLowerCase().replace(/[^a-z0-9\s.\/]/g, '').trim());
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) return { error: 'Could not find headers. Please export a Google Ads campaign performance report.' };

  const ci = {
    clicks: colIdx(headers, ['^clicks?$']),
    impr: colIdx(headers, ['^impr', '^impressions$']),
    cost: colIdx(headers, ['^cost$', '^spend$', '^amount spent']),
    revenue: colIdx(headers, ['conv.*value(?!\/)', '^revenue$', 'conversion value']),
    convs: colIdx(headers, ['^conv\\.?$', '^conversions$']),
    roas: colIdx(headers, ['^roas$', 'conv.*value.*cost', 'value.*cost']),
    cpa: colIdx(headers, ['cost.*conv', '^cpa$'])
  };

  let totals = null;
  for (let i = lines.length - 1; i > headerIdx; i--) {
    const row = parseCSVLine(lines[i]);
    if (row.length > 1 && /total/i.test(row[0])) { totals = row; break; }
  }
  if (!totals) {
    let sums = {};
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue;
      for (const [key, idx] of Object.entries(ci)) {
        if (idx >= 0) sums[key] = (sums[key] || 0) + cleanNum(row[idx]);
      }
    }
    totals = { _sums: sums };
  }

  const g = (key) => {
    if (totals._sums) return totals._sums[key] || 0;
    return ci[key] >= 0 ? cleanNum(totals[ci[key]]) : 0;
  };

  const clicks = g('clicks'), impressions = g('impr'), spend = g('cost');
  const revenue = g('revenue'), conversions = g('convs');
  const roas = ci.roas >= 0 && !totals._sums ? cleanNum(totals[ci.roas]) : (spend > 0 ? +(revenue / spend).toFixed(2) : 0);
  const cpa = ci.cpa >= 0 && !totals._sums ? cleanNum(totals[ci.cpa]) : (conversions > 0 ? +(spend / conversions).toFixed(2) : 0);
  const avgOrderValue = conversions > 0 ? +(revenue / conversions).toFixed(2) : 0;

  return { clicks, impressions, spend, revenue, conversions, roas, cpa, avgOrderValue, dateStart, dateEnd };
}

// ═══════════════════════════════════════════════
//  GA4 TRAFFIC ACQUISITION PARSER
//  Real GA4 format: Session primary channel group, Sessions, Key events, Total revenue
//  The CSV contains TWO data blocks: current period (first) and prior period (second)
// ═══════════════════════════════════════════════
function parseGA4Traffic(csvText) {
  const rawLines = csvText.split('\n').map(l => l.trim());

  // Extract date range from the first set of comment lines
  const { dateStart, dateEnd } = extractDateRange(rawLines);

  // Split into two data blocks — each has a # comment header then a data header row then data rows
  // A new block starts when we see "# Start date:" after an earlier data header was already found
  const blocks = [];
  let currentBlock = [];
  let foundFirstHeader = false;

  for (const line of rawLines) {
    if (!line) {
      if (currentBlock.length) { blocks.push(currentBlock); currentBlock = []; }
      continue;
    }
    if (line.startsWith('#')) {
      if (foundFirstHeader && currentBlock.length === 0) {
        // Starting a new comment block = new data section
      }
      currentBlock.push(line);
    } else {
      foundFirstHeader = true;
      currentBlock.push(line);
    }
  }
  if (currentBlock.length) blocks.push(currentBlock);

  // Parse a single data block — returns channel data + aggregate metrics
  function parseBlock(blockLines) {
    let headers = [], headerIdx = -1;
    for (let i = 0; i < blockLines.length; i++) {
      if (blockLines[i].startsWith('#')) continue;
      const row = parseCSVLine(blockLines[i]);
      const j = row.join(' ').toLowerCase();
      if (j.includes('session') || j.includes('channel') || j.includes('source')) {
        headers = row.map(h => h.toLowerCase().trim());
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return null;

    // Column indices — all available GA4 Traffic Acquisition columns
    const chCol = colIdx(headers, ['channel.group', 'channel group', 'default channel', 'source.*medium', 'channel']);
    const sesCol = colIdx(headers, ['^sessions?$', '^session$']);
    const engSesCol = colIdx(headers, ['engaged.?session']);
    const engRateCol = colIdx(headers, ['engagement.?rate']);
    const engTimeCol = colIdx(headers, ['engagement.?time', 'avg.*engagement']);
    const revCol = colIdx(headers, ['total.?revenue', '^revenue$']);
    const keyEvtCol = colIdx(headers, ['key.?event']);

    if (chCol === -1) return null;

    const channels = [];
    let totalSessions = 0, totalKeyEvents = 0, totalEngagedSessions = 0;
    let weightedEngRate = 0, weightedEngTime = 0;
    let paidSocialSessions = null;

    for (let i = headerIdx + 1; i < blockLines.length; i++) {
      const line = blockLines[i];
      if (!line || line.startsWith('#')) continue;
      const row = parseCSVLine(line);
      const name = row[chCol]?.trim();
      if (!name || name.toLowerCase().includes('total')) continue;

      const sessions = sesCol >= 0 ? cleanNum(row[sesCol]) : 0;
      const engSessions = engSesCol >= 0 ? cleanNum(row[engSesCol]) : 0;
      const engRate = engRateCol >= 0 ? cleanNum(row[engRateCol]) : 0;
      const engTime = engTimeCol >= 0 ? cleanNum(row[engTimeCol]) : 0;
      const revenue = revCol >= 0 ? cleanNum(row[revCol]) : 0;
      const keyEvents = keyEvtCol >= 0 ? cleanNum(row[keyEvtCol]) : 0;

      channels.push({ name, newUsers: sessions, sessions, revenue });
      totalSessions += sessions;
      totalKeyEvents += keyEvents;
      totalEngagedSessions += engSessions;
      weightedEngRate += engRate * sessions;  // weighted by sessions
      weightedEngTime += engTime * sessions;  // weighted by sessions

      if (/paid.?social/i.test(name)) paidSocialSessions = sessions;
    }

    // Weighted averages
    const avgEngagementRate = totalSessions > 0
      ? +((weightedEngRate / totalSessions) * 100).toFixed(1)   // convert 0.52 → 52.0%
      : 0;
    const avgEngagementTime = totalSessions > 0
      ? +(weightedEngTime / totalSessions).toFixed(0)            // seconds
      : 0;

    return {
      channels, totalSessions, paidSocialSessions,
      totalKeyEvents, totalEngagedSessions,
      avgEngagementRate, avgEngagementTime
    };
  }

  // Separate blocks into data-only sub-blocks (exclude pure-comment blocks)
  const dataBlocks = [];
  let dataBuf = [];
  for (const block of blocks) {
    const hasData = block.some(l => !l.startsWith('#'));
    if (hasData) {
      dataBlocks.push(block);
    } else {
      if (dataBuf.length) { dataBlocks.push(dataBuf); dataBuf = []; }
    }
  }

  // Flatten all lines and re-split by header occurrence
  const allLines = rawLines.filter(l => l);
  const headerOccurrences = [];
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startsWith('#')) continue;
    const row = parseCSVLine(allLines[i]);
    const j = row.join(' ').toLowerCase();
    if ((j.includes('session') || j.includes('channel')) && !j.match(/^\d/)) {
      headerOccurrences.push(i);
    }
  }

  function extractBlockAt(startIdx) {
    const slice = [];
    for (let i = startIdx; i < allLines.length; i++) {
      if (i > startIdx && !allLines[i].startsWith('#')) {
        const row = parseCSVLine(allLines[i]);
        const j = row.join(' ').toLowerCase();
        if ((j.includes('session') || j.includes('channel')) && !j.match(/^\d/)) break;
      }
      slice.push(allLines[i]);
    }
    return slice;
  }

  if (headerOccurrences.length === 0) {
    return { error: 'Could not parse. Export from GA4 → Reports → Acquisition → Traffic Acquisition.' };
  }

  const current = parseBlock(extractBlockAt(headerOccurrences[0]));
  const prior = headerOccurrences.length > 1 ? parseBlock(extractBlockAt(headerOccurrences[1])) : null;

  if (!current) return { error: 'Could not parse channel data from Traffic Acquisition CSV.' };

  return {
    channels: current.channels,
    totalNewUsers: current.totalSessions,
    totalSessions: current.totalSessions,
    paidSocialSessions: current.paidSocialSessions,
    paidSocialImpressions: null,
    // New engagement metrics
    totalKeyEvents: current.totalKeyEvents,
    avgEngagementRate: current.avgEngagementRate,
    avgEngagementTime: current.avgEngagementTime,
    // Prior period
    totalNewUsersPrior: prior?.totalSessions,
    paidSocialSessionsPrior: prior?.paidSocialSessions,
    totalKeyEventsPrior: prior?.totalKeyEvents,
    avgEngagementRatePrior: prior?.avgEngagementRate,
    avgEngagementTimePrior: prior?.avgEngagementTime,
    priorChannels: prior?.channels,
    dateStart, dateEnd
  };
}


// ═══════════════════════════════════════════════
//  GA4 PAGES & SCREENS PARSER
// ═══════════════════════════════════════════════
function parseGA4Pages(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
  let headers = [], headerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const j = row.join(' ').toLowerCase();
    if (j.includes('page') && (j.includes('view') || j.includes('user'))) {
      headers = row.map(h => h.toLowerCase().trim());
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) return { error: 'Could not parse. Export from GA4 → Reports → Engagement → Pages and screens.' };

  const titleCol = colIdx(headers, ['page.?title', 'page title']);
  const viewsCol = colIdx(headers, ['^views?$', '^page.?view', '^screen.?view']);
  const usersCol = colIdx(headers, ['active.?user', '^users?$', '^total.?user']);

  const pages = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i] || lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const title = titleCol >= 0 ? row[titleCol] : row[0];
    if (!title || title.toLowerCase().includes('total')) continue;
    const views = viewsCol >= 0 ? cleanNum(row[viewsCol]) : 0;
    const users = usersCol >= 0 ? cleanNum(row[usersCol]) : 0;
    pages.push({ title, views, users });
  }
  return { pages: pages.slice(0, 10) };
}

// ═══════════════════════════════════════════════
//  GOOGLE SEARCH CONSOLE PARSER
// ═══════════════════════════════════════════════
function parseSearchConsole(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
  const { dateStart, dateEnd } = extractDateRange(lines);
  let headers = [], headerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const j = row.join(' ').toLowerCase();
    if (j.includes('click') && j.includes('position')) {
      headers = row.map(h => h.toLowerCase().trim());
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) return { error: 'Could not parse. Export from Search Console → Performance → Queries → Export.' };

  // Column indices — use broad patterns to handle all GSC export variants
  const qCol = colIdx(headers, ['query', 'keyword', 'search term']);
  const clkCol = colIdx(headers, ['click']);
  const impCol = colIdx(headers, ['impression', 'impr']);
  const ctrCol = colIdx(headers, ['ctr', 'click.through', 'click through']);
  const posCol = colIdx(headers, ['position', 'pos', 'rank']);

  const queries = [];
  let totalClicks = 0, totalImpressions = 0, posSum = 0, clkForPos = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const row = parseCSVLine(lines[i]);
    const query = qCol >= 0 ? row[qCol] : row[0];
    if (!query || query.toLowerCase() === 'total') continue;
    const clicks = clkCol >= 0 ? cleanNum(row[clkCol]) : 0;
    const impressions = impCol >= 0 ? cleanNum(row[impCol]) : 0;
    const ctr = ctrCol >= 0 ? cleanNum(row[ctrCol]) : 0;
    const position = posCol >= 0 ? cleanNum(row[posCol]) : 0;
    queries.push({ query, clicks, impressions, ctr, position });
    totalClicks += clicks;
    totalImpressions += impressions;
    posSum += position * clicks;
    clkForPos += clicks;
  }

  const avgPosition = clkForPos > 0 ? +(posSum / clkForPos).toFixed(1) : 0;
  const avgCTR = totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(1) : 0;

  return { queries: queries.slice(0, 50), totalClicks, totalImpressions, avgPosition, avgCTR, dateStart, dateEnd };
}

// ═══════════════════════════════════════════════
//  ORGANIC RANKINGS CSV PARSER
//  Expects columns: Rank (or Position) + Query (or Keyword)
//  NOTE: The CSV may start with a summary stats row that contains
//  multi-word headers like "Average Position" and "Keyword Count".
//  We must match only rows where cells are EXACTLY the column name,
//  not multi-word metric descriptions.
// ═══════════════════════════════════════════════
function parseOrganicRankingsCSV(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
  let headers = [], headerIdx = -1;

  // Exact-match sets for rank and keyword column names
  const RANK_EXACT = new Set(['rank', 'position', 'pos', 'ranking', 'rank organic', 'current rank']);
  const KEYWORD_EXACT = new Set(['query', 'keyword', 'search term', 'term', 'phrase', 'key phrase', 'keyphrase']);

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const cells = row.map(c => c.toLowerCase().trim());

    // A valid header row must contain at least one cell that is EXACTLY
    // a rank column name, AND at least one cell that is EXACTLY a keyword name.
    const hasRank = cells.some(c => RANK_EXACT.has(c));
    const hasKeyword = cells.some(c => KEYWORD_EXACT.has(c));

    if (hasRank && hasKeyword) {
      headers = cells;
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Detailed error showing what the parser actually found
    const firstRows = lines.slice(0, 5).map(l => parseCSVLine(l).slice(0, 5).join(' | ')).join(' / ');
    return { error: `Could not find header row with Rank and Query columns. First rows seen: ${firstRows}` };
  }

  // Column detection using the matched headers (already lowercased)
  const rankCol = headers.findIndex(h => RANK_EXACT.has(h));
  // Keyword col: prefer 'query' first, then others
  let keywordCol = headers.indexOf('query');
  if (keywordCol === -1) keywordCol = headers.findIndex(h => KEYWORD_EXACT.has(h));
  const urlCol = colIdx(headers, ['^url$', '^page$', '^landing', '^address$', '^link$']);

  if (rankCol === -1) return { error: `Rank column not found. Headers: ${headers.join(', ')}` };
  if (keywordCol === -1) return { error: `Query/Keyword column not found. Headers: ${headers.join(', ')}` };

  const rankings = [];
  const seen = new Set();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i] || lines[i].startsWith('#')) continue;
    const row = parseCSVLine(lines[i]);
    const keyword = row[keywordCol]?.trim();
    if (!keyword || keyword.toLowerCase() === 'total') continue;

    // Strip non-numeric characters (handles values like "#1", "1st", etc.)
    const raw = String(row[rankCol] || '').replace(/[^0-9]/g, '');
    if (!raw) continue;  // blank rank = "disappeared" keyword, skip it
    const position = parseInt(raw, 10);
    if (isNaN(position) || position < 1) continue;

    const url = urlCol >= 0 ? (row[urlCol]?.trim() || '') : '';
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rankings.push({ keyword, position, url });
  }

  if (!rankings.length) return { error: `No ranking rows found. Headers detected: ${headers.join(', ')}` };

  rankings.sort((a, b) => a.position - b.position);
  return { rankings };
}
