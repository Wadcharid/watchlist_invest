/**
 * Cloudflare Pages Function: /api/quote
 * Fetches real-time price, % change, RSI (Daily, Weekly, Monthly), and TTM Dividend Yield.
 */

// Helper to format Thai date and time
function getThaiDateTimeStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const thaiDate = new Date(utc + (3600000 * 7));

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const d = thaiDate.getDate();
  const m = thaiMonths[thaiDate.getMonth()];
  const y = thaiDate.getFullYear() + 543;
  const hours = String(thaiDate.getHours()).padStart(2, '0');
  const mins = String(thaiDate.getMinutes()).padStart(2, '0');
  const secs = String(thaiDate.getSeconds()).padStart(2, '0');

  return `${d} ${m} ${y} เวลา ${hours}:${mins}:${secs} น.`;
}

// Calculate Wilder's 14-period smoothed RSI (TradingView / StockAnalysis standard)
function calculateWilderRSI(closes, period = 14) {
  if (!closes || closes.length <= period) return null;
  const valid = closes.filter(c => typeof c === 'number' && !isNaN(c));
  if (valid.length <= period) return null;

  const changes = [];
  for (let i = 1; i < valid.length; i++) {
    changes.push(valid[i] - valid[i - 1]);
  }
  if (changes.length < period) return null;

  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 0; i < period; i++) {
    const chg = changes[i];
    if (chg >= 0) sumGain += chg;
    else sumLoss += -chg;
  }

  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;

  for (let i = period; i < changes.length; i++) {
    const chg = changes[i];
    const gain = chg > 0 ? chg : 0;
    const loss = chg < 0 ? -chg : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Math.round(rsi * 100) / 100;
}

// Map user symbol to Yahoo Finance ticker and StockAnalysis URL
function resolveSymbol(raw) {
  const sym = (raw || '').trim().toUpperCase();
  let yfTicker = sym;
  let displaySymbol = sym;
  let saUrl = `https://stockanalysis.com/stocks/${sym.toLowerCase()}/`;
  let assetType = 'EQUITY';

  if (sym.startsWith('BKK:')) {
    const ticker = sym.replace('BKK:', '');
    yfTicker = `${ticker}.BK`;
    saUrl = `https://stockanalysis.com/quote/bkk/${ticker}/`;
    assetType = 'EQUITY';
  } else if (sym.startsWith('HKG:')) {
    const ticker = sym.replace('HKG:', '');
    yfTicker = `${ticker}.HK`;
    saUrl = `https://stockanalysis.com/quote/hkg/${ticker}/`;
    assetType = 'EQUITY';
  } else if (sym.includes('-USD') || sym.includes('BTC') || sym.includes('ETH')) {
    yfTicker = sym.endsWith('-USD') ? sym : `${sym}-USD`;
    const cleanSym = yfTicker.replace('-USD', '');
    saUrl = `https://stockanalysis.com/?s=${cleanSym}`;
    assetType = 'CRYPTOCURRENCY';
  } else if (['SPYI', 'SCHD', 'VYMI', 'IAUI', 'ACWI', 'QQQ', 'SPY', 'VOO', 'VTI', 'JEPI', 'JEPQ', 'TLT', 'NVDL'].includes(sym)) {
    saUrl = `https://stockanalysis.com/etf/${sym.toLowerCase()}/`;
    assetType = 'ETF';
  }

  return { yfTicker, displaySymbol, saUrl, assetType };
}

async function fetchSingleAsset(symbol) {
  const { yfTicker, displaySymbol, saUrl, assetType } = resolveSymbol(symbol);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    // 1. Fetch Daily Chart + Dividends (1 Year)
    const dailyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfTicker)}?interval=1d&range=1y&events=div`;
    // 2. Fetch Weekly Chart (2 Years)
    const weeklyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfTicker)}?interval=1wk&range=2y`;
    // 3. Fetch Monthly Chart (5 Years)
    const monthlyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfTicker)}?interval=1mo&range=5y`;

    const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
      fetch(dailyUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(weeklyUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(monthlyUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    if (!dailyRes || !dailyRes.chart || !dailyRes.chart.result || dailyRes.chart.result.length === 0) {
      throw new Error(`Data not found for ${displaySymbol}`);
    }

    const chartRes = dailyRes.chart.result[0];
    const meta = chartRes.meta || {};
    const quoteData = (chartRes.indicators && chartRes.indicators.quote && chartRes.indicators.quote[0]) || {};

    const price = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    let changePct = null;
    if (price !== null && prevClose !== null && prevClose !== 0) {
      changePct = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
    }

    // RSIs
    const dailyCloses = quoteData.close || [];
    const rsiDaily = calculateWilderRSI(dailyCloses, 14);

    let rsiWeekly = null;
    if (weeklyRes && weeklyRes.chart && weeklyRes.chart.result && weeklyRes.chart.result[0]) {
      const wkQuote = (weeklyRes.chart.result[0].indicators && weeklyRes.chart.result[0].indicators.quote && weeklyRes.chart.result[0].indicators.quote[0]) || {};
      rsiWeekly = calculateWilderRSI(wkQuote.close || [], 14);
    }

    let rsiMonthly = null;
    if (monthlyRes && monthlyRes.chart && monthlyRes.chart.result && monthlyRes.chart.result[0]) {
      const moQuote = (monthlyRes.chart.result[0].indicators && monthlyRes.chart.result[0].indicators.quote && monthlyRes.chart.result[0].indicators.quote[0]) || {};
      rsiMonthly = calculateWilderRSI(moQuote.close || [], 14);
    }

    // TTM Dividend Yield calculation from cash distributions in past 12 months
    let dividendYield = null;
    const events = chartRes.events || {};
    const dividends = events.dividends || {};
    const divValues = Object.values(dividends);
    if (divValues.length > 0 && price && price > 0) {
      const totalCashDiv12m = divValues.reduce((sum, d) => sum + (d.amount || 0), 0);
      dividendYield = Math.round((totalCashDiv12m / price) * 10000) / 100;
    }

    return {
      symbol: displaySymbol,
      name: meta.shortName || meta.longName || displaySymbol,
      type: assetType,
      currency: meta.currency || 'USD',
      price: price,
      change_pct: changePct,
      pe: meta.trailingPE ?? null,
      dividend_yield: dividendYield,
      rsi_daily: rsiDaily,
      rsi_weekly: rsiWeekly,
      rsi_monthly: rsiMonthly,
      volume: meta.regularMarketVolume ?? null,
      high_52w: meta.fiftyTwoWeekHigh ?? null,
      low_52w: meta.fiftyTwoWeekLow ?? null,
      stockanalysis_url: saUrl,
      last_updated: getThaiDateTimeStr()
    };
  } catch (err) {
    console.error(`Error fetching ${displaySymbol}:`, err);
    return {
      symbol: displaySymbol,
      name: displaySymbol,
      type: assetType,
      currency: 'USD',
      price: null,
      change_pct: null,
      pe: null,
      dividend_yield: null,
      rsi_daily: null,
      rsi_weekly: null,
      rsi_monthly: null,
      volume: null,
      high_52w: null,
      low_52w: null,
      stockanalysis_url: saUrl,
      last_updated: getThaiDateTimeStr()
    };
  }
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || url.searchParams.get('symbol') || '';

  let symbolList = [];
  if (symbolsParam) {
    symbolList = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (symbolList.length === 0) {
    // Default symbol list
    symbolList = [
      'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'SCHD', 'BTC-USD', 'TSM',
      'SPYI', 'VYMI', 'BKK:CPALL', 'BKK:BDMS', 'BKK:GULF', 'IAUI', 'HKG:0700', 'ACWI', 'BKK:PTTEP'
    ];
  }

  // Fetch in parallel
  const results = await Promise.all(symbolList.map(sym => fetchSingleAsset(sym)));

  const thaiNow = getThaiDateTimeStr();
  const responseData = {
    last_updated: thaiNow,
    last_updated_iso: new Date().toISOString(),
    total_assets: results.length,
    assets: results
  };

  return new Response(JSON.stringify(responseData), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'public, max-age=60' // Cloudflare Edge Cache for 60 seconds
    }
  });
}
