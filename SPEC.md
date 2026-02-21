# Tehila Bodyshop CRM – Specification

## Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **Supabase** (Postgres, Auth Email+Password, Storage)
- **TailwindCSS**
- **Storage bucket:** `extras-images`
- **Auth:** Email + Password

## Project Overview

Bodyshop repair workflow from intake to closure.

### Roles

| Role             | Name   | Description                                      |
|------------------|--------|--------------------------------------------------|
| SERVICE_MANAGER  | ערן    | Controls workflow                                |
| OFFICE           | אילנה  | Closure workflow and closing case                |
| CEO              | עמית   | Approvals only via centralized approval screen   |
| PAINTER          | ארז    | Can only create bodywork extras                  |
| SERVICE_ADVISOR  | כנרת   | Read-only                                        |

Branch-based access control is enforced (RLS).

---

## Database

- **Migration:** `src/db/migrations/001_init.sql` (enums, tables, indexes, RLS)
- **Storage policies:** `src/db/migrations/002_storage.sql` (run after creating bucket `extras-images` in Dashboard)

### Tables

- `branches` – branches
- `profiles` – user profile (user_id = auth.users.id, full_name, role, branch_id)
- `cars` – vehicles per branch
- `cases` – repair cases (branch, car, statuses, fixcar_link, etc.)
- `case_workflow_runs` – workflow run per case (PROFESSIONAL / CLOSURE)
- `case_workflow_steps` – steps with step_key, state (PENDING/ACTIVE/DONE/SKIPPED)
- `ceo_approvals` – CEO approval records (type, status, rejection_note)
- `bodywork_extras` – extras with description, image_path (storage), status
- `notifications` – per user
- `audit_events` – entity_type, entity_id, action, user_id, payload

### Enums

- `user_role`, `general_status`, `parts_status`, `insurance_type`, `claim_type`
- `workflow_type`, `workflow_run_status`, `step_state`
- `approval_type`, `approval_status`, `extra_status`, `audit_entity_type`

---

## Workflow Logic

### Professional workflow (order)

1. OPEN_CASE  
2. FIXCAR_PHOTOS (requires `fixcar_link`)  
3. WHEELS_CHECK (required only if vehicle age > 2 years; else SKIPPED)  
4. PREP_ESTIMATE  
5. SUMMARIZE_ESTIMATE  
6. SEND_TO_APPRAISER  
7. WAIT_APPRAISER_APPROVAL  
8. ENTER_WORK (requires `parts_status = AVAILABLE`)  
9. QUALITY_CONTROL  
10. WASH  
11. READY_FOR_OFFICE  

### Closure workflow

1. CLOSURE_VERIFY_DETAILS_DOCS  
2. CLOSURE_PROFORMA_IF_NEEDED  
3. CLOSURE_PREPARE_CLOSING_FORMS  
4. CLOSE_CASE  

---

## Blocking Rules

- **ENTER_WORK:** blocked if `parts_status != AVAILABLE`
- **READY_FOR_OFFICE / CLOSE_CASE:** blocked if any `bodywork_extras.status = IN_TREATMENT` or required CEO approvals missing/rejected
- **FIXCAR_PHOTOS:** cannot complete without `fixcar_link`
- **WHEELS_CHECK:** SKIPPED automatically if vehicle age ≤ 2 years
- All transitions must create an `audit_events` record

---

## Bodywork Extras

- **PAINTER** can create: `description` + image upload to bucket `extras-images`
- Default status: `IN_TREATMENT`
- Only **SERVICE_MANAGER** can change status: IN_TREATMENT | REJECTED | DONE
- Extras with status IN_TREATMENT block closure

---

## CEO Approvals

- Centralized approval screen for CEO
- Types: `ESTIMATE_AND_DETAILS`, `WHEELS_CHECK`
- CEO can APPROVE or REJECT with note
- Rejected approvals notify SERVICE_MANAGER

---

## Environment

Use `.env.local` (never commit):

- `NEXT_PUBLIC_SUPABASE_URL` — project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (client-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — only for server-side admin if needed; do not expose to client

## Auth

- Supabase Email + Password
- `profiles.id` = `auth.users.id`; profile has `full_name`, `role`, `branch_id`

---

## File Structure (foundation)

```
src/
  lib/supabase/client.ts   # Browser client (@supabase/ssr)
  lib/supabase/server.ts  # Server client (@supabase/ssr)
  types/database.ts       # DB types + enums
  db/migrations/
    001_init.sql
    002_storage.sql
  app/
    layout.tsx
    page.tsx
    globals.css
  middleware.ts           # Supabase session refresh
```

---

## Next Steps (after foundation)

- Login page
- Dashboard (SERVICE_MANAGER – open cases)
- CEO approvals screen
- PAINTER extras screen
- OFFICE closure screen

---

## Development Rules

- All DB writes must respect RLS
- All transitions must write `audit_events`
- All workflow steps stored in `case_workflow_steps`
- No direct status jumps without validation
- Keep code modular and production-ready
