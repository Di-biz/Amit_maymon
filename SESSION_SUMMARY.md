# סיכום שינויים - Tehila Bodyshop CRM
## תאריך: היום

---

## 1. תיקון שמירת שלבי סגירה (Closure Workflow Persistence)

### בעיה:
- שלבי הסגירה לא נשמרו אחרי רענון דף
- כשחוזרים לדף התיק, השלבים חזרו למצב הקודם

### פתרון:
- **קובץ**: `src/app/(dashboard)/closure/[id]/ClosureDetailClient.tsx`
- הוספתי `useEffect` שטוען מחדש את השלבים מהמסד נתונים כשה-component נטען
- עדכון `completePreviewStep` לטעון מחדש את השלבים אחרי השלמה
- הוספתי `completingStepId` state כדי למנוע טעינה כפולה

### קוד רלוונטי:
```typescript
// טעינה מחדש של steps אחרי השלמה
useEffect(() => {
  if (!isPreview) return;
  if (completingStepId !== null) return;
  // ... טעינת steps מהמסד נתונים
}, [isPreview, caseId, completingStepId]);
```

---

## 2. הוספת אישור CEO לסגירת תיק

### תכונה חדשה:
- אישור CEO נדרש לפני סגירת תיק סופית
- האישור נוצר אוטומטית כשמגיעים לשלב `CLOSURE_PREPARE_CLOSING_FORMS`
- שלב `CLOSE_CASE` חסום עד שהאישור מאושר

### שינויים:

#### `src/types/database.ts`:
- הוספתי `'CASE_CLOSURE'` ל-`ApprovalType`

#### `src/app/actions/workflow.ts`:
- יצירת אישור CEO אוטומטית בשלב `CLOSURE_PREPARE_CLOSING_FORMS`
- בדיקת אישור לפני סגירת תיק ב-`CLOSE_CASE`
- החזרת שגיאה אם האישור לא מאושר

#### `src/app/(dashboard)/closure/[id]/ClosureDetailClient.tsx`:
- הוספתי `closureApprovalStatus` prop
- בדיקת אישור סגירה לפני הצגת כפתור סגירה
- הודעות ברורות על חסימות

#### `src/app/(dashboard)/closure/[id]/page.tsx`:
- טעינת סטטוס אישור סגירה מהמסד נתונים
- העברת הסטטוס ל-client component

#### `src/app/(dashboard)/approvals/ApprovalsList.tsx`:
- הוספתי `'CASE_CLOSURE': 'אישור סגירת תיק'` ל-`APPROVAL_TYPE_LABELS`
- האישורים מופיעים במסך האישורים של עמית

---

## 3. שינוי ENTER_WORK מהחסימה להתראה בלבד

### בעיה:
- שלב `ENTER_WORK` היה חסום לחלוטין אם חלקים לא זמינים
- המשתמש לא יכול היה להמשיך גם אם רצה

### פתרון:
- **קובץ**: `src/app/(dashboard)/cases/[id]/CaseDetailClientV2.tsx`
- הסרתי את החסימה - השלב יכול להשלים גם אם חלקים לא זמינים
- הוספתי אזהרה ויזואלית מתחת לשלב במקום חסימה
- **קובץ**: `src/app/actions/workflow.ts`
- הסרתי את החזרת השגיאה ב-`ENTER_WORK`
- הוספתי audit event עם אזהרה במקום

### קוד:
```typescript
// במקום חסימה - רק התראה
if (s.step_key === 'ENTER_WORK' && partsStatus !== 'AVAILABLE') {
  showWarning = true;
  warningMessage = 'חלקים לא זמינים - יש לעדכן את סטטוס החלקים ל"זמינים"';
}
```

---

## 4. תיקון איפוס צ'קליסט כשמשנים parts_status

### בעיה:
- כשמשנים את `parts_status`, ה-`router.refresh()` מאפס את כל הצ'קליסט

### פתרון:
- **קובץ**: `src/app/(dashboard)/cases/[id]/CaseDetailClientV2.tsx`
- הסרתי את `router.refresh()` מ-`savePartsStatus`
- הוספתי הודעה "חלקים עודכנו כזמינים" כשמשנים לזמינים
- הוספתי audit event לעדכון סטטוס חלקים
- הצ'קליסט נשאר במצבו ולא מתאפס

---

## 5. הוספת קבצים ומסמכים לתיק

### תכונה חדשה:
- אפשרות להעלות קבצים לכל תיק
- תצוגה של כל הקבצים עם אפשרות הורדה ומחיקה
- שמירה ב-Supabase Storage ב-bucket `case-documents`

### קבצים חדשים:

#### `src/db/migrations/005_case_documents.sql`:
- יצירת טבלת `case_documents`
- RLS policies: branch-scoped access
- Indexes לביצועים

#### `src/app/actions/documents.ts`:
- `uploadCaseDocument` - העלאת קובץ
- `deleteCaseDocument` - מחיקת קובץ
- בדיקות הרשאות (branch-scoped)
- Audit events

#### `src/types/database.ts`:
- הוספתי `CaseDocument` interface

#### `src/app/(dashboard)/cases/[id]/CaseDetailClientV2.tsx`:
- UI להעלאת קבצים
- תצוגת רשימת קבצים
- אפשרות מחיקה (למשתמשים מורשים)
- תמיכה בתמונות (תצוגה מיוחדת)

### הערה חשובה:
- צריך ליצור bucket `case-documents` ב-Supabase Storage
- להריץ את migration `005_case_documents.sql`

---

## 6. תצוגה מלאה ממסך אישורים

### תכונה:
- כפתור "צפה בתיק המלא" במסך האישורים של עמית
- מוביל לדף התיק המלא עם כל הפרטים

### שינויים:
- **קובץ**: `src/app/(dashboard)/approvals/ApprovalsList.tsx`
- הוספתי כפתור Link לדף התיק המלא
- מופיע לפני כפתורי האישור/דחייה

---

## 7. Badge התראות עם תמיכה ב-PWA

### תכונה:
- Badge קטן עם מספר התראות לא נקראות
- מופיע ליד התפקיד ב-header
- תמיכה ב-PWA עם browser notifications

### קבצים:

#### `src/components/NotificationsBadge.tsx` (חדש):
- קומפוננט שמציג את מספר ההתראות
- Polling כל 10 שניות (במקום realtime subscriptions - לא עובד עם mock client)
- זיהוי התראות חדשות והצגת browser notification
- בקשת הרשאות אוטומטית

#### `src/app/(dashboard)/layout.tsx`:
- הוספתי את `NotificationsBadge` ליד התפקיד
- עם `relative` positioning כדי שה-badge יופיע מעל

### תיקון:
- במקור ניסיתי להשתמש ב-`supabase.channel()` ל-realtime subscriptions
- זה לא עבד עם mock client, אז עברתי ל-polling
- Browser notifications עדיין עובדות

---

## 8. תיקון שמירת צ'קליסט כשחוזרים לדף

### בעיה:
- כשחוזרים לדף התיק, הצ'קליסט לא נטען מהמסד נתונים

### פתרון:
- **קובץ**: `src/app/(dashboard)/cases/[id]/CaseDetailClientV2.tsx`
- הוספתי `useEffect` שטוען מחדש את ה-steps מהמסד נתונים כשה-component נטען
- טעינה גם ב-preview mode וגם ב-production mode

### קוד:
```typescript
useEffect(() => {
  if (!caseId) return;
  
  const loadSteps = async () => {
    // טעינת steps מהמסד נתונים
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index, completed_at')
      .in('run_id', runIds)
      .order('order_index');
    
    if (stepsData && stepsData.length > 0) {
      setLocalSteps(stepsData as StepRow[]);
    }
  };

  loadSteps().catch(console.error);
}, [caseId, steps]);
```

---

## 9. הוספת השלב הבא בדף התיקים

### תכונה:
- עמודה חדשה בטבלת התיקים: "השלב הבא"
- מציגה את השלב הפעיל הבא שצריך להשלים

### שינויים:

#### `src/app/(dashboard)/cases/page.tsx`:
- טעינת workflow runs ו-steps לכל התיקים
- חישוב השלב הפעיל הבא לכל תיק
- הוספת `nextStep` ל-`casesWithMeta`

#### `src/app/(dashboard)/cases/CasesTable.tsx`:
- הוספתי עמודה `nextStep` לטבלה
- תצוגה עם badge כחול

### לוגיקה:
```typescript
// מציאת השלב הפעיל הבא
const activeStep = sortedSteps.find((s) => s.state === 'ACTIVE');
if (activeStep) {
  const stepKey = activeStep.step_key;
  caseIdToNextStep.set(caseId, STEP_LABELS[stepKey] || stepKey);
}
```

---

## 10. הוספת העלאת קבצים בפתיחת תיק

### תכונה:
- אפשרות להעלות קבצים כבר בפתיחת תיק חדש
- הקבצים מועלים אוטומטית אחרי יצירת התיק

### שינויים:

#### `src/app/(dashboard)/cases/CreateCaseButton.tsx`:
- הוספתי `files` state
- הוספתי `input type="file" multiple` בטופס
- העלאת קבצים אחרי יצירת התיק (גם בטופס רגיל וגם ב-רנדומלי)
- תצוגה של הקבצים שנבחרו

### קוד:
```typescript
// העלאת קבצים אחרי יצירת תיק
if (newCaseId && files.length > 0) {
  const { uploadCaseDocument } = await import('@/app/actions/documents');
  for (const file of files) {
    const formData = new FormData();
    formData.append('case_id', newCaseId);
    formData.append('file', file);
    await uploadCaseDocument(formData);
  }
}
```

---

## 11. תיקונים נוספים

### תיקון תצוגת תיקים סגורים:
- הסתרת אזהרות אחרי שסגירת תיק הושלמה
- בדיקת `isCaseClosed` לפני הצגת אזהרות

### תיקון שגיאת initialization:
- תיקון סדר הגדרת משתנים ב-`cases/page.tsx`
- `caseIdToNextStep` מוגדר לפני השימוש בו

---

## קבצים שעודכנו:

### קבצים חדשים:
1. `src/db/migrations/005_case_documents.sql`
2. `src/app/actions/documents.ts`
3. `src/components/NotificationsBadge.tsx`

### קבצים שעודכנו:
1. `src/types/database.ts` - הוספת `CASE_CLOSURE` ו-`CaseDocument`
2. `src/app/(dashboard)/closure/[id]/ClosureDetailClient.tsx`
3. `src/app/(dashboard)/closure/[id]/page.tsx`
4. `src/app/(dashboard)/cases/[id]/CaseDetailClientV2.tsx`
5. `src/app/(dashboard)/cases/[id]/page.tsx`
6. `src/app/(dashboard)/cases/page.tsx`
7. `src/app/(dashboard)/cases/CasesTable.tsx`
8. `src/app/(dashboard)/cases/CreateCaseButton.tsx`
9. `src/app/(dashboard)/approvals/ApprovalsList.tsx`
10. `src/app/(dashboard)/layout.tsx`
11. `src/app/actions/workflow.ts`

---

## הערות חשובות:

1. **Storage Bucket**: צריך ליצור bucket `case-documents` ב-Supabase Storage
2. **Migration**: להריץ `005_case_documents.sql` אחרי יצירת ה-bucket
3. **Preview Mode**: כל השינויים עובדים גם ב-preview mode (עם mock client)
4. **RLS**: כל השינויים מכבדים RLS policies
5. **Audit Events**: כל הפעולות החשובות נרשמות ב-`audit_events`

---

## מבנה הנתונים:

### טבלת `case_documents`:
- `id` (UUID)
- `case_id` (UUID, FK to cases)
- `file_name` (TEXT)
- `file_path` (TEXT) - path ב-Storage
- `file_size` (BIGINT)
- `mime_type` (TEXT)
- `uploaded_by` (UUID, FK to profiles)
- `created_at`, `updated_at`

### סוג אישור חדש:
- `CASE_CLOSURE` - אישור סגירת תיק

---

## Workflow Logic:

### Closure Workflow:
1. `CLOSURE_VERIFY_DETAILS_DOCS` - אימות פרטים ומסמכים
2. `CLOSURE_PROFORMA_IF_NEEDED` - פרופורמה במידת הצורך
3. `CLOSURE_PREPARE_CLOSING_FORMS` - **יוצר אישור CEO אוטומטית**
4. `CLOSE_CASE` - **חסום עד אישור CEO**

### Professional Workflow:
- `ENTER_WORK` - **לא חוסם יותר, רק מציג התראה** אם חלקים לא זמינים

---

## UI/UX Improvements:

1. **הודעות ברורות** - כל חסימה מציגה סיבה ברורה
2. **תצוגה ויזואלית** - badges, צבעים, אייקונים
3. **פרסיסטנס** - כל השינויים נשמרים גם אחרי רענון
4. **Real-time updates** - badge התראות מתעדכן אוטומטית
5. **PWA Ready** - תמיכה בהתראות דפדפן

---

## Testing Notes:

- כל השינויים נבדקו ב-preview mode
- יש לוודא ש-Storage bucket נוצר
- יש לוודא ש-migration הורץ
- יש לבדוק הרשאות RLS

---

## Git Commits:

1. `Add closure workflow persistence and CEO approval for case closure`
2. `Fix closure workflow: hide warnings after closure, change ENTER_WORK to warning only, fix parts status reset`
3. `Add case documents, approval case view, and notifications badge with PWA support`
4. `Fix NotificationsBadge: use polling instead of realtime subscriptions`
5. `Fix checklist persistence, add next step to cases list, add file upload to create case`
6. `Fix caseIdToNextStep initialization order`
7. `Fix casesWithMeta definition order`

---

## Next Steps (להמשך עבודה):

1. יצירת Storage bucket `case-documents` ב-Supabase
2. הרצת migration `005_case_documents.sql`
3. בדיקת RLS policies
4. בדיקת PWA notifications בדפדפן
5. בדיקת העלאת קבצים בגדלים שונים

---

## Technical Stack:

- **Next.js 14+** App Router
- **TypeScript**
- **Supabase** (Postgres, Auth, Storage)
- **TailwindCSS**
- **Preview Mode** עם mock client (localStorage)

---

## Important Patterns:

1. **Preview Mode**: כל הקוד צריך לעבוד גם ב-preview mode
2. **RLS**: כל הפעולות מכבדות Row Level Security
3. **Audit Events**: כל פעולה חשובה נרשמת
4. **State Management**: שימוש ב-localState + server state
5. **Error Handling**: try-catch-finally בכל מקום

---

סיכום זה מכיל את כל השינויים שבוצעו היום. כל השינויים עלו ל-Git וזמינים ב-branch `master`.
