# Chat History - Tehila Bodyshop CRM Development

## תאריך: 21.2.2026

### מטרת השיחה
תיקון בעיות ב-PREVIEW mode, במיוחד:
1. שלבי workflow לא מופיעים או מופיעים כ-DONE במקום ACTIVE
2. הוספת כפתור "תיק רנדומלי" ליצירת תיקים עם ערכים רנדומליים
3. שיפור UI עם gamification

---

## בעיות שזוהו וטופלו

### 1. שלבי Workflow לא מופיעים או מופיעים כ-DONE
**בעיה:** לאחר יצירת תיק חדש, כל השלבים מופיעים כ-DONE במקום ACTIVE, והתוכן שלהם לא מוצג.

**סיבות:**
- השלבים נשמרו ב-localStorage ללא `step_key`
- השרת לא יכול לגשת ל-localStorage, אז השלבים לא נטענים בשרת
- השלבים נוצרים עם run_id מסוים, אבל אחרי refresh נוצר run חדש עם ID אחר

**פתרונות שיושמו:**
- תיקון יצירת שלבים כך שייווצרו עם state='ACTIVE' (חוץ מ-OPEN_CASE שהוא DONE)
- תיקון טעינת שלבים לפי case_id דרך כל ה-runs, לא רק לפי run_id אחד
- הוספת לוגיקה שממחקת localStorage ישן אם מכיל שלבים ללא step_key
- הוספת לוגיקה בצד הלקוח שטוענת שלבים מ-localStorage אם השרת לא טען אותם
- תיקון הפונקציה `pick` כך שה-step_key תמיד נכלל בתוצאה

### 2. הוספת כפתור "תיק רנדומלי"
**תכונה:** כפתור ירוק ליד כפתור "פתיחת תיק" שיוצר תיק חדש עם ערכים רנדומליים:
- מספר רישוי רנדומלי (פורמט ישראלי)
- מספר תביעה רנדומלי
- תאריך עלייה לכביש רנדומלי (0-15 שנים אחורה)
- סוג ביטוח רנדומלי
- סוג תביעה רנדומלי

### 3. שיפור UI עם Gamification
- הוספת progress bar
- הוספת נקודות (10 נקודות לכל שלב שהושלם)
- הודעות מעודדות
- אנימציות לשלבים פעילים

---

## קבצים שעודכנו

### 1. `src/lib/supabase/mock-client.ts`
**שינויים:**
- תיקון יצירת שלבים כך שה-step_key תמיד נשמר
- תיקון טעינת שלבים מ-localStorage כך ששלבים ללא step_key מסוננים
- הוספת לוגיקה שמוודאת שה-step_key נכלל בתוצאה גם אם לא נבחר ב-select
- הוספת הודעות debug מפורטות

### 2. `src/app/(dashboard)/cases/[id]/CaseDetailClient.tsx`
**שינויים:**
- הוספת state `localSteps` לטעינת שלבים מ-localStorage
- הוספת useEffect שטוען שלבים מ-localStorage אם השרת לא טען אותם
- תיקון הצגת שלבים כך שהם משתמשים ב-effectiveSteps (localSteps או steps)
- הוספת לוגיקה שממחקת localStorage ישן אם מכיל שלבים ללא step_key
- הוספת הודעות debug מפורטות

### 3. `src/app/(dashboard)/cases/[id]/page.tsx`
**שינויים:**
- תיקון טעינת שלבים לפי case_id דרך כל ה-runs, לא רק לפי run_id אחד
- תיקון יצירת run כך שלא ייווצר run חדש אם כבר קיים אחד
- הוספת לוגיקה שיוצרת שלבים אם run קיים אבל אין שלבים

### 4. `src/app/(dashboard)/cases/CreateCaseButton.tsx`
**שינויים:**
- הוספת פונקציה `generateRandomValues()` שיוצרת ערכים רנדומליים
- הוספת כפתור "תיק רנדומלי" (ירוק) ליד כפתור "פתיחת תיק"
- הוספת פונקציה `handleRandomSubmit()` שיוצרת תיק עם ערכים רנדומליים

### 5. `src/app/actions/workflow.ts`
**שינויים:**
- תיקון יצירת שלבים כך שייווצרו עם state='ACTIVE' (חוץ מ-OPEN_CASE שהוא DONE)
- תיקון `completeActiveStep` כך שהוא מוצא את השלב הפעיל הראשון לפי order_index

---

## מצב נוכחי

### מה עובד:
- יצירת תיקים (רגיל או רנדומלי)
- יצירת שלבי workflow עם state נכון
- שמירת שלבים ב-localStorage

### מה עדיין לא עובד:
- השלבים לא נטענים אחרי refresh (השרת לא רואה אותם)
- השלבים לא מציגים תוכן (step_key הוא undefined)

### פתרונות מוצעים:
1. לוודא שהשלבים נטענים בצד הלקוח גם אחרי refresh
2. לוודא שה-step_key נשמר ונטען נכון
3. להוסיף הודעות debug מפורטות יותר

---

## הוראות להמשך

### כדי לחזור לנקודה זו:
1. רענן את הדף (F5)
2. פתח תיק חדש (או השתמש בכפתור "תיק רנדומלי")
3. בדוק את הקונסול - ההודעות יציגו מה קורה
4. אם השלבים עדיין לא מופיעים, בדוק את ההודעות בקונסול

### קבצים חשובים לבדיקה:
- `src/lib/supabase/mock-client.ts` - הלוגיקה של ה-mock client
- `src/app/(dashboard)/cases/[id]/CaseDetailClient.tsx` - הצגת השלבים
- `src/app/(dashboard)/cases/[id]/page.tsx` - טעינת השלבים בשרת

### הודעות Debug חשובות:
- `[MOCK CLIENT] Inserting workflow step:` - יצירת שלב
- `[MOCK CLIENT] Saved workflow step to localStorage:` - שמירת שלב
- `[MOCK CLIENT] Loading workflow steps:` - טעינת שלבים
- `[CASE DETAIL CLIENT] Steps state:` - מצב השלבים בצד הלקוח
- `[CASE DETAIL PAGE] Loaded steps by case_id:` - טעינת שלבים בשרת

---

## הערות טכניות

### PREVIEW Mode
- מופעל על ידי `NEXT_PUBLIC_PREVIEW_MODE=true` ב-.env.local
- משתמש ב-mock client במקום Supabase אמיתי
- כל הנתונים נשמרים ב-localStorage
- אין צורך ב-database או authentication

### Mock Client
- משתמש ב-`globalThis.__mockStore` לשמירת נתונים בין server ו-client
- טוען נתונים מ-localStorage בצד הלקוח
- יוצר נתונים חדשים ב-mutableStore

### Workflow Steps
- נוצרים עם state='ACTIVE' (חוץ מ-OPEN_CASE שהוא DONE)
- נשמרים ב-localStorage עם step_key
- נטענים לפי case_id דרך כל ה-runs

---

## סיכום

עבדנו על תיקון בעיות ב-PREVIEW mode, במיוחד בעיית הצגת שלבי workflow. הוספנו כפתור "תיק רנדומלי" ושיפרנו את ה-UI. עדיין יש בעיה עם טעינת השלבים אחרי refresh, אבל יש לוגיקה שצריכה לטפל בזה.

השיחה נשמרת אוטומטית ב-Cursor, וכל השינויים בקוד נשמרים ב-Git.
