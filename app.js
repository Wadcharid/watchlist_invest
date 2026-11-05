/**
 * Investment Watchlist Application
 * Connects with stockanalysis.com and GitHub Actions data
 */

const STORAGE_KEYS = {
  WATCHLIST: 'invest_watchlist_tickers',
  GITHUB_PAT: 'invest_github_pat'
};

const GITHUB_REPO = 'Wadcharid/watchlist_invest';

let allStocksData = [];
let userWatchlist = [];
let currentCategory = 'ALL';
let currentSearch = '';
let currentRsiFilter = 'ALL';
let currentSort = { column: 'symbol', order: 'asc' };

// Elements
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const rsiFilter = document.getElementById('rsiFilter');
const addAssetForm = document.getElementById('addAssetForm');
const newSymbolInput = document.getElementById('newSymbolInput');
const lastUpdatedText = document.getElementById('lastUpdatedText');

// Stat Elements
const statTotalCount = document.getElementById('statTotalCount');
const statGainersCount = document.getElementById('statGainersCount');
const statLosersCount = document.getElementById('statLosersCount');
const statOversoldCount = document.getElementById('statOversoldCount');
const statOverboughtCount = document.getElementById('statOverboughtCount');
const countAll = document.getElementById('countAll');

// Modal Elements
const syncModal = document.getElementById('syncModal');
const btnOpenSync = document.getElementById('btnOpenSync');
const btnCloseSync = document.getElementById('btnCloseSync');
const btnDoneSync = document.getElementById('btnDoneSync');
const watchlistTextarea = document.getElementById('watchlistTextarea');
const btnApplyJson = document.getElementById('btnApplyJson');
const btnCopyJson = document.getElementById('btnCopyJson');
const btnDownloadJson = document.getElementById('btnDownloadJson');
const btnResetWatchlist = document.getElementById('btnResetWatchlist');
const githubTokenInput = document.getElementById('githubTokenInput');
const btnSyncToGitHub = document.getElementById('btnSyncToGitHub');
const syncStatus = document.getElementById('syncStatus');

// Toast Notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Format numbers
function formatPrice(val, currency = 'USD') {
  if (val === null || val === undefined) return '-';
  let prefix = '$';
  if (currency === 'THB') prefix = '฿';
  else if (currency === 'HKD') prefix = 'HK$';
  else if (currency !== 'USD') prefix = currency + ' ';

  if (val >= 1000) {
    return prefix + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return prefix + val.toFixed(2);
}

function formatChange(val) {
  if (val === null || val === undefined) return '<span class="change-pill zero">-</span>';
  const isPos = val > 0;
  const isNeg = val < 0;
  const sign = isPos ? '+' : '';
  const arrow = isPos ? '▲ ' : isNeg ? '▼ ' : '';
  const cls = isPos ? 'pos' : isNeg ? 'neg' : 'zero';
  return `<span class="change-pill ${cls}">${arrow}${sign}${val.toFixed(2)}%</span>`;
}

function formatPE(val) {
  if (val === null || val === undefined || isNaN(val)) return '<span class="text-muted">-</span>';
  return `<span class="mono-num">${val.toFixed(2)}</span>`;
}

function formatYield(val) {
  if (val === null || val === undefined || isNaN(val)) return '<span class="text-muted">-</span>';
  return `<span class="mono-num">${val.toFixed(2)}%</span>`;
}

function formatRSI(val) {
  if (val === null || val === undefined || isNaN(val)) return '<span class="text-muted">-</span>';
  let cls = 'rsi-neutral';
  if (val < 30) {
    cls = 'rsi-oversold';
  } else if (val > 70) {
    cls = 'rsi-overbought';
  }
  return `<span class="rsi-badge ${cls}">${val.toFixed(1)}</span>`;
}

function getBadgeHtml(type) {
  if (type === 'ETF') {
    return `<span class="badge badge-etf">ETF</span>`;
  } else if (type === 'CRYPTOCURRENCY') {
    return `<span class="badge badge-crypto">CRYPTO</span>`;
  }
  return `<span class="badge badge-equity">STOCK</span>`;
}

function getStockAnalysisUrl(symbol, type) {
  const sym = symbol.trim();
  if (sym.includes(':')) {
    const parts = sym.split(':');
    return `https://stockanalysis.com/stocks/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}/`;
  }
  const cleanSym = symbol.toLowerCase().replace('-usd', '').replace('^', '').trim();
  if (type === 'ETF') {
    return `https://stockanalysis.com/etf/${cleanSym}/`;
  } else if (type === 'CRYPTOCURRENCY') {
    return `https://stockanalysis.com/?s=${cleanSym.toUpperCase()}`;
  }
  return `https://stockanalysis.com/stocks/${cleanSym}/`;
}

// Fetch Master Data
async function loadData() {
  try {
    const res = await fetch('data/stocks.json?t=' + Date.now());
    if (!res.ok) throw new Error('Cannot load data/stocks.json');
    const json = await res.json();
    allStocksData = json.assets || [];
    
    if (json.last_updated) {
      lastUpdatedText.textContent = `อัปเดตล่าสุด: ${json.last_updated}`;
    }

    // Initialize Watchlist
    initWatchlist();
  } catch (err) {
    console.warn('Could not load stocks.json directly, falling back:', err);
    lastUpdatedText.textContent = 'ไม่สามารถโหลดข้อมูลล่าสุดได้';
    initWatchlist();
  }
}

// Initialize Watchlist from LocalStorage or Default
function initWatchlist() {
  const saved = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
  if (saved) {
    try {
      userWatchlist = JSON.parse(saved);
    } catch (e) {
      userWatchlist = [];
    }
  }

  // If no saved watchlist, initialize from loaded data or defaults
  if (!userWatchlist || userWatchlist.length === 0) {
    if (allStocksData.length > 0) {
      userWatchlist = allStocksData.map(a => a.symbol.toUpperCase());
    } else {
      userWatchlist = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'SPY', 'QQQ', 'VOO', 'SCHD', 'IBIT', 'BTC-USD'];
    }
    saveWatchlist();
  }

  render();
}

function saveWatchlist() {
  localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(userWatchlist));
}

// Add Asset
function addAsset(rawSymbol) {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return;

  if (userWatchlist.includes(symbol)) {
    showToast(`⚠️ ${symbol} อยู่ใน Watchlist แล้ว`);
    return;
  }

  userWatchlist.push(symbol);
  saveWatchlist();
  newSymbolInput.value = '';

  const existsInData = allStocksData.some(a => a.symbol === symbol);
  if (existsInData) {
    showToast(`✅ เพิ่ม ${symbol} เข้าสู่ Watchlist เรียบร้อย`);
  } else {
    showToast(`✅ เพิ่ม ${symbol} แล้ว! (กด 'จัดการ Watchlist' เพื่อซิงก์อัปเดตข้อมูลบน GitHub)`);
  }

  render();
}

// Delete Asset
function deleteAsset(symbol) {
  userWatchlist = userWatchlist.filter(s => s !== symbol);
  saveWatchlist();
  showToast(`🗑️ ลบ ${symbol} ออกจาก Watchlist แล้ว`);
  render();
}

// Filter and Sort Data
function getFilteredAndSortedData() {
  // Combine all items in userWatchlist
  let items = userWatchlist.map(sym => {
    const found = allStocksData.find(a => a.symbol === sym);
    if (found) return found;
    // Ticker added by user but not yet in stocks.json
    return {
      symbol: sym,
      name: sym,
      type: sym.includes('-USD') ? 'CRYPTOCURRENCY' : 'EQUITY',
      price: null,
      change_pct: null,
      pe: null,
      dividend_yield: null,
      rsi_daily: null,
      rsi_weekly: null,
      rsi_monthly: null,
      stockanalysis_url: getStockAnalysisUrl(sym, sym.includes('-USD') ? 'CRYPTOCURRENCY' : 'EQUITY')
    };
  });

  // Category Filter
  if (currentCategory !== 'ALL') {
    items = items.filter(item => item.type === currentCategory);
  }

  // Search Filter
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase().trim();
    items = items.filter(item => 
      item.symbol.toLowerCase().includes(q) || 
      (item.name && item.name.toLowerCase().includes(q))
    );
  }

  // RSI Filter
  if (currentRsiFilter === 'OVERSOLD') {
    items = items.filter(item => item.rsi_daily !== null && item.rsi_daily < 30);
  } else if (currentRsiFilter === 'OVERBOUGHT') {
    items = items.filter(item => item.rsi_daily !== null && item.rsi_daily > 70);
  } else if (currentRsiFilter === 'NEUTRAL') {
    items = items.filter(item => item.rsi_daily !== null && item.rsi_daily >= 30 && item.rsi_daily <= 70);
  }

  // Sorting
  items.sort((a, b) => {
    let valA = a[currentSort.column];
    let valB = b[currentSort.column];

    if (valA === null || valA === undefined) valA = -999999999;
    if (valB === null || valB === undefined) valB = -999999999;

    if (typeof valA === 'string') {
      return currentSort.order === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }
    return currentSort.order === 'asc' ? valA - valB : valB - valA;
  });

  return items;
}

// Render Table
function render() {
  const items = getFilteredAndSortedData();
  
  // Update Stats
  updateStats();

  // Render Table Rows
  if (items.length === 0) {
    tableBody.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  tableBody.innerHTML = items.map(item => {
    const url = item.stockanalysis_url || getStockAnalysisUrl(item.symbol, item.type);
    return `
      <tr data-symbol="${item.symbol}">
        <td>
          <div class="asset-col">
            <div class="asset-title">
              <span class="asset-symbol">${item.symbol}</span>
              ${getBadgeHtml(item.type)}
            </div>
            <span class="asset-name" title="${item.name || item.symbol}">${item.name || item.symbol}</span>
          </div>
        </td>
        <td class="text-right mono-num">${formatPrice(item.price, item.currency)}</td>
        <td class="text-right">${formatChange(item.change_pct)}</td>
        <td class="text-right">${formatPE(item.pe)}</td>
        <td class="text-center">${formatRSI(item.rsi_daily)}</td>
        <td class="text-center">${formatRSI(item.rsi_weekly)}</td>
        <td class="text-center">${formatRSI(item.rsi_monthly)}</td>
        <td class="text-right">${formatYield(item.dividend_yield)}</td>
        <td class="text-center">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-btn-stockanalysis" title="เปิดหน้า ${item.symbol} บน StockAnalysis.com">
            <span>ดูข้อมูล</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </td>
        <td class="text-center">
          <button class="btn-delete" onclick="deleteAsset('${item.symbol}')" title="ลบออกจาก Watchlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Update Sorting Headers
  document.querySelectorAll('th.sortable').forEach(th => {
    const col = th.getAttribute('data-sort');
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (col === currentSort.column) {
      th.classList.add(currentSort.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function updateStats() {
  const trackedItems = userWatchlist.map(sym => allStocksData.find(a => a.symbol === sym)).filter(Boolean);
  
  statTotalCount.textContent = userWatchlist.length;
  countAll.textContent = userWatchlist.length;

  const gainers = trackedItems.filter(i => i.change_pct > 0).length;
  const losers = trackedItems.filter(i => i.change_pct < 0).length;
  const oversold = trackedItems.filter(i => i.rsi_daily !== null && i.rsi_daily < 30).length;
  const overbought = trackedItems.filter(i => i.rsi_daily !== null && i.rsi_daily > 70).length;

  statGainersCount.textContent = gainers;
  statLosersCount.textContent = losers;
  statOversoldCount.textContent = oversold;
  statOverboughtCount.textContent = overbought;
}

// Event Listeners
addAssetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addAsset(newSymbolInput.value);
});

searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value;
  render();
});

rsiFilter.addEventListener('change', (e) => {
  currentRsiFilter = e.target.value;
  render();
});

// Category Filter Tabs
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.getAttribute('data-category');
    render();
  });
});

// Sorting Header Clicks
document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.getAttribute('data-sort');
    if (currentSort.column === col) {
      currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column = col;
      currentSort.order = col === 'symbol' ? 'asc' : 'desc'; // Default desc for numbers, asc for symbol
    }
    render();
  });
});

// Modal Operations
btnOpenSync.addEventListener('click', () => {
  watchlistTextarea.value = JSON.stringify(userWatchlist, null, 2);
  const savedToken = localStorage.getItem(STORAGE_KEYS.GITHUB_PAT) || '';
  githubTokenInput.value = savedToken;
  syncStatus.textContent = '';
  syncModal.style.display = 'flex';
});

btnCloseSync.addEventListener('click', () => {
  syncModal.style.display = 'none';
});

btnDoneSync.addEventListener('click', () => {
  syncModal.style.display = 'none';
});

syncModal.addEventListener('click', (e) => {
  if (e.target === syncModal) {
    syncModal.style.display = 'none';
  }
});

btnApplyJson.addEventListener('click', () => {
  try {
    const parsed = JSON.parse(watchlistTextarea.value);
    if (!Array.isArray(parsed)) throw new Error('ต้องเป็น JSON Array ของ Symbol');
    userWatchlist = parsed.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    saveWatchlist();
    render();
    showToast('✅ บันทึกรายการ Watchlist ลงในเบราว์เซอร์เรียบร้อย');
  } catch (err) {
    alert('รูปแบบ JSON ไม่ถูกต้อง: ' + err.message);
  }
});

btnCopyJson.addEventListener('click', () => {
  navigator.clipboard.writeText(watchlistTextarea.value).then(() => {
    showToast('📋 คัดลอก JSON ไปยังคลิปบอร์ดแล้ว');
  });
});

btnDownloadJson.addEventListener('click', () => {
  const blob = new Blob([watchlistTextarea.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watchlist.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 ดาวน์โหลดไฟล์ watchlist.json เรียบร้อย');
});

btnResetWatchlist.addEventListener('click', () => {
  if (confirm('คุณต้องการรีเซ็ต Watchlist เป็นค่าเริ่มต้นทั้งหมดใช่หรือไม่?')) {
    localStorage.removeItem(STORAGE_KEYS.WATCHLIST);
    initWatchlist();
    watchlistTextarea.value = JSON.stringify(userWatchlist, null, 2);
    showToast('🔄 รีเซ็ต Watchlist เป็นค่าเริ่มต้นแล้ว');
  }
});

// GitHub API Direct Sync
btnSyncToGitHub.addEventListener('click', async () => {
  const token = githubTokenInput.value.trim();
  if (!token) {
    alert('กรุณากรอก GitHub Personal Access Token (PAT) ที่มีสิทธิ์ repo เพื่อซิงก์ข้อมูล');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.GITHUB_PAT, token);
  syncStatus.textContent = 'กำลังติดต่อ GitHub API...';

  try {
    // 1. Get SHA of data/watchlist.json
    const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data/watchlist.json`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }

    // 2. Commit updated watchlist.json
    syncStatus.textContent = 'กำลังบันทึก data/watchlist.json ไปยัง Repository...';
    const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(userWatchlist, null, 2) + '\n')));
    
    const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data/watchlist.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update watchlist.json from web UI',
        content: contentBase64,
        sha: sha
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(`บันทึกไฟล์ไม่สำเร็จ: ${err.message}`);
    }

    // 3. Trigger workflow dispatch
    syncStatus.textContent = 'กำลังสั่งรัน GitHub Actions Workflow...';
    const dispatchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/update_data.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main'
      })
    });

    if (!dispatchRes.ok && dispatchRes.status !== 204) {
      const err = await dispatchRes.json();
      throw new Error(`สั่งรัน Workflow ไม่สำเร็จ: ${err.message}`);
    }

    syncStatus.textContent = '✅ ซิงก์และสั่งรัน Workflow สำเร็จ! ข้อมูลจะอัปเดตใน 1-2 นาที';
    showToast('🚀 ส่งคำสั่งอัปเดตไปยัง GitHub เรียบร้อยแล้ว');
  } catch (err) {
    console.error(err);
    syncStatus.textContent = `❌ เกิดข้อผิดพลาด: ${err.message}`;
    alert(`ข้อผิดพลาดในการซิงก์: ${err.message}\n\nตรวจสอบ Token หรือใช้ปุ่ม 'คัดลอก JSON' ไปวางใน GitHub แทนได้ครับ`);
  }
});

// Load on start
loadData();
