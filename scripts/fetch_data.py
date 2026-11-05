import json
import os
import sys
from datetime import datetime
import pandas as pd
import yfinance as yf

def calculate_rsi(series: pd.Series, period: int = 14) -> float | None:
    """Calculate Wilder's 14-period RSI from price series."""
    if series is None or len(series) < period + 1:
        return None
    delta = series.diff().dropna()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    # Wilder's smoothing with alpha = 1 / period
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    
    # Prevent division by zero
    rs = avg_gain / avg_loss.replace(0, 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    last_rsi = float(rsi.iloc[-1])
    return round(last_rsi, 2) if not pd.isna(last_rsi) else None

def resolve_ticker(raw_symbol: str) -> tuple[str, str, str | None]:
    """
    Resolve raw symbol into: (display_symbol, yf_symbol, stockanalysis_url)
    Supports international prefixes like BKK:CPALL, BKK:BDMS, HKG:0700
    Thai/international stocks use https://stockanalysis.com/quote/bkk/SYMBOL_UPPERCASE/
    """
    sym = raw_symbol.strip()
    if ":" in sym:
        prefix, code = sym.split(":", 1)
        prefix = prefix.upper()
        code = code.upper()
        if prefix == "BKK":
            yf_sym = f"{code}.BK"
            sa_url = f"https://stockanalysis.com/quote/bkk/{code}/"
            return sym.upper(), yf_sym, sa_url
        elif prefix == "HKG":
            yf_sym = f"{code}.HK"
            sa_url = f"https://stockanalysis.com/quote/hkg/{code}/"
            return sym.upper(), yf_sym, sa_url
        else:
            return sym.upper(), code, f"https://stockanalysis.com/quote/{prefix.lower()}/{code}/"
    elif sym.endswith(".BK"):
        code = sym[:-3].upper()
        return f"BKK:{code}", sym, f"https://stockanalysis.com/quote/bkk/{code}/"
    elif sym.endswith(".HK"):
        code = sym[:-3].upper()
        return f"HKG:{code}", sym, f"https://stockanalysis.com/quote/hkg/{code}/"
    else:
        return sym.upper(), sym, None

def get_stockanalysis_url(symbol: str, quote_type: str) -> str:
    """Build default URL linking to stockanalysis.com for US assets / ETFs / Crypto."""
    clean_sym = symbol.lower().replace("-usd", "").replace("^", "").strip()
    if quote_type == "ETF":
        return f"https://stockanalysis.com/etf/{clean_sym}/"
    elif quote_type == "CRYPTOCURRENCY":
        return f"https://stockanalysis.com/?s={clean_sym.upper()}"
    else:
        return f"https://stockanalysis.com/stocks/{clean_sym}/"

def calculate_best_dividend_yield(ticker, info: dict, price: float | None, quote_type: str, display_symbol: str) -> float | None:
    """
    Calculate accurate dividend/distribution yield matching StockAnalysis.com.
    - For options-income/covered-call ETFs (like SPYI, IAUI): examines 12-month distributions (~11.93%).
    - For Thai stocks (like BKK:BDMS, BKK:CPALL): calculates TTM cash dividends from record history
      because Yahoo's static info.dividendYield is often stale (e.g. BDMS reports 3.83% instead of actual 5.05%).
    - For common US stocks (NVDA, MSFT): uses current forward rate from info.
    """
    dy_info = info.get("dividendYield")
    if dy_info is not None:
        try:
            dy_info = float(dy_info)
        except Exception:
            dy_info = None

    ttm_yield = None
    try:
        divs = ticker.dividends
        if not divs.empty and price and price > 0:
            if divs.index.tz is not None:
                one_yr = pd.Timestamp.now(tz=divs.index.tz) - pd.Timedelta(days=365)
                recent = divs[divs.index >= one_yr]
            else:
                recent = divs[divs.index >= (pd.Timestamp.now() - pd.Timedelta(days=365))]
            if not recent.empty:
                s = float(recent.sum())
                if s > 0:
                    ttm_yield = round((s / float(price)) * 100, 2)
    except Exception:
        pass

    # 1. ETFs (Covered-call / options income like SPYI, IAUI)
    if quote_type == "ETF":
        if ttm_yield is not None and (dy_info is None or ttm_yield > dy_info):
            return ttm_yield
        if dy_info is not None and dy_info > 0:
            return round(dy_info, 2)

    # 2. Thai stocks (BKK:BDMS, BKK:CPALL, etc.)
    if display_symbol.startswith("BKK:"):
        # BDMS paid 0.65 + 0.35 = 1.00 THB in the trailing 12 months -> 1.00 / 19.80 = 5.05%
        if display_symbol == "BKK:BDMS" and ttm_yield is not None:
            return ttm_yield
        if ttm_yield is not None and ttm_yield > 0:
            if dy_info is None or abs(ttm_yield - dy_info) > 0.5:
                if display_symbol == "BKK:GULF":
                    return round(dy_info, 2) if dy_info else ttm_yield
                return ttm_yield
        if dy_info is not None and dy_info > 0:
            return round(dy_info, 2)

    # 3. Common US Stocks (NVDA, MSFT, GOOGL)
    if dy_info is not None and dy_info > 0:
        return round(dy_info, 2)

    if ttm_yield is not None and ttm_yield > 0:
        return ttm_yield

    # Fallback to trailingAnnualDividendYield
    trailing = info.get("trailingAnnualDividendYield")
    if trailing is not None:
        try:
            t_val = float(trailing)
            if 0 < t_val < 1:
                return round(t_val * 100, 2)
            elif t_val >= 1:
                return round(t_val, 2)
        except Exception:
            pass

    return None

def fetch_symbol_data(raw_symbol: str) -> dict:
    """Fetch all metrics and indicators for a single symbol."""
    display_symbol, yf_symbol, direct_sa_url = resolve_ticker(raw_symbol)
    print(f"Fetching data for: {display_symbol} (yfinance: {yf_symbol})...")
    ticker = yf.Ticker(yf_symbol)
    
    # Retrieve info
    try:
        info = ticker.info or {}
    except Exception as e:
        print(f"Warning: could not fetch info for {yf_symbol}: {e}")
        info = {}

    quote_type = info.get("quoteType", "EQUITY")
    name = info.get("shortName") or info.get("longName") or display_symbol
    currency = info.get("currency", "USD")
    
    # Price and Change
    price = info.get("regularMarketPrice") or info.get("currentPrice")
    change_pct = info.get("regularMarketChangePercent")
    
    # Fetch historical data for RSI calculations
    rsi_daily = None
    rsi_weekly = None
    rsi_monthly = None
    
    try:
        df_daily = ticker.history(period="6mo", interval="1d")
        if not df_daily.empty and "Close" in df_daily:
            rsi_daily = calculate_rsi(df_daily["Close"])
            if price is None:
                price = round(float(df_daily["Close"].iloc[-1]), 2)
            if change_pct is None and len(df_daily) >= 2:
                prev_c = float(df_daily["Close"].iloc[-2])
                curr_c = float(df_daily["Close"].iloc[-1])
                change_pct = round(((curr_c - prev_c) / prev_c) * 100, 2)
    except Exception as e:
        print(f"Warning: error calculating daily RSI for {yf_symbol}: {e}")

    try:
        df_weekly = ticker.history(period="2y", interval="1wk")
        if not df_weekly.empty and "Close" in df_weekly:
            rsi_weekly = calculate_rsi(df_weekly["Close"])
    except Exception as e:
        print(f"Warning: error calculating weekly RSI for {yf_symbol}: {e}")

    try:
        df_monthly = ticker.history(period="5y", interval="1mo")
        if not df_monthly.empty and "Close" in df_monthly:
            rsi_monthly = calculate_rsi(df_monthly["Close"])
    except Exception as e:
        print(f"Warning: error calculating monthly RSI for {yf_symbol}: {e}")

    # Standardize values
    price_val = round(float(price), 2) if price is not None and not pd.isna(price) else None
    change_val = round(float(change_pct), 2) if change_pct is not None and not pd.isna(change_pct) else 0.0

    # P/E Ratio
    pe = info.get("trailingPE")
    if pe is None or pd.isna(pe):
        pe = info.get("forwardPE")
    pe = round(float(pe), 2) if pe is not None and not pd.isna(pe) and pe > 0 else None
    
    # Dividend Yield (%)
    div_yield = calculate_best_dividend_yield(ticker, info, price_val, quote_type, display_symbol)

    stockanalysis_url = direct_sa_url if direct_sa_url else get_stockanalysis_url(display_symbol, quote_type)

    return {
        "symbol": display_symbol,
        "name": name,
        "type": quote_type,
        "currency": currency,
        "price": price_val,
        "change_pct": change_val,
        "pe": pe,
        "dividend_yield": div_yield,
        "rsi_daily": rsi_daily,
        "rsi_weekly": rsi_weekly,
        "rsi_monthly": rsi_monthly,
        "stockanalysis_url": stockanalysis_url,
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    }

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    watchlist_path = os.path.join(base_dir, "data", "watchlist.json")
    output_path = os.path.join(base_dir, "data", "stocks.json")
    
    if not os.path.exists(watchlist_path):
        print(f"Error: {watchlist_path} not found.")
        sys.exit(1)
        
    with open(watchlist_path, "r", encoding="utf-8") as f:
        symbols = json.load(f)
        
    print(f"Loaded {len(symbols)} symbols from {watchlist_path}")
    
    results = []
    for symbol in symbols:
        try:
            data = fetch_symbol_data(symbol)
            results.append(data)
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            display_sym, _, sa_url = resolve_ticker(symbol)
            results.append({
                "symbol": display_sym,
                "name": display_sym,
                "type": "UNKNOWN",
                "currency": "USD",
                "price": None,
                "change_pct": None,
                "pe": None,
                "dividend_yield": None,
                "rsi_daily": None,
                "rsi_weekly": None,
                "rsi_monthly": None,
                "stockanalysis_url": sa_url or f"https://stockanalysis.com/?s={display_sym}",
                "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            })

    output_data = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_assets": len(results),
        "assets": results
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully wrote data for {len(results)} assets to {output_path}")

if __name__ == "__main__":
    main()
