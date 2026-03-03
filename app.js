// ═══════════════════════════════════════════════
//  WDF DASHBOARD  –  app.js
// ═══════════════════════════════════════════════

const GEMINI_API_KEY = "";
const CLIENT_PASS = "deer2026";
const ADMIN_PASS = "admin2026";

let activeTab = 'overview';
let charts = {};
let parsedUploads = {};

// ── Format helpers ──
const fmt$ = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const fmtX = (n) => Number(n || 0).toFixed(2) + 'x';
const fmtP = (n) => Number(n || 0).toFixed(1) + '%';


// Compute % change, return { pct, dir } where dir = 'up'|'down'|'neutral'
function pctChange(current, prior) {
    if (!prior || prior === 0) return { pct: null, dir: 'neutral' };
    const pct = Math.round(((current - prior) / prior) * 100);
    return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

// Render a trend line (returns HTML string)
function trendHtml(current, prior, positiveIsGood = true) {
    const { pct, dir } = pctChange(current, prior);
    if (pct === null) return '';
    const isGood = positiveIsGood ? dir === 'up' : dir === 'down';
    const colorClass = isGood ? 'up' : (dir === 'neutral' ? 'neutral' : 'down');
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
    const sign = pct > 0 ? '+' : '';
    return `<div class="kpi-trend ${colorClass}">${arrow} ${sign}${pct}% vs prior period</div>`;
}

// ════════════════════════════════════════════════
//  PASSWORD GATE
// ════════════════════════════════════════════════
function checkPassword() {
    const val = document.getElementById('pass-input').value;
    if (val === CLIENT_PASS) {
        document.getElementById('pass-overlay').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        renderAll();
        initCharts();
    } else {
        document.getElementById('pass-error').textContent = 'Incorrect code. Please try again.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pass-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') checkPassword();
    });
});

// ════════════════════════════════════════════════
//  TAB NAVIGATION
// ════════════════════════════════════════════════
function switchTab(id) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('active');
    activeTab = id;
    if (id === 'google-ads') initAdsCharts();
    if (id === 'analytics') initAnalyticsCharts();
    document.getElementById('sidebar').classList.remove('open');
}

function toggleMobileSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ════════════════════════════════════════════════
//  DATE RANGE LABEL
// ════════════════════════════════════════════════
function dateRangeLabel(start, end) {
    if (start && end) return `${start} – ${end}`;
    return null;
}

// ════════════════════════════════════════════════
//  RENDER ALL — populate KPIs, tables, charts
// ════════════════════════════════════════════════
function renderAll() {
    const d = reportData;

    // ── Date range labels ──
    const csvDateLabel = dateRangeLabel(d.dateStart, d.dateEnd);
    const csvLabelText = csvDateLabel || d.period;
    ['date-range-label', 'date-range-label-ads', 'date-range-label-ana', 'date-range-label-sc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = csvLabelText;
    });

    const orgDateEl = document.getElementById('org-date-label');
    if (orgDateEl) orgDateEl.textContent = d.reportDate || d.period;

    // Legacy period-tag spans (sidebar badge)
    document.querySelectorAll('.period-label').forEach(el => el.textContent = d.period);

    // ── Overview KPIs ──
    setEl('kpi-revenue', fmt$(d.googleAds.revenue));
    document.getElementById('kpi-revenue-trend').innerHTML = trendHtml(d.googleAds.revenue, d.googleAds.revenuePrior);

    setEl('kpi-roas', fmtX(d.googleAds.roas));
    document.getElementById('kpi-roas-trend').innerHTML = trendHtml(d.googleAds.roas, d.googleAds.roasPrior);

    setEl('kpi-rev-per', '$' + Number(d.googleAds.roas).toFixed(2));
    // Rev Per $1 is same data as ROAS — share same trend
    document.getElementById('kpi-revper-trend').innerHTML = trendHtml(d.googleAds.roas, d.googleAds.roasPrior);

    // Active Users — mauPrior is stored as % change (e.g. -16.5)
    const mauPct = typeof d.analytics.mauPrior === 'number' ? d.analytics.mauPrior : 0;
    const mauPctStr = (mauPct >= 0 ? '+' : '') + mauPct.toFixed(1) + '%';
    setEl('kpi-mau', fmtN(d.analytics.mau));
    const kpiMauTrend = document.getElementById('kpi-mau-trend');
    if (kpiMauTrend) {
        kpiMauTrend.textContent = (mauPct >= 0 ? '▲ ' : '▼ ') + mauPctStr + ' vs prior period';
        kpiMauTrend.className = 'kpi-trend ' + (mauPct >= 0 ? 'up' : 'down');
    }

    // ── Google Ads KPIs ──
    setEl('ads-revenue', fmt$(d.googleAds.revenue));
    document.getElementById('ads-revenue-trend').innerHTML = trendHtml(d.googleAds.revenue, d.googleAds.revenuePrior);

    setEl('ads-spend', fmt$(d.googleAds.spend));
    document.getElementById('ads-spend-trend').innerHTML = trendHtml(d.googleAds.spend, d.googleAds.spendPrior, false); // lower spend = better only if roas up

    setEl('ads-impressions', fmtN(d.googleAds.impressions));
    document.getElementById('ads-impressions-trend').innerHTML = trendHtml(d.googleAds.impressions, d.googleAds.impressionsPrior);

    setEl('ads-clicks', fmtN(d.googleAds.clicks));
    document.getElementById('ads-clicks-trend').innerHTML = trendHtml(d.googleAds.clicks, d.googleAds.clicksPrior);

    setEl('ads-roas', fmtX(d.googleAds.roas));
    document.getElementById('ads-roas-trend').innerHTML = trendHtml(d.googleAds.roas, d.googleAds.roasPrior);

    setEl('ads-cpa', fmt$(d.googleAds.cpa));
    document.getElementById('ads-cpa-trend').innerHTML = trendHtml(d.googleAds.cpa, d.googleAds.cpaPrior, false); // lower CPA = better

    setEl('sim-spend-label', fmt$(d.googleAds.spend));
    setEl('sim-rev-label', fmt$(d.googleAds.revenue));
    document.getElementById('sim-range').value = d.googleAds.spend;

    // ── Analytics KPIs ── (Active Users only card now)
    setEl('ana-mau', d.analytics.mau ? fmtN(d.analytics.mau) : '—');
    const anaMauTrend = document.getElementById('ana-mau-trend');
    if (anaMauTrend) {
        anaMauTrend.innerHTML = mauPct !== 0
            ? `<span class="kpi-trend ${mauPct >= 0 ? 'up' : 'down'}">${mauPct >= 0 ? '▲ ' : '▼ '}${mauPctStr} vs prior period</span>`
            : '';
    }

    // Key Events (Conversions)
    const keyEvts = d.analytics.keyEvents || 0;
    const keyEvtsPrior = d.analytics.keyEventsPrior || 0;
    setEl('ana-key-events', keyEvts ? fmtN(keyEvts) : '—');
    const keyTrendEl = document.getElementById('ana-key-events-trend');
    if (keyTrendEl) keyTrendEl.innerHTML = keyEvts && keyEvtsPrior ? trendHtml(keyEvts, keyEvtsPrior) : '';

    // Engagement Rate
    const engRate = d.analytics.avgEngagementRate || 0;
    const engRatePrior = d.analytics.avgEngagementRatePrior || 0;
    setEl('ana-eng-rate', engRate ? engRate.toFixed(1) + '%' : '—');
    const engRateTrendEl = document.getElementById('ana-eng-rate-trend');
    if (engRateTrendEl) engRateTrendEl.innerHTML = engRate && engRatePrior ? trendHtml(engRate, engRatePrior) : '';

    // Avg Engagement Time (format seconds as m:ss)
    const engTime = d.analytics.avgEngagementTime || 0;
    const engTimePrior = d.analytics.avgEngagementTimePrior || 0;
    const fmtTime = (s) => s >= 60 ? Math.floor(s / 60) + 'm ' + String(Math.round(s % 60)).padStart(2, '0') + 's' : s + 's';
    setEl('ana-eng-time', engTime ? fmtTime(engTime) : '—');
    const engTimeTrendEl = document.getElementById('ana-eng-time-trend');
    if (engTimeTrendEl) engTimeTrendEl.innerHTML = engTime && engTimePrior ? trendHtml(engTime, engTimePrior) : '';

    // ── Top Pages table ──
    const tbody = document.getElementById('pages-tbody');
    if (tbody) {
        tbody.innerHTML = d.analytics.topPages.map((p, i) => `
      <tr>
        <td><span style="color:var(--muted);font-size:10px;margin-right:8px;">${i + 1}</span>${escHtml(p.title)}</td>
        <td class="num">${fmtN(p.views)}</td>
        <td class="num">${fmtN(p.users)}</td>
      </tr>`).join('');
    }

    // ── Search Console KPIs ──
    setEl('sc-position', Number(d.searchConsole.avgPosition).toFixed(1));
    document.getElementById('sc-position-trend').innerHTML = trendHtml(d.searchConsole.avgPosition, d.searchConsole.avgPositionPrior, false); // lower pos = better

    setEl('sc-impressions', fmtN(d.searchConsole.impressions));
    document.getElementById('sc-impressions-trend').innerHTML = trendHtml(d.searchConsole.impressions, d.searchConsole.impressionsPrior);

    setEl('sc-clicks', fmtN(d.searchConsole.clicks));
    document.getElementById('sc-clicks-trend').innerHTML = trendHtml(d.searchConsole.clicks, d.searchConsole.clicksPrior);

    setEl('sc-ctr', fmtP(d.searchConsole.ctr));
    document.getElementById('sc-ctr-trend').innerHTML = trendHtml(d.searchConsole.ctr, d.searchConsole.ctrPrior);

    // ── Queries table — sorted by clicks desc, up to 50 ──
    const qtbody = document.getElementById('queries-tbody');
    if (qtbody) {
        const sortedQueries = [...d.searchConsole.queries].sort((a, b) => b.clicks - a.clicks).slice(0, 50);
        qtbody.innerHTML = sortedQueries.map(q => `
      <tr>
        <td class="green-text">${escHtml(q.query)}</td>
        <td class="num">${fmtN(q.clicks)}</td>
        <td class="num">${fmtN(q.impressions)}</td>
        <td class="num">${fmtP(q.ctr)}</td>
        <td class="num">${Number(q.position).toFixed(1)}</td>
      </tr>`).join('');
    }

    // ── Exec summary ──
    const roas = Number(d.googleAds.roas).toFixed(2);
    const mauStr = fmtN(d.analytics.mau);
    const autoSummary = `${d.period} demonstrated exceptional ROAS consistency. For every $1.00 spent, we generated $${roas} in gross revenue, while scaling Monthly Active Users to ${mauStr} — a ${mauPct > 0 ? '+' + mauPct : mauPct}% increase over ${d.analytics.priorMonthName}.`;
    const execEl = document.getElementById('exec-text');
    if (execEl) execEl.textContent = d.execSummary || autoSummary;

    // ── Organic Rankings ──
    renderRankings();

    // ── Recommendations ──
    renderRecommendations();

    updateCharts();
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ════════════════════════════════════════════════
//  RECOMMENDATIONS RENDER
// ════════════════════════════════════════════════
function renderRecommendations() {
    const list = document.getElementById('rec-list');
    if (!list) return;
    const recs = (reportData.recommendations || []).filter(r => r.title && r.title.trim());
    if (!recs.length) {
        list.innerHTML = '<li style="color:#94a3b8;font-size:12px;font-style:italic;">No recommendations yet. Add them in Admin → Report Date tab.</li>';
        return;
    }
    list.innerHTML = recs.map(r => `
        <li class="rec-item">
          <span class="rec-dot ${r.priority || 'medium'}"></span>
          <div>
            <div class="rec-title">${escHtml(r.title)}</div>
            ${r.body ? `<div class="rec-body">${escHtml(r.body)}</div>` : ''}
          </div>
        </li>`).join('');
}

// ════════════════════════════════════════════════
//  ORGANIC RANKINGS RENDER  (3 buckets, all ranks)
// ════════════════════════════════════════════════
function renderRankings() {
    const rankings = reportData.organicRankings || [];
    const empty = document.getElementById('rankings-empty');
    const table = document.getElementById('rankings-table');
    const tbody = document.getElementById('rankings-tbody');

    // 3-bucket distribution
    const dist = { 1: 0, '2-5': 0, '6-10': 0 };
    rankings.forEach(r => {
        const p = r.position;
        if (p === 1) dist[1]++;
        else if (p <= 5) dist['2-5']++;
        else if (p <= 10) dist['6-10']++;
    });

    setEl('dist-1', dist[1] || '—');
    setEl('dist-2-5', dist['2-5'] || '—');
    setEl('dist-6-10', dist['6-10'] || '—');

    if (!rankings.length) {
        if (empty) empty.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }

    if (empty) empty.style.display = 'none';
    if (table) table.style.display = 'table';

    // All keywords sorted by position ascending
    const sorted = [...rankings].sort((a, b) => a.position - b.position);

    tbody.innerHTML = sorted.map(r => {
        let badgeClass = 'pos-8-10';
        if (r.position === 1) badgeClass = 'pos-1';
        else if (r.position <= 5) badgeClass = 'pos-2-3';
        else if (r.position <= 10) badgeClass = 'pos-6-7';
        return `<tr>
          <td><span class="pos-badge ${badgeClass}">${r.position}</span></td>
          <td style="font-weight:600;color:var(--text);">${escHtml(r.keyword)}</td>
        </tr>`;
    }).join('');
}

// ════════════════════════════════════════════════
//  CHARTS (Chart.js)
// ════════════════════════════════════════════════
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#94a3b8';

function initCharts() { }

function makeGradient(ctx, colorTop, colorBottom) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, colorTop);
    gradient.addColorStop(1, colorBottom);
    return gradient;
}
function makeHGradient(ctx, colorLeft, colorRight, width) {
    const gradient = ctx.createLinearGradient(0, 0, width || 400, 0);
    gradient.addColorStop(0, colorLeft);
    gradient.addColorStop(1, colorRight);
    return gradient;
}

function initAdsCharts() {
    if (charts.roi) return;
    const d = reportData.googleAds;

    const roiCanvas = document.getElementById('chart-roi');
    const roiCtx = roiCanvas.getContext('2d');
    const spendGrad = makeGradient(roiCtx, 'rgba(100,116,139,0.9)', 'rgba(100,116,139,0.3)');
    const revenueGrad = makeGradient(roiCtx, 'rgba(34,197,94,0.95)', 'rgba(34,197,94,0.4)');

    charts.roi = new Chart(roiCanvas, {
        type: 'bar',
        data: {
            labels: ['Ad Spend', 'Revenue Generated'],
            datasets: [{ data: [d.spend, d.revenue], backgroundColor: [spendGrad, revenueGrad], borderRadius: 10, borderSkipped: false, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ' ' + fmt$(ctx.parsed.y) }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600', size: 12 }, color: '#475569' } },
                y: { grid: { color: '#f1f5f9', lineWidth: 1 }, border: { display: false, dash: [4, 4] }, ticks: { callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v), font: { size: 11 }, color: '#94a3b8', maxTicksLimit: 6 } }
            }
        }
    });

    const unitCanvas = document.getElementById('chart-unit');
    const unitCtx = unitCanvas.getContext('2d');
    const cpaGrad = makeHGradient(unitCtx, '#1e40af', '#3b82f6', 300);
    const aovGrad = makeHGradient(unitCtx, '#15803d', '#22c55e', 300);

    charts.unit = new Chart(unitCanvas, {
        type: 'bar',
        data: {
            labels: ['Cost / Conversion', 'Avg Order Value'],
            datasets: [{ data: [d.cpa, d.avgOrderValue], backgroundColor: [cpaGrad, aovGrad], borderRadius: 8, borderSkipped: false, borderWidth: 0 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ' ' + fmt$(ctx.parsed.x) }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
            },
            scales: {
                x: { grid: { color: '#f1f5f9', lineWidth: 1 }, border: { display: false }, ticks: { callback: v => '$' + v, font: { size: 11 }, color: '#94a3b8' } },
                y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600', size: 12 }, color: '#475569' } }
            }
        }
    });
}

function initAnalyticsCharts() {
    if (charts.channelUsers) return;
    const d = reportData.analytics;
    const ga = reportData.googleAds;
    const sc = reportData.searchConsole;

    const channelColors = [
        ['#22c55e', 'rgba(34,197,94,0.15)'], ['#3b82f6', 'rgba(59,130,246,0.15)'],
        ['#6366f1', 'rgba(99,102,241,0.15)'], ['#f97316', 'rgba(249,115,22,0.15)'],
        ['#ec4899', 'rgba(236,72,153,0.15)'], ['#f59e0b', 'rgba(245,158,11,0.15)'],
    ];

    // Top 10 channels by sessions, sorted descending
    const top10ch = [...d.channels].sort((a, b) => b.newUsers - a.newUsers).slice(0, 10);

    const chCanvas = document.getElementById('chart-channels');
    const chCtx = chCanvas.getContext('2d');
    charts.channelUsers = new Chart(chCanvas, {
        type: 'bar',
        data: {
            labels: top10ch.map(c => c.name),
            datasets: [{
                label: 'Sessions',
                data: top10ch.map(c => c.newUsers),
                backgroundColor: top10ch.map((_, i) => {
                    const [top, bot] = channelColors[i % channelColors.length];
                    const g = chCtx.createLinearGradient(0, 0, 380, 0);
                    g.addColorStop(0, top);
                    g.addColorStop(1, bot.replace('0.15', '0.5'));
                    return g;
                }),
                borderRadius: 6, borderSkipped: false, borderWidth: 0,
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => '  ' + fmtN(ctx.parsed.x) + ' sessions' }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
            },
            scales: {
                x: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v, font: { size: 11 }, color: '#94a3b8' } },
                y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600', size: 12 }, color: '#475569' } }
            }
        }
    });

    const impCanvas = document.getElementById('chart-impressions');
    const impCtx = impCanvas.getContext('2d');
    const impColors = [
        makeGradient(impCtx, 'rgba(34,197,94,0.9)', 'rgba(34,197,94,0.25)'),
        makeGradient(impCtx, 'rgba(59,130,246,0.9)', 'rgba(59,130,246,0.25)'),
        makeGradient(impCtx, 'rgba(249,115,22,0.9)', 'rgba(249,115,22,0.25)'),
    ];
    charts.impressions = new Chart(impCanvas, {
        type: 'bar',
        data: {
            labels: ['Paid Search', 'Paid Social', 'Organic Search'],
            datasets: [{ label: 'Impressions', data: [ga.impressions, d.paidSocialImpressions, sc.impressions], backgroundColor: impColors, borderRadius: 10, borderSkipped: false, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => '  ' + fmtN(ctx.parsed.y) + ' impressions' }, backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 12, cornerRadius: 10 }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600', size: 12 }, color: '#475569' } },
                y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v, font: { size: 11 }, color: '#94a3b8', maxTicksLimit: 6 } }
            }
        }
    });
}

function updateCharts() {
    const d = reportData;
    if (charts.roi) { charts.roi.data.datasets[0].data = [d.googleAds.spend, d.googleAds.revenue]; charts.roi.update(); }
    if (charts.unit) { charts.unit.data.datasets[0].data = [d.googleAds.cpa, d.googleAds.avgOrderValue]; charts.unit.update(); }
    if (charts.channelUsers) { charts.channelUsers.data.labels = d.analytics.channels.map(c => c.name); charts.channelUsers.data.datasets[0].data = d.analytics.channels.map(c => c.newUsers); charts.channelUsers.update(); }
    if (charts.impressions) { charts.impressions.data.datasets[0].data = [d.googleAds.impressions, d.analytics.paidSocialImpressions, d.searchConsole.impressions]; charts.impressions.update(); }
}

// ── Simulator ──
function initSimulator() {
    const range = document.getElementById('sim-range');
    if (!range) return;
    range.addEventListener('input', () => {
        const spend = parseFloat(range.value);
        const roas = reportData.googleAds.roas || 4.56;
        setEl('sim-spend-label', fmt$(spend));
        setEl('sim-rev-label', fmt$(Math.round(spend * roas)));
    });
}

// ════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════
function logoutDashboard() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('pass-overlay').classList.remove('hidden');
    // Clear the password so it must be re-entered
    const inp = document.getElementById('pass-input');
    if (inp) inp.value = '';
    localStorage.removeItem('wdf-session');
}

// ════════════════════════════════════════════════
//  AI INSIGHTS (Gemini)
//  ADMIN PANEL
// ════════════════════════════════════════════════
let adminUnlocked = false;

function openAdminGate() {
    if (adminUnlocked) { openAdmin(); return; }
    document.getElementById('admin-pass-overlay').classList.add('open');
    setTimeout(() => document.getElementById('admin-pass-input').focus(), 100);
}
function checkAdminPass() {
    const val = document.getElementById('admin-pass-input').value;
    if (val === ADMIN_PASS) {
        adminUnlocked = true;
        document.getElementById('admin-pass-overlay').classList.remove('open');
        document.getElementById('admin-pass-error').textContent = '';
        openAdmin();
    } else {
        document.getElementById('admin-pass-error').textContent = 'Incorrect admin code.';
    }
}
function openAdmin() {
    parsedUploads = {};
    document.getElementById('admin-overlay').classList.add('open');
    switchAdminTab('period');

    // Prefill fields
    document.getElementById('admin-period').value = reportData.period;
    document.getElementById('admin-report-date').value = reportData.reportDate || reportData.period;
    document.getElementById('admin-ps-impr').value = reportData.analytics.paidSocialImpressions || '';
    document.getElementById('admin-ps-sess').value = reportData.analytics.paidSocialSessions || '';

    // Active Users manual override
    const auEl = document.getElementById('admin-active-users');
    const auPriorEl = document.getElementById('admin-active-users-prior');
    if (auEl) auEl.value = reportData.analytics.mau || '';
    if (auPriorEl) auPriorEl.value = reportData.analytics.mauPrior || '';

    // Exec summary
    const d = reportData;
    const mauPct = d.analytics.mauPrior > 0
        ? Math.round(((d.analytics.mau - d.analytics.mauPrior) / d.analytics.mauPrior) * 100) : 0;
    const autoSummary = `${d.period} demonstrated exceptional ROAS consistency. For every $1.00 spent, we generated $${Number(d.googleAds.roas).toFixed(2)} in gross revenue, while scaling Monthly Active Users to ${fmtN(d.analytics.mau)} — a ${mauPct > 0 ? '+' + mauPct : mauPct}% increase over ${d.analytics.priorMonthName}.`;
    document.getElementById('admin-exec-summary').value = d.execSummary || autoSummary;

    // Prefill recommendations
    const recRows = document.querySelectorAll('.admin-rec-row');
    const recs = reportData.recommendations || [];
    recRows.forEach((row, i) => {
        const rec = recs[i] || {};
        const priorityEl = row.querySelector('.rec-priority');
        const titleEl = row.querySelector('.rec-title');
        const bodyEl = row.querySelector('.rec-body');
        if (priorityEl) priorityEl.value = rec.priority || 'medium';
        if (titleEl) titleEl.value = rec.title || '';
        if (bodyEl) bodyEl.value = rec.body || '';
    });
}
function closeAdmin() {
    document.getElementById('admin-overlay').classList.remove('open');
}

function switchAdminTab(id) {
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.atab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('atab-' + id).classList.add('active');
    document.querySelector(`[data-atab="${id}"]`).classList.add('active');
}

// ── Upload handlers ──
function setupUpload(inputId, zoneId, type, parseFn) {
    const input = document.getElementById(inputId);
    const zone = document.getElementById(zoneId);
    if (!input || !zone) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file, zone, type, parseFn);
    });
    input.addEventListener('change', () => {
        if (input.files[0]) processFile(input.files[0], zone, type, parseFn);
    });
}

function processFile(file, zone, type, parseFn) {
    zone.classList.remove('error', 'dragover', 'success');
    zone.querySelector('.upload-label').textContent = '⏳ Parsing...';

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = parseFn(e.target.result);
        if (result.error) {
            zone.classList.add('error');
            zone.querySelector('.upload-label').textContent = '⚠ ' + result.error;
            zone.querySelector('.upload-hint').textContent = '';
        } else {
            zone.classList.add('success');
            zone.querySelector('.upload-label').textContent = '✓ ' + file.name;
            const count = result.rankings ? result.rankings.length + ' keywords found' : 'CSV parsed successfully';
            zone.querySelector('.upload-hint').textContent = count;
            parsedUploads[type] = result;
            showPreview(type, result);
        }
    };
    reader.readAsText(file);
}

function showPreview(type, result) {
    const el = document.getElementById('preview-' + type);
    if (!el) return;
    let pills = '';

    if (type === 'ads') {
        pills = `
      <div class="preview-pill"><div class="pp-label">Revenue</div><div class="pp-val">${fmt$(result.revenue)}</div></div>
      <div class="preview-pill"><div class="pp-label">Ad Spend</div><div class="pp-val">${fmt$(result.spend)}</div></div>
      <div class="preview-pill"><div class="pp-label">ROAS</div><div class="pp-val">${fmtX(result.roas)}</div></div>
      <div class="preview-pill"><div class="pp-label">Clicks</div><div class="pp-val">${fmtN(result.clicks)}</div></div>
      <div class="preview-pill"><div class="pp-label">Impressions</div><div class="pp-val">${fmtN(result.impressions)}</div></div>
      <div class="preview-pill"><div class="pp-label">Cost/Conv.</div><div class="pp-val">${fmt$(result.cpa)}</div></div>`;
        if (result.dateStart) pills += `<div class="preview-pill" style="flex:1;"><div class="pp-label">Date Range</div><div class="pp-val" style="font-size:11px;">${result.dateStart} – ${result.dateEnd}</div></div>`;
    } else if (type === 'ga4-traffic') {
        const top3 = result.channels.slice(0, 3).map(c => `${c.name}: ${fmtN(c.newUsers)}`).join(' · ');
        const priorLabel = result.totalNewUsersPrior != null ? ` (prior: ${fmtN(result.totalNewUsersPrior)})` : '';
        pills = `
      <div class="preview-pill"><div class="pp-label">Total Sessions (Active)</div><div class="pp-val">${fmtN(result.totalSessions)}${priorLabel}</div></div>
      <div class="preview-pill"><div class="pp-label">Channels Found</div><div class="pp-val">${result.channels.length}</div></div>
      <div class="preview-pill" style="flex:1;min-width:220px;"><div class="pp-label">Top Channels</div><div class="pp-val" style="font-size:11px;line-height:1.5;">${top3}</div></div>`;
    } else if (type === 'ga4-pages') {
        pills = `
      <div class="preview-pill"><div class="pp-label">Pages Found</div><div class="pp-val">${result.pages.length}</div></div>
      <div class="preview-pill" style="flex:1;"><div class="pp-label">Top Page</div><div class="pp-val" style="font-size:11px;">${result.pages[0]?.title?.substring(0, 40) || '—'}…</div></div>`;
    } else if (type === 'gsc') {
        pills = `
      <div class="preview-pill"><div class="pp-label">Total Clicks</div><div class="pp-val">${fmtN(result.totalClicks)}</div></div>
      <div class="preview-pill"><div class="pp-label">Avg Position</div><div class="pp-val">${result.avgPosition}</div></div>
      <div class="preview-pill"><div class="pp-label">Avg CTR</div><div class="pp-val">${fmtP(result.avgCTR)}</div></div>
      <div class="preview-pill"><div class="pp-label">Queries</div><div class="pp-val">${result.queries.length}</div></div>`;
    } else if (type === 'rankings') {
        const dist = { 1: 0, '2-5': 0, '6-10': 0, other: 0 };
        (result.rankings || []).forEach(r => {
            if (r.position === 1) dist[1]++;
            else if (r.position <= 5) dist['2-5']++;
            else if (r.position <= 10) dist['6-10']++;
            else dist.other++;
        });
        pills = `
      <div class="preview-pill"><div class="pp-label">Total Keywords</div><div class="pp-val">${result.rankings?.length || 0}</div></div>
      <div class="preview-pill"><div class="pp-label">Position 1</div><div class="pp-val">${dist[1]}</div></div>
      <div class="preview-pill"><div class="pp-label">Positions 2–5</div><div class="pp-val">${dist['2-5']}</div></div>
      <div class="preview-pill"><div class="pp-label">Positions 6–10</div><div class="pp-val">${dist['6-10']}</div></div>`;
    }

    el.innerHTML = `<div class="preview-grid">${pills}</div>`;
}

// ── Apply uploads to reportData and save ──
function applyAndSave() {
    const period = document.getElementById('admin-period').value.trim();
    if (period) reportData.period = period;

    const reportDate = document.getElementById('admin-report-date').value.trim();
    if (reportDate) reportData.reportDate = reportDate;

    const execSummary = document.getElementById('admin-exec-summary').value.trim();
    reportData.execSummary = execSummary || null;




    // Active Users — manual override (from GA4 Home screen, not in exports)
    const activeUsers = parseFloat(document.getElementById('admin-active-users')?.value);
    const activeUsersPctChange = parseFloat(document.getElementById('admin-active-users-prior')?.value);
    if (!isNaN(activeUsers) && activeUsers > 0) reportData.analytics.mau = activeUsers;
    // mauPrior stores the % change directly (e.g. -16.5 means down 16.5%)
    if (!isNaN(activeUsersPctChange)) reportData.analytics.mauPrior = activeUsersPctChange;

    if (parsedUploads.ads) {
        Object.assign(reportData.googleAds, parsedUploads.ads);
        // Apply date range from ads CSV
        if (parsedUploads.ads.dateStart) reportData.dateStart = parsedUploads.ads.dateStart;
        if (parsedUploads.ads.dateEnd) reportData.dateEnd = parsedUploads.ads.dateEnd;
    }
    if (parsedUploads['ga4-traffic']) {
        const t = parsedUploads['ga4-traffic'];
        reportData.analytics.channels = t.channels;
        // mau (Active Users) is set only via manual admin field, NOT from Sessions total
        // New engagement metrics from CSV
        if (t.totalKeyEvents != null) reportData.analytics.keyEvents = t.totalKeyEvents;
        if (t.totalKeyEventsPrior != null) reportData.analytics.keyEventsPrior = t.totalKeyEventsPrior;
        if (t.avgEngagementRate != null) reportData.analytics.avgEngagementRate = t.avgEngagementRate;
        if (t.avgEngagementRatePrior != null) reportData.analytics.avgEngagementRatePrior = t.avgEngagementRatePrior;
        if (t.avgEngagementTime != null) reportData.analytics.avgEngagementTime = t.avgEngagementTime;
        if (t.avgEngagementTimePrior != null) reportData.analytics.avgEngagementTimePrior = t.avgEngagementTimePrior;
        if (t.paidSocialSessions != null) reportData.analytics.paidSocialSessions = t.paidSocialSessions;
        if (t.paidSocialSessionsPrior != null) reportData.analytics.paidSocialSessionsPrior = t.paidSocialSessionsPrior;
        if (t.paidSocialImpressions != null) reportData.analytics.paidSocialImpressions = t.paidSocialImpressions;
        if (t.dateStart && !reportData.dateStart) reportData.dateStart = t.dateStart;
        if (t.dateEnd && !reportData.dateEnd) reportData.dateEnd = t.dateEnd;
    }
    if (parsedUploads['ga4-pages']) {
        reportData.analytics.topPages = parsedUploads['ga4-pages'].pages;
    }
    if (parsedUploads.gsc) {
        const g = parsedUploads.gsc;
        reportData.searchConsole.queries = g.queries;
        reportData.searchConsole.clicks = g.totalClicks;
        reportData.searchConsole.impressions = g.totalImpressions;
        reportData.searchConsole.avgPosition = g.avgPosition;
        reportData.searchConsole.ctr = g.avgCTR;
        if (g.dateStart && !reportData.dateStart) reportData.dateStart = g.dateStart;
        if (g.dateEnd && !reportData.dateEnd) reportData.dateEnd = g.dateEnd;
    }
    if (parsedUploads.rankings) {
        reportData.organicRankings = parsedUploads.rankings.rankings || [];
    }

    // Recommendations
    const recRowEls = document.querySelectorAll('.admin-rec-row');
    reportData.recommendations = [];
    recRowEls.forEach(row => {
        const title = row.querySelector('.rec-title')?.value.trim() || '';
        const body = row.querySelector('.rec-body')?.value.trim() || '';
        const priority = row.querySelector('.rec-priority')?.value || 'medium';
        reportData.recommendations.push({ priority, title, body });
    });

    saveReportData();
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
    renderAll();
    closeAdmin();
    switchTab('overview');
}

function resetToDefaults() {
    if (!confirm('Reset all data to January 2026 defaults? This cannot be undone.')) return;
    resetReportData();
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
    renderAll();
    closeAdmin();
}

function exportJSON() {
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'WDF_ReportData_' + reportData.period.replace(/\s/g, '_') + '.json';
    a.click();
}

// ════════════════════════════════════════════════
//  PDF EXPORT — standalone popup with inline styles
// ════════════════════════════════════════════════
function exportPDF() {
    const d = reportData;
    const c = (v) => Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const num = (v) => Number(v || 0).toLocaleString('en-US');
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pctHtml = (cur, prior) => {
        if (!prior) return '';
        const diff = ((cur - prior) / prior) * 100;
        const col = diff >= 0 ? '#16a34a' : '#dc2626';
        return `<div style="font-size:9pt;font-weight:600;color:${col};margin-top:4px">${diff >= 0 ? '▲' : '▼'} ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% vs prior</div>`;
    };
    const dotCol = (p) => ({ high: '#dc2626', medium: '#f97316', low: '#22c55e' }[p] || '#94a3b8');

    const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#fff;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4 landscape;margin:12mm 16mm}
.page{page-break-after:always;break-after:page;padding-bottom:8px}
.page:last-child{page-break-after:avoid;break-after:avoid}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #16a34a;padding-bottom:8px;margin-bottom:18px}
.hdr-left{}
.client{font-size:14pt;font-weight:900;color:#0f172a;line-height:1}
.section{font-size:8pt;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.08em;margin-top:3px}
.period{font-size:9pt;font-weight:600;color:#475569}
.krow{display:flex;gap:12px;margin-bottom:18px}
.k{flex:1;border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px;background:#fff}
.klbl{font-size:7.5pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.kval{font-size:19pt;font-weight:900;color:#0f172a;line-height:1.1}
.card{border:1.5px solid #e2e8f0;border-radius:8px;padding:16px;background:#fff;margin-bottom:14px}
.ctitle{font-size:8pt;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.exec{font-size:10.5pt;color:#1e293b;line-height:1.7;font-style:italic}
.rec-row{display:flex;gap:14px;flex-wrap:wrap}
.ri{flex:1;min-width:150px;margin-bottom:4px}
.rt{font-size:9.5pt;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:5px;margin-bottom:3px}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.rb{font-size:8.5pt;color:#475569;line-height:1.5;padding-left:12px}
.two{display:flex;gap:14px}
.two>*{flex:1}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{padding:6px 8px;background:#f8fafc;color:#475569;font-weight:700;text-align:left;border-bottom:2px solid #e2e8f0;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9;color:#0f172a}
tr:nth-child(even) td{background:#fafafa}
tr:last-child td{border-bottom:none}
.nd{color:#94a3b8;font-style:italic;font-size:9pt;padding:10px 0}`;

    const hdr = (sec) => `<div class="hdr"><div class="hdr-left"><div class="client">Wireless Deer Fence</div><div class="section">${esc(sec)}</div></div><div class="period">Digital Marketing Report &nbsp;·&nbsp; ${esc(d.period)}</div></div>`;

    // ── Page 1: Overview ──
    const mauPct = typeof d.analytics.mauPrior === 'number' ? d.analytics.mauPrior : 0;
    const mauCol = mauPct >= 0 ? '#16a34a' : '#dc2626';
    const recs = (d.recommendations || []).filter(r => r && r.title);

    const p1 = `<div class="page">${hdr('Performance Overview')}
<div class="krow">
  <div class="k" style="border-top:3px solid #22c55e"><div class="klbl">Total Revenue (Ads)</div><div class="kval">${c(d.googleAds.revenue)}</div>${pctHtml(d.googleAds.revenue, d.googleAds.revenuePrior)}</div>
  <div class="k" style="border-top:3px solid #3b82f6"><div class="klbl">Return on Ad Spend</div><div class="kval">${Number(d.googleAds.roas || 0).toFixed(2)}x</div>${pctHtml(d.googleAds.roas, d.googleAds.roasPrior)}</div>
  <div class="k" style="border-top:3px solid #f97316"><div class="klbl">Rev per $1 Spent</div><div class="kval">$${Number(d.googleAds.roas || 0).toFixed(2)}</div></div>
  <div class="k" style="border-top:3px solid #6366f1"><div class="klbl">Active Users</div><div class="kval">${num(d.analytics.mau)}</div><div style="font-size:9pt;font-weight:600;color:${mauCol};margin-top:4px">${mauPct >= 0 ? '▲' : '▼'} ${mauPct >= 0 ? '+' : ''}${mauPct.toFixed(1)}% vs prior</div></div>
</div>
<div class="card"><div class="ctitle">Executive Summary</div><div class="exec">${esc(d.execSummary || 'No executive summary entered.')}</div></div>
<div class="card"><div class="ctitle" style="color:#6366f1">⚡ Actionable Recommendations</div>
  <div class="rec-row">${recs.length ? recs.map(r => `<div class="ri"><div class="rt"><span class="dot" style="background:${dotCol(r.priority)}"></span>${esc(r.title)}</div><div class="rb">${esc(r.body)}</div></div>`).join('') : '<div class="nd">No recommendations entered yet.</div>'}</div>
</div></div>`;

    // ── Page 2: Google Ads ──
    const campaigns = d.googleAds.campaigns || [];
    const terms = d.googleAds.searchTerms || [];
    const p2 = `<div class="page">${hdr('Google Ads Performance')}
<div class="krow">
  <div class="k" style="border-top:3px solid #22c55e"><div class="klbl">Revenue</div><div class="kval">${c(d.googleAds.revenue)}</div>${pctHtml(d.googleAds.revenue, d.googleAds.revenuePrior)}</div>
  <div class="k" style="border-top:3px solid #3b82f6"><div class="klbl">Ad Spend</div><div class="kval">${c(d.googleAds.spend)}</div></div>
  <div class="k" style="border-top:3px solid #6366f1"><div class="klbl">ROAS</div><div class="kval">${Number(d.googleAds.roas || 0).toFixed(2)}x</div>${pctHtml(d.googleAds.roas, d.googleAds.roasPrior)}</div>
  <div class="k" style="border-top:3px solid #f97316"><div class="klbl">Impressions</div><div class="kval">${num(d.googleAds.impressions)}</div>${pctHtml(d.googleAds.impressions, d.googleAds.impressionsPrior)}</div>
  <div class="k" style="border-top:3px solid #22c55e"><div class="klbl">Clicks</div><div class="kval">${num(d.googleAds.clicks)}</div>${pctHtml(d.googleAds.clicks, d.googleAds.clicksPrior)}</div>
  <div class="k" style="border-top:3px solid #3b82f6"><div class="klbl">Cost / Conv.</div><div class="kval">${c(d.googleAds.cpa)}</div></div>
</div>
<div class="two">
  <div class="card"><div class="ctitle">Campaigns</div>${campaigns.length ? `<table><thead><tr><th>Campaign</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>Clicks</th></tr></thead><tbody>${campaigns.map(r => `<tr><td>${esc(r.campaign || r.name || '—')}</td><td>${c(r.spend || r.cost)}</td><td>${c(r.revenue || r.conversionsValue)}</td><td>${Number((r.revenue || r.conversionsValue || 0) / (r.spend || r.cost || 1)).toFixed(2)}x</td><td>${num(r.clicks)}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">Upload Google Ads CSV in Admin.</div>'}</div>
  <div class="card"><div class="ctitle">Top Search Terms</div>${terms.length ? `<table><thead><tr><th>Search Term</th><th>Clicks</th><th>Impr.</th><th>CTR</th></tr></thead><tbody>${terms.slice(0, 12).map(r => `<tr><td>${esc(r.searchTerm || r.term || r.query || '—')}</td><td>${num(r.clicks)}</td><td>${num(r.impressions)}</td><td>${r.ctr || '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">No search term data available.</div>'}</div>
</div></div>`;

    // ── Page 3: Analytics ──
    const engRate = d.analytics.avgEngagementRate || 0;
    const engTime = d.analytics.avgEngagementTime || 0;
    const mm2 = Math.floor(engTime / 60), ss2 = Math.floor(engTime % 60);
    const channels = d.analytics.channels || [];
    const pages = d.analytics.pages || [];
    const p3 = `<div class="page">${hdr('Google Analytics')}
<div class="krow">
  <div class="k" style="border-top:3px solid #22c55e"><div class="klbl">Active Users</div><div class="kval">${num(d.analytics.mau)}</div></div>
  <div class="k" style="border-top:3px solid #3b82f6"><div class="klbl">Key Events</div><div class="kval">${num(d.analytics.keyEvents) || '—'}</div></div>
  <div class="k" style="border-top:3px solid #f97316"><div class="klbl">Engagement Rate</div><div class="kval">${engRate ? engRate.toFixed(1) + '%' : '—'}</div></div>
  <div class="k" style="border-top:3px solid #6366f1"><div class="klbl">Avg. Eng. Time</div><div class="kval">${engTime ? `${mm2}:${String(ss2).padStart(2, '0')}` : '—'}</div></div>
</div>
<div class="two">
  <div class="card"><div class="ctitle">Traffic by Channel</div>${channels.length ? `<table><thead><tr><th>Channel</th><th>Users</th><th>Sessions</th><th>Eng. Rate</th></tr></thead><tbody>${channels.map(r => `<tr><td>${esc(r.channel || r.channelGroup || '—')}</td><td>${num(r.users || r.activeUsers)}</td><td>${num(r.sessions)}</td><td>${r.engagementRate ? (Number(r.engagementRate) * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">Upload GA4 CSV in Admin.</div>'}</div>
  <div class="card"><div class="ctitle">Top Pages</div>${pages.length ? `<table><thead><tr><th>Page</th><th>Views</th><th>Users</th></tr></thead><tbody>${pages.slice(0, 12).map(r => `<tr><td>${esc(r.page || r.pagePath || r.pageTitle || '—')}</td><td>${num(r.views || r.screenPageViews)}</td><td>${num(r.users || r.activeUsers)}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">No page data available.</div>'}</div>
</div></div>`;

    // ── Page 4: Organic Rankings ──
    const kws = (d.organicRankings && d.organicRankings.keywords) || [];
    const p4 = `<div class="page">${hdr('Organic Rankings')}
<div class="card"><div class="ctitle">Keyword Rankings by Position</div>${kws.length ? `<table><thead><tr><th>#</th><th>Position</th><th>Keyword</th></tr></thead><tbody>${kws.slice(0, 35).map((r, i) => `<tr><td style="color:#94a3b8">${i + 1}</td><td style="font-weight:700;color:#0f172a">${r.position || r.rank || '—'}</td><td>${esc(r.keyword || r.query || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">Upload an Organic Rankings CSV in Admin to populate this section.</div>'}</div>
</div>`;

    // ── Page 5: Search Console ──
    const sc = d.searchConsole || {};
    const scRows = sc.queries || sc.keywords || [];
    const p5 = `<div class="page">${hdr('Google Search Console')}
<div class="krow">
  <div class="k" style="border-top:3px solid #22c55e"><div class="klbl">Total Clicks</div><div class="kval">${num(sc.totalClicks) || '—'}</div></div>
  <div class="k" style="border-top:3px solid #3b82f6"><div class="klbl">Total Impressions</div><div class="kval">${num(sc.totalImpressions) || '—'}</div></div>
  <div class="k" style="border-top:3px solid #f97316"><div class="klbl">Avg. CTR</div><div class="kval">${sc.avgCtr ? (Number(sc.avgCtr) * 100).toFixed(2) + '%' : '—'}</div></div>
  <div class="k" style="border-top:3px solid #6366f1"><div class="klbl">Avg. Position</div><div class="kval">${sc.avgPosition ? Number(sc.avgPosition).toFixed(1) : '—'}</div></div>
</div>
<div class="card"><div class="ctitle">Top Search Queries</div>${scRows.length ? `<table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>${scRows.slice(0, 20).map(r => `<tr><td>${esc(r.query || r.keyword || '—')}</td><td>${num(r.clicks)}</td><td>${num(r.impressions)}</td><td>${r.ctr ? (Number(r.ctr) * 100).toFixed(2) + '%' : '—'}</td><td>${r.position ? Number(r.position).toFixed(1) : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="nd">Upload Search Console CSV in Admin to see queries.</div>'}</div>
</div>`;

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Wireless Deer Fence — ${esc(d.period)}</title><style>${CSS}</style></head><body>${p1}${p2}${p3}${p4}${p5}<script>window.onload=()=>window.print();<\/script></body></html>`;

    const w = window.open('', '_blank', 'width=1200,height=900');
    if (w) { w.document.write(html); w.document.close(); }
    else { alert('Please allow popups for this site, then click Export PDF again.'); }
}

// ════════════════════════════════════════════════
//  INIT on DOMContentLoaded
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Clear any previously saved dark theme (dark mode removed)
    localStorage.removeItem('wdf-theme');

    const api = document.getElementById('admin-pass-input');
    if (api) api.addEventListener('keypress', e => { if (e.key === 'Enter') checkAdminPass(); });

    setupUpload('upload-ads-input', 'upload-ads-zone', 'ads', parseGoogleAds);
    setupUpload('upload-traffic-input', 'upload-traffic-zone', 'ga4-traffic', parseGA4Traffic);
    setupUpload('upload-pages-input', 'upload-pages-zone', 'ga4-pages', parseGA4Pages);
    setupUpload('upload-gsc-input', 'upload-gsc-zone', 'gsc', parseSearchConsole);
    setupUpload('upload-rankings-input', 'upload-rankings-zone', 'rankings', parseOrganicRankingsCSV);

    initSimulator();
});
