# פריסה ב-Vercel – איך לראות את האפליקציה ב-Vercel

## 1. חיבור הפרויקט ל-Vercel

1. היכנס ל־**[vercel.com](https://vercel.com)** והתחבר עם חשבון GitHub.
2. לחץ **Add New…** → **Project**.
3. בחר **Import Git Repository** ובחר את הריפו:
   - **https://github.com/Di-biz/Amit_maymon** או  
   - **https://github.com/sasha463111/amit-maymon**  
   (לפי הריפו שמחובר אצלך ל־Vercel).
4. אשר את הפרויקט (Framework Preset: **Next.js** יזוהה אוטומטית).

## 2. משתני סביבה (חובה)

ב־Vercel: **Project → Settings → Environment Variables** הוסף:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ה-URL של פרויקט Supabase שלך |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ה-Anon Key של Supabase |

שמור, ואז הפעל **Redeploy** ל־Production (או שהדחיפה הבאה ל־master תעשה deploy אוטומטי).

## 3. אחרי ה-Deploy

- הדומיין יופיע ב־**Deployments** (למשל `tehila-bodyshop-crm-xxx.vercel.app`).
- כל דחיפה ל־**master** ב־GitHub תפעיל פריסה חדשה אוטומטית.

## אם הריפו כבר מחובר ל־Vercel

אם הפרויקט כבר קיים ב־Vercel ומחובר ל־GitHub, דחיפה ל־`master` (למשל ל־`vercel` remote) אמורה להפעיל deploy אוטומטי. בדוק ב־**Vercel Dashboard → Deployments** שהדחיפה האחרונה הסתיימה בהצלחה.
