/**
 * Mock data for PREVIEW mode (no Supabase). Allows viewing full CRM flow without DB/auth.
 */
import type {
  Branch,
  Profile,
  Car,
  Case,
  CaseWorkflowRun,
  CaseWorkflowStep,
  CeoApproval,
  BodyworkExtra,
  Notification,
  AuditEvent,
} from '@/types/database';

const now = new Date().toISOString();
const past = new Date(Date.now() - 86400000 * 3).toISOString();

export const PREVIEW_USER_ID = '00000000-0000-0000-0000-000000000001';

export const MOCK_BRANCHES: Branch[] = [
  { id: '10000000-0000-0000-0000-000000000001', name: 'נתיבות', created_at: now, updated_at: now },
  { id: '10000000-0000-0000-0000-000000000002', name: 'אשקלון', created_at: now, updated_at: now },
];

export const MOCK_PROFILES: Profile[] = [
  {
    id: PREVIEW_USER_ID,
    full_name: 'משתמש תצוגה מקדימה',
    role: 'SERVICE_MANAGER',
    branch_id: MOCK_BRANCHES[0].id,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];

export const MOCK_CARS = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    branch_id: MOCK_BRANCHES[0].id,
    license_plate: '1234567',
    make: 'טויוטה',
    model: 'קורולה',
    year: 2020,
    vin: null,
    first_registration_date: '2020-06-01',
    created_at: now,
    updated_at: now,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    branch_id: MOCK_BRANCHES[0].id,
    license_plate: '7654321',
    make: 'מאזדה',
    model: '3',
    year: 2021,
    vin: null,
    first_registration_date: '2021-01-15',
    created_at: now,
    updated_at: now,
  },
];

export const MOCK_CASES: Case[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    branch_id: MOCK_BRANCHES[0].id,
    car_id: MOCK_CARS[0].id,
    case_key: '1234567-PRIVATE',
    claim_number: null,
    general_status: 'IN_PROGRESS',
    parts_status: 'AVAILABLE',
    insurance_type: 'PRIVATE',
    claim_type: 'PRIVATE',
    fixcar_link: 'https://fixcar.example/1',
    opened_at: past,
    treatment_finished_at: null,
    closed_at: null,
    created_by: PREVIEW_USER_ID,
    created_at: past,
    updated_at: now,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    branch_id: MOCK_BRANCHES[0].id,
    car_id: MOCK_CARS[1].id,
    case_key: '7654321-12345',
    claim_number: '12345',
    general_status: 'IN_PROGRESS',
    parts_status: 'AVAILABLE',
    insurance_type: 'COMPREHENSIVE',
    claim_type: 'ACCIDENT',
    fixcar_link: 'https://fixcar.example/2',
    opened_at: past,
    treatment_finished_at: past,
    closed_at: null,
    created_by: PREVIEW_USER_ID,
    created_at: past,
    updated_at: now,
  },
];

export const MOCK_RUNS: CaseWorkflowRun[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    case_id: MOCK_CASES[0].id,
    workflow_type: 'PROFESSIONAL',
    status: 'ACTIVE',
    created_at: past,
    updated_at: now,
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    case_id: MOCK_CASES[1].id,
    workflow_type: 'PROFESSIONAL',
    status: 'COMPLETED',
    created_at: past,
    updated_at: now,
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    case_id: MOCK_CASES[1].id,
    workflow_type: 'CLOSURE',
    status: 'ACTIVE',
    created_at: past,
    updated_at: now,
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    case_id: MOCK_CASES[0].id,
    workflow_type: 'CLOSURE',
    status: 'ACTIVE',
    created_at: past,
    updated_at: now,
  },
];

const PRO_STEPS = [
  'OPEN_CASE',
  'FIXCAR_PHOTOS',
  'WHEELS_CHECK',
  'PREP_ESTIMATE',
  'SUMMARIZE_ESTIMATE',
  'SEND_TO_APPRAISER',
  'WAIT_APPRAISER_APPROVAL',
  'ENTER_WORK',
  'QUALITY_CONTROL',
  'WASH',
  'READY_FOR_OFFICE',
] as const;
const CLOSURE_STEPS = ['CLOSURE_VERIFY_DETAILS_DOCS', 'CLOSURE_PROFORMA_IF_NEEDED', 'CLOSURE_PREPARE_CLOSING_FORMS', 'CLOSE_CASE'] as const;

export const MOCK_STEPS: CaseWorkflowStep[] = [
  ...PRO_STEPS.map((step_key, i) => ({
    id: `50000000-0000-0000-0000-${String(100 + i).padStart(12, '0')}`,
    run_id: MOCK_RUNS[0].id,
    step_key,
    state: (i === 0 ? 'DONE' : i === 1 ? 'ACTIVE' : 'PENDING') as 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED',
    order_index: i,
    activated_at: i === 1 ? past : null,
    completed_at: i === 0 ? past : null,
    completed_by: i === 0 ? PREVIEW_USER_ID : null,
    created_at: now,
    updated_at: now,
  })),
  ...CLOSURE_STEPS.map((step_key, i) => ({
    id: `50000000-0000-0000-0000-${String(200 + i).padStart(12, '0')}`,
    run_id: MOCK_RUNS[2].id,
    step_key,
    state: (i === 0 ? 'ACTIVE' : 'PENDING') as 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED',
    order_index: i,
    activated_at: i === 0 ? past : null,
    completed_at: null,
    completed_by: null,
    created_at: now,
    updated_at: now,
  })),
  ...CLOSURE_STEPS.map((step_key, i) => ({
    id: `50000000-0000-0000-0000-${String(300 + i).padStart(12, '0')}`,
    run_id: MOCK_RUNS[3].id,
    step_key,
    state: (i === 0 ? 'ACTIVE' : 'PENDING') as 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED',
    order_index: i,
    activated_at: i === 0 ? past : null,
    completed_at: null,
    completed_by: null,
    created_at: now,
    updated_at: now,
  })),
];

export const MOCK_APPROVALS: CeoApproval[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    case_id: MOCK_CASES[0].id,
    approval_type: 'ESTIMATE_AND_DETAILS',
    status: 'PENDING',
    rejection_note: null,
    decided_at: null,
    decided_by: null,
    created_at: past,
    updated_at: now,
  },
];

export const MOCK_EXTRAS: BodyworkExtra[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    case_id: MOCK_CASES[0].id,
    description: 'תיקון פגיעה בדלת',
    image_path: 'extras/preview1.jpg',
    status: 'IN_TREATMENT',
    created_by: PREVIEW_USER_ID,
    created_at: past,
    updated_at: now,
  },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    user_id: PREVIEW_USER_ID,
    type: 'BLOCKED_ACTION',
    title: 'פעולה חסומה',
    body: 'במצב תצוגה מקדימה — הפעולה לא נשמרת',
    read: false,
    created_at: now,
  },
];

export const MOCK_AUDIT: AuditEvent[] = [
  {
    id: '90000000-0000-0000-0000-000000000001',
    entity_type: 'CASE',
    entity_id: MOCK_CASES[0].id,
    action: 'CASE_CREATED',
    user_id: PREVIEW_USER_ID,
    payload: { case_key: MOCK_CASES[0].case_key },
    created_at: past,
  },
];

export function getPreviewStore() {
  return {
    branches: [...MOCK_BRANCHES],
    profiles: [...MOCK_PROFILES],
    cars: [...MOCK_CARS],
    cases: [...MOCK_CASES],
    case_workflow_runs: [...MOCK_RUNS],
    case_workflow_steps: [...MOCK_STEPS],
    ceo_approvals: [...MOCK_APPROVALS],
    bodywork_extras: [...MOCK_EXTRAS],
    notifications: [...MOCK_NOTIFICATIONS],
    audit_events: [...MOCK_AUDIT],
  };
}
