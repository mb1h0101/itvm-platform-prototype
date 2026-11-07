# LINE 智慧出席管理系統

這是第一版 MVP：學生與教師都從 LINE LIFF 進入，用於課程簽到、照片佐證、定位紀錄、教師後台管理與 CSV 匯出。

- 學生：填學號、姓名、班級，拍攝簽到照片並送出出席紀錄。
- 教師：在 LINE 裡查看出席紀錄、照片、定位、課程節次、審核狀態，並匯出 CSV。
- 管理者：可同步學生名單，讓學生首次簽到時自動綁定 LINE userId。
- 資料庫：Supabase Postgres。
- 照片：Supabase Storage bucket `checkin-photos`。
- 部署：Vercel。

## 本機開發

```bash
npm install
npm run dev
```

## Vercel 部署設定

Vercel 匯入專案後請設定：

- Framework Preset：`Vite`
- Build Command：`npm run build`
- Output Directory：`dist`
- Install Command：`npm install`

Environment Variables：

```env
VITE_LINE_LIFF_ID=你的 LIFF ID
VITE_SUPABASE_URL=https://你的專案.supabase.co
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
```

第一次建立 LIFF App 時如果還沒有 LIFF ID，可以先在 Vercel 只填 Supabase 兩個變數部署，拿到 HTTPS 網址後回 LINE Developers 建立 LIFF App，再把 LIFF ID 補回 Vercel 環境變數並重新部署。

## Supabase 設定

1. 建立 Supabase project。
2. 在 SQL Editor 執行 `supabase/schema.sql`。
3. 建立或確認 Storage bucket：`checkin-photos`。
4. bucket 可先設定 public，方便 MVP 直接顯示簽到照片。
5. 把教師或管理者的 LINE userId 寫入 `teachers` 資料表，該 LINE 帳號才會看到後台。

## LINE Developers 設定

1. 建立 Provider。
2. 建立 LINE Login Channel。
3. 建立 LIFF App。
4. Size 選 `Full`。
5. Endpoint URL 填 Vercel 的 HTTPS 網址，例如 `https://你的專案.vercel.app/`。
6. Scope 勾選 `profile`。
7. Scan QR 開啟。
8. Module mode 可先關閉。
9. 複製 LIFF ID，填入 `.env` 或 Vercel Environment Variables。

## 資安提醒

目前 MVP 為了快速驗證，Supabase RLS policy 比較開。正式給學校、課程或大型活動使用前，建議補 Supabase Edge Functions 或後端 API，把教師權限、照片上傳、出席寫入改成伺服器端檢查。

## 應用情境

本系統可用於課程點名、研習活動、講座出席、社團會議或需要快速蒐集到場證明的場域。它用 LINE 降低登入門檻，用照片與定位保存簽到證據，用後台協助教師整理出席資料。
