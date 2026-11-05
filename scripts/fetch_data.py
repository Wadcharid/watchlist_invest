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

def get_stockanalysis_url(symbol: str, quote_type: str) -> str:
    """Build URL linking to stockanalysis.com."""
    clean_sym = symbol.lower().replace("-usd", "").replace("^", "").strip()
    if quote_type == "ETF":
        return f"https://stockanalysis.com/etf/{clean_sym}/"
    elif quote_type == "CRYPTOCURRENCY":
        # stockanalysis covers crypto ETFs (like BTC) or search
        return f"https://stockanalysis.com/?s={clean_sym.upper()}"
    else:
        # Default equity / stocks
        return f"https://stockanalysis.com/stocks/{clean_sym}/"

def parse_dividend_yield(info: dict) -> float | None:
    """Parse dividend yield into a standardized percentage value."""
    # dividendYield in yfinance is often already percentage (e.g., 0.33 -> 0.33%)
    # or trailingAnnualDividendYield might be decimal (0.0033)
    div_yield = info.get("dividendYield")
    if div_yield is not None and not pd.isna(div_yield):
        val = float(div_yield)
        # If dividendYield is less than 0.1 but greater than 0, check if it's decimal or small %
        # In yfinance, dividendYield for AAPL is ~0.33-0.5, for high yields like MO it is ~7.5
        # If it happens to be decimal (<0.1) and trailingAnnualDividendYield matches val, convert
        if val > 0:
            return round(val, 2)
            
    trailing = info.get("trailingAnnualDividendYield")
    if trailing is not None and not pd.isna(trailing):
        val = float(trailing)
        if 0 < val < 1:
            return round(val * 100, 2)
        elif val >= 1:
            return round(val, 2)
            
    return None

def fetch_symbol_data(symbol: str) -> dict:
    """Fetch all metrics and indicators for a single symbol."""
    print(f"Fetching data for: {symbol}...")
    ticker = yf.Ticker(symbol)
    
    # Retrieve info
    try:
        info = ticker.info or {}
    except Exception as e:
        print(f"Warning: could not fetch info for {symbol}: {e}")
        info = {}

    quote_type = info.get("quoteType", "EQUITY")
    name = info.get("shortName") or info.get("longName") or symbol
    currency = info.get("currency", "USD")
    
    # Price and Change
    price = info.get("regularMarketPrice") or info.get("currentPrice")
    change_pct = info.get("regularMarketChangePercent")
    
    # P/E Ratio
    pe = info.get("trailingPE")
    if pe is None or pd.isna(pe):
        pe = info.get("forwardPE")
    pe = round(float(pe), 2) if pe is not None and not pd.isna(pe) and pe > 0 else None
    
    # Dividend Yield (%)
    div_yield = parse_dividend_yield(info)
    
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
        print(f"Warning: error calculating daily RSI for {symbol}: {e}")

    try:
        df_weekly = ticker.history(period="2y", interval="1wk")
        if not df_weekly.empty and "Close" in df_weekly:
            rsi_weekly = calculate_rsi(df_weekly["Close"])
    except Exception as e:
        print(f"Warning: error calculating weekly RSI for {symbol}: {e}")

    try:
        df_monthly = ticker.history(period="5y", interval="1mo")
        if not df_monthly.empty and "Close" in df_monthly:
            rsi_monthly = calculate_rsi(df_monthly["Close"])
    except Exception as e:
        print(f"Warning: error calculating monthly RSI for {symbol}: {e}")

    # Standardize values
    price_val = round(float(price), 2) if price is not None and not pd.isna(price) else None
    change_val = round(float(change_pct), 2) if change_pct is not None and not pd.isna(change_pct) else 0.0

    stockanalysis_url = get_stockanalysis_url(symbol, quote_type)

    return {
        "symbol": symbol.upper(),
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
            results.append({
                "symbol": symbol.upper(),
                "name": symbol.upper(),
                "type": "UNKNOWN",
                "currency": "USD",
                "price": None,
                "change_pct": None,
                "pe": None,
                "dividend_yield": None,
                "rsi_daily": None,
                "rsi_weekly": None,
                "rsi_monthly": None,
                "stockanalysis_url": f"https://stockanalysis.com/?s={symbol.upper()}",
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
