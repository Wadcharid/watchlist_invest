# 📈 Personal Investment Watchlist (เชื่อมโยง StockAnalysis.com)

ระบบส่วนตัวสำหรับติดตามและตรวจสอบข้อมูลการลงทุน หุ้นสหรัฐฯ (Stocks), กองทุนรวมดัชนี (ETFs) และสินทรัพย์ดิจิทัล (Crypto) พร้อมการคำนวณดัชนีทางเทคนิคหลายกรอบเวลา (Multi-timeframe RSI) และเชื่อมโยงไปยัง [StockAnalysis.com](https://stockanalysis.com/) โดยตรง

🌐 **เว็บไซต์เปิดใช้งาน (GitHub Pages):** [https://wadcharid.github.io/watchlist_invest/](https://wadcharid.github.io/watchlist_invest/)

---

## ✨ ฟีเจอร์หลัก (Key Features)

1. **Watchlist จัดการได้ยืดหยุ่น (Add/Remove Assets):**
   - สามารถพิมพ์เพิ่ม Ticker หรือกดลบสินทรัพย์ที่ต้องการได้ทันทีจากหน้าเว็บ
   - บันทึกการตั้งค่าใน `localStorage` ของเบราว์เซอร์อัตโนมัติ
   - มีระบบซิงก์ข้อมูลกลับไปยัง `data/watchlist.json` บน GitHub หรือคัดลอก JSON เพื่อนำไปอัปเดตได้ในคลิกเดียว

2. **แสดงข้อมูลสำคัญครบถ้วนในรูปแบบตาราง:**
   - **ราคาล่าสุด (Latest Price):** อัปเดตราคาตลาดล่าสุด
   - **% Change (การเปลี่ยนแปลง 24 ชม.):** พร้อมสีแยกสถานะชัดเจน (เขียว/แดง)
   - **P/E Ratio:** อัตราส่วนราคาต่อกำไร
   - **Daily RSI (14):** Relative Strength Index กรอบเวลารายวัน (14 วัน)
   - **Weekly RSI (14):** RSI กรอบเวลารายสัปดาห์ (14 สัปดาห์)
   - **Monthly RSI (14):** RSI กรอบเวลารายเดือน (14 เดือน)
   - **% Dividend Yield:** อัตราเงินปันผลตอบแทน

3. **ระบบแจ้งเตือนระดับ RSI (Heatmap Indicator):**
   - 🟢 **Oversold (RSI < 30):** โซนขายมากเกินไป / มีโอกาสเกิดการรีบาวด์
   - ⚪ **Neutral (RSI 30 - 70):** โซนราคาปกติ
   - 🔴 **Overbought (RSI > 70):** โซนซื้อมากเกินไป / ระวังแรงขายทำกำไร

4. **เชื่อมโยง StockAnalysis.com:**
   - ทุกลำดับสินทรัพย์มีปุ่มกดเปิดไปยังหน้าข้อมูลเชิงลึกบน [StockAnalysis.com](https://stockanalysis.com/) โดยตรง เช่น:
     - หุ้น: `https://stockanalysis.com/stocks/{symbol}/`
     - กองทุน (ETF): `https://stockanalysis.com/etf/{symbol}/`
     - คริปโต: ค้นหาหรือเปิดหน้า ETF ที่เกี่ยวข้อง

5. **ระบบคำนวณและอัปเดตข้อมูลอัตโนมัติ (Automated by GitHub Actions):**
   - GitHub Actions รันอัปเดตข้อมูลทุกวันทำการตลาดสหรัฐฯ (จันทร์ - ศุกร์) เวลา 22:00 UTC (หลังตลาดปิด)
   - สามารถกดปุ่ม **Run workflow** ด้วยตนเองได้ตลอดเวลาผ่าน GitHub Actions หรือสั่งงานผ่านหน้าเว็บ

---

## 🚀 วิธีตั้งค่าเปิดใช้งาน GitHub Pages

เมื่อนำโค้ดขึ้น GitHub Repository [Wadcharid/watchlist_invest](https://github.com/Wadcharid/watchlist_invest) แล้ว ให้เปิดใช้งานหน้าเว็บดังนี้:

1. ไปที่ **Settings** ของ Repository บน GitHub
2. เลือกเมนู **Pages** ที่แถบเมนูด้านซ้าย
3. ในส่วน **Build and deployment**:
   - Source: เลือก **Deploy from a branch**
   - Branch: เลือก **main** และโฟลเดอร์ **/ (root)**
4. กด **Save**
5. รอประมาณ 1-2 นาที คุณจะได้ URL หน้าเว็บที่เข้าถึงได้ทุกที่ เช่น `https://wadcharid.github.io/watchlist_invest/`

---

## ⚙️ วิธีให้สิทธิ์ GitHub Actions อัปเดตไฟล์อัตโนมัติ

เพื่อให้ GitHub Actions สามารถเขียนไฟล์ `data/stocks.json` กลับมาที่ Repository ได้:

1. ไปที่ **Settings** > **Actions** > **General**
2. เลื่อนลงมาที่หัวข้อ **Workflow permissions**
3. เลือก **Read and write permissions**
4. กด **Save**

---

## 💻 วิธีการรันและทดสอบในเครื่องคอมพิวเตอร์ (Local Development)

### 1. ติดตั้ง Library ที่จำเป็น:
```bash
pip install -r requirements.txt
```

### 2. สั่งดึงข้อมูลและคำนวณ RSI:
```bash
python scripts/fetch_data.py
```
ผลลัพธ์จะถูกบันทึกลงในไฟล์ `data/stocks.json`

### 3. เปิดหน้า Dashboard ในเบราว์เซอร์:
สามารถเปิดไฟล์ `index.html` ในเบราว์เซอร์ได้ทันที หรือรัน Local Server:
```bash
python -m http.server 8080
```
แล้วเปิดเบราว์เซอร์ไปที่ `http://localhost:8080`

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
watchlist_invest/
├── .github/
│   └── workflows/
│       └── update_data.yml      # GitHub Actions รันคำนวณข้อมูลอัตโนมัติ
├── data/
│   ├── watchlist.json           # รายชื่อ Symbol ที่ต้องการติดตาม
│   └── stocks.json              # ข้อมูลราคา, RSI และตัวชี้วัดที่คำนวณแล้ว
├── scripts/
│   └── fetch_data.py            # สคริปต์ Python คำนวณ RSI รายวัน/สัปดาห์/เดือน
├── index.html                   # หน้าเว็บ Dashboard แสดงผลตาราง
├── app.js                       # Logic ค้นหา, เรียงลำดับ, กรอง, เพิ่ม/ลบ, ซิงก์ GitHub
├── style.css                    # การออกแบบสไตล์โมเดิร์น Dark Theme
├── requirements.txt             # รายชื่อไลบรารี Python (yfinance, pandas)
└── README.md                    # เอกสารคู่มือการใช้งาน
```

---

## 📝 ลิขสิทธิ์และการนำไปใช้
- ข้อมูลการเงินดึงผ่าน Yahoo Finance และเชื่อมโยงหน้าข้อมูลกับ [StockAnalysis.com](https://stockanalysis.com/)
- พัฒนาขึ้นเพื่อการติดตามพอร์ตและวิเคราะห์ข้อมูลการลงทุนส่วนตัว
