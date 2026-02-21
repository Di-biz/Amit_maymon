# תהליך עסקי — מערכת CRM מוסך פחחות תהילה

## מטרה

ניהול תהליך תיקון רכב במוסך פחחות — מהגעת הרכב הפיזית למוסך ועד סגירת התיק האדמיניסטרטיבית.

**עקרון מרכזי:** המערכת מונעת על־ידי צ'קליסט. המשתמש לא משנה סטטוס ידנית; רק "סמן בוצע" מקדם שלב.

---

## מזהה תיק

- **מספר רישוי (plate_number)** — חובה
- **מספר תביעה (claim_number)** — אופציונלי; אם אין = תיק פרטי
- **case_key** = `{plate}-{claim || "PRIVATE"}`
- **תאריך עלייה לכביש (first_registration_date)** — לחישוב גיל רכב (בדיקת גלגלים)

---

## תפקידים

| תפקיד | שם | אחריות |
|--------|-----|--------|
| **SERVICE_MANAGER** | ערן | בעלים תפעוליים: צילום FixCar, בדיקת גלגלים, אומדן, שליחה לשמאי, אישור כניסה לעבודה, QC, שטיפה, "מוכן למשרד", ניהול חלקים ותוספות, קבלת התראות דחיית CEO |
| **OFFICE** | אילנה | סגירה אדמיניסטרטיבית: אימות מסמכים, פרופורמה, טפסי סגירה, סגירת תיק |
| **CEO** | עמית | אישורים בלבד (אומדן, גלגלים); לא משנה workflow; חוסם סגירה אם נדחה |
| **PAINTER** | ארז | רק יצירת תוספות פחחות (תיאור + תמונה); לא משנה סטטוסים |
| **SERVICE_ADVISOR** | כנרת | צפייה בלבד |

---

## סניפים

- **NETIVOT**
- **ASHKELON**

משתמשים רואים רק את סניפם; CEO רואה את כל הסניפים.

---

## Workflow מקצועי (ערן)

1. **OPEN_CASE** — יצירת תיק  
2. **FIXCAR_PHOTOS** — צילום שמאות (חובה: fixcar_link)  
3. **WHEELS_CHECK** — רק אם גיל רכב > 2 שנים; אחרת SKIPPED אוטומטית  
4. **PREP_ESTIMATE** — הכנת אומדן  
5. **SUMMARIZE_ESTIMATE** — סיכום אומדן  
6. **SEND_TO_APPRAISER** — שליחה לשמאי  
7. **WAIT_APPRAISER_APPROVAL** — ערן מסמן שאושר  
8. **ENTER_WORK** — חסום אם parts_status ≠ AVAILABLE  
9. **QUALITY_CONTROL**  
10. **WASH**  
11. **READY_FOR_OFFICE** — חסום אם יש extras IN_TREATMENT או אישור CEO חסר/נדחה  

---

## Workflow סגירה (אילנה)

1. **CLOSURE_VERIFY_DETAILS_DOCS**  
2. **CLOSURE_PROFORMA_IF_NEEDED**  
3. **CLOSURE_PREPARE_CLOSING_FORMS**  
4. **CLOSE_CASE** — סגירה סופית (closed_at, general_status = COMPLETED)

---

## תוספות פחחות (ארז + ערן)

- ארז יוצר: **description** + **תמונה** (Storage). סטטוס ברירת מחדל: IN_TREATMENT.
- ערן משנה סטטוס: IN_TREATMENT | REJECTED | DONE.
- תוספת ב־IN_TREATMENT **חוסמת** READY_FOR_OFFICE ו־CLOSE_CASE.

---

## אישורי CEO (עמית)

- סוגים: ESTIMATE_AND_DETAILS, WHEELS_CHECK.
- עמית מאשר או דוחה (עם הערה). דחייה → התראה לערן וחסימת סגירה.

---

## חוקי חסימה

- **ENTER_WORK:** חסום אם parts_status ≠ AVAILABLE  
- **FIXCAR_PHOTOS:** לא ניתן להשלים בלי fixcar_link  
- **READY_FOR_OFFICE / CLOSE_CASE:** חסום אם יש extras IN_TREATMENT או אישור CEO חסר/נדחה  

---

## אודיט והתראות

- כל מעבר שלב, אישור, תוספת, חסימה וסגירה — נרשמים ב־audit_events.
- התראות: דחיית CEO, תוספת חדשה, פעולה חסומה, שינוי סטטוס.
