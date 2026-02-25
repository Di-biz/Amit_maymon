/**
 * Mock Supabase client for PREVIEW mode. Returns chainable API that reads from preview-data.
 * 
 * This provides a full PREVIEW mode without database - all data is stored in memory and localStorage.
 * No authentication required - automatically logged in as preview user.
 */
import { getPreviewStore, MOCK_PROFILES, PREVIEW_USER_ID, MOCK_CASES, MOCK_RUNS } from './preview-data';

/** Returns the active preview profile based on localStorage `preview_active_role`. */
function getActivePreviewProfile() {
  const role = typeof window !== 'undefined'
    ? (localStorage.getItem('preview_active_role') ?? 'SERVICE_MANAGER')
    : 'SERVICE_MANAGER';
  return MOCK_PROFILES.find((p) => p.role === role) ?? MOCK_PROFILES[0];
}

// Helper function to clean and fix localStorage data
function cleanLocalStorageSteps() {
  if (typeof window === 'undefined') return;
  try {
    const key = 'mock_case_workflow_steps';
    const stored = localStorage.getItem(key);
    if (stored) {
      const items = JSON.parse(stored) as Record<string, unknown>[];
      let fixed = false;
      const fixedItems = items.map((item) => {
        // Fix steps that are incorrectly marked as DONE
        if (item.step_key !== 'OPEN_CASE' && item.state === 'DONE' && !item.completed_at) {
          fixed = true;
          return {
            ...item,
            state: 'ACTIVE',
            activated_at: item.activated_at || new Date().toISOString(),
            completed_at: null,
            completed_by: null,
          };
        }
        // Fix PENDING steps that should be ACTIVE
        if (item.state === 'PENDING' && !item.completed_at && item.step_key !== 'OPEN_CASE') {
          fixed = true;
          return {
            ...item,
            state: 'ACTIVE',
            activated_at: item.activated_at || new Date().toISOString(),
          };
        }
        return item;
      });
      if (fixed) {
        localStorage.setItem(key, JSON.stringify(fixedItems));
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

// Clean localStorage on module load (client-side only)
if (typeof window !== 'undefined') {
  cleanLocalStorageSteps();
  
  // DON'T delete workflow steps from localStorage - we need them for new cases
  // Instead, we'll fix incorrect states when loading
  
  // Also clean all case_workflow_steps that are incorrectly marked as DONE
  // This is a more aggressive fix that runs on every page load
  try {
    const key = 'mock_case_workflow_steps';
    const stored = localStorage.getItem(key);
    if (stored) {
      const items = JSON.parse(stored) as Record<string, unknown>[];
      let needsUpdate = false;
      const fixedItems = items.map((item) => {
        // CRITICAL FIX: Fix ALL steps that are DONE but shouldn't be (except OPEN_CASE)
        // A step should only be DONE if it has completed_at
        if (item.step_key !== 'OPEN_CASE' && item.state === 'DONE') {
          // Check if completed_at exists and is not null
          const hasCompletedAt = item.completed_at && item.completed_at !== null;
          if (!hasCompletedAt) {
            needsUpdate = true;
            return {
              ...item,
              state: 'ACTIVE',
              activated_at: item.activated_at || new Date().toISOString(),
              completed_at: null,
              completed_by: null,
            };
          }
        }
        // Also fix if state is DONE but completed_at is explicitly null
        if (item.step_key !== 'OPEN_CASE' && item.state === 'DONE' && item.completed_at === null) {
          needsUpdate = true;
          return {
            ...item,
            state: 'ACTIVE',
            activated_at: item.activated_at || new Date().toISOString(),
            completed_at: null,
            completed_by: null,
          };
        }
        return item;
      });
      if (needsUpdate) {
        localStorage.setItem(key, JSON.stringify(fixedItems));
        console.log('[MOCK CLIENT] Fixed incorrectly marked DONE steps in localStorage');
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

// Global store shared between all instances (server and client)
// Use a global object that persists across module reloads
declare global {
  // eslint-disable-next-line no-var
  var __mockStore: ReturnType<typeof getPreviewStore> | undefined;
}

// Create a mutable store that starts with preview data but can be updated
// Use global store if it exists AND has correct structure, otherwise create new one
let mutableStore: ReturnType<typeof getPreviewStore>;
if (typeof globalThis !== 'undefined' && globalThis.__mockStore && 'case_workflow_runs' in globalThis.__mockStore) {
  mutableStore = globalThis.__mockStore;
} else {
  mutableStore = getPreviewStore();
  if (typeof globalThis !== 'undefined') {
    globalThis.__mockStore = mutableStore;
  }
}

type TableName = keyof typeof mutableStore;

function filterEq<T extends Record<string, unknown>>(rows: T[], key: string, val: unknown): T[] {
  return rows.filter((r) => r[key] === val);
}
function filterIn<T extends Record<string, unknown>>(rows: T[], key: string, vals: unknown[]): T[] {
  const set = new Set(vals);
  return rows.filter((r) => set.has(r[key]));
}
function filterIsNull<T extends Record<string, unknown>>(rows: T[], key: string): T[] {
  return rows.filter((r) => r[key] == null);
}

function pick<T extends Record<string, unknown>>(row: T, keys: string[], tableName?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in row) out[k] = row[k];
  }
  // CRITICAL FIX: For workflow steps, ALWAYS include step_key if it exists in the row
  // This ensures step_key is never lost, even if not explicitly in the select clause
  if (tableName === 'case_workflow_steps' && row.step_key !== undefined && row.step_key !== null && !out.step_key) {
    out.step_key = row.step_key;
  }
  return out;
}

function expandCars(row: Record<string, unknown>, selectCarKeys: string[]): Record<string, unknown> {
  const carId = row.car_id as string | undefined;
  if (!carId) return { ...row, cars: null };
  const car = (mutableStore.cars as Record<string, unknown>[]).find((c) => c.id === carId);
  if (!car) return { ...row, cars: null };
  const carRow = pick(car as unknown as Record<string, unknown>, selectCarKeys, 'cars');
  return { ...row, cars: carRow };
}

function expandBranches(row: Record<string, unknown>, selectBranchKeys: string[]): Record<string, unknown> {
  const branchId = row.branch_id as string | undefined;
  if (!branchId) return { ...row, branches: null };
  const branch = (mutableStore.branches as Record<string, unknown>[]).find((b) => b.id === branchId);
  if (!branch) return { ...row, branches: null };
  return { ...row, branches: pick(branch as unknown as Record<string, unknown>, selectBranchKeys, 'branches') };
}

function expandCases(row: Record<string, unknown>, caseSelect: string): Record<string, unknown> {
  const caseId = row.case_id as string | undefined;
  if (!caseId) return { ...row, cases: null };
  const caseRow = (mutableStore.cases as Record<string, unknown>[]).find((c) => c.id === caseId) as Record<string, unknown> | undefined;
  if (!caseRow) return { ...row, cases: null };
  let c: Record<string, unknown> = { ...caseRow };
  if (caseSelect.includes('cars(')) {
    const carKeys = caseSelect.includes('license_plate') ? ['license_plate'] : [];
    const carId = caseRow.car_id as string;
    const car = (mutableStore.cars as Record<string, unknown>[]).find((x) => x.id === carId);
    c = { ...c, cars: car ? pick(car as unknown as Record<string, unknown>, carKeys, 'cars') : null };
  }
  if (caseSelect.includes('branches(')) c = expandBranches(c, ['name']);
  return { ...row, cases: c };
}

function runQuery(
  table: TableName,
  options: {
    select?: string;
    eq?: [string, unknown][];
    in?: [string, unknown[]][];
    isNull?: string;
    order?: { column: string; ascending: boolean };
    limit?: number;
    single?: boolean;
    maybeSingle?: boolean;
  }
): { data: unknown; error: null } {
  let rows: Record<string, unknown>[] = [];
  // CRITICAL: For workflow steps, start with items from mutableStore (which may be empty)
  // We'll merge with localStorage items below
  let raw: Record<string, unknown>[] | undefined;
  if (table === 'case_workflow_steps') {
    // Start with items from mutableStore (may be empty initially)
    raw = (mutableStore[table] as Record<string, unknown>[] | undefined) || [];
  } else {
    raw = mutableStore[table] as Record<string, unknown>[] | undefined;
  }
  
  // DEBUG: Log query for workflow steps
  if (table === 'case_workflow_steps' && typeof window !== 'undefined') {
    console.log('[MOCK CLIENT] Querying workflow steps:', {
      table,
      filters: options.eq,
      inFilters: options.in,
      rawCount: raw?.length ?? 0,
    });
  }

  // Load from localStorage if available (client-side only)
  // CRITICAL: For workflow steps, use mutableStore (which includes new cases) first,
  // then merge with localStorage, then add preview data that's not in either
  if (typeof window !== 'undefined') {
    try {
      const key = `mock_${table}`;
      const stored = localStorage.getItem(key);
      
      // For workflow steps, ALWAYS load from both mutableStore and localStorage
      if (table === 'case_workflow_steps') {
        // Get items from mutableStore (which has new cases created on server or client)
        const mutableItems = (mutableStore[table] as Record<string, unknown>[] | undefined) || [];
        const mutableIds = new Set(mutableItems.map((item) => item.id));
        
        // Load from localStorage if available
        let localStorageItems: Record<string, unknown>[] = [];
        if (stored) {
          try {
            const storedItems = JSON.parse(stored) as Record<string, unknown>[];
            
            // CRITICAL FIX: Filter out localStorage items that don't have step_key
            // These are corrupted and should be ignored
            const validLocalStorageItems = storedItems.filter((item) => {
              const hasStepKey = item.step_key && item.step_key !== undefined && item.step_key !== null;
              if (!hasStepKey) {
                console.warn('[MOCK CLIENT] Filtering out corrupted step without step_key:', item.id);
              }
              return hasStepKey;
            });
            
            // Add localStorage items that aren't in mutableStore and have step_key
            localStorageItems = validLocalStorageItems.filter((item) => !mutableIds.has(item.id));
          } catch (e) {
            console.error('[MOCK CLIENT] Error parsing localStorage for workflow steps:', e);
          }
        }
        
        // CRITICAL: Combine mutableStore (new cases) with localStorage items
        // This ensures all steps are available, whether created on server or client
        raw = [...mutableItems, ...localStorageItems];
        // Update mutableStore with all items so they're available for future queries
        mutableStore[table] = raw as unknown;
        
        // DEBUG: Log what we're loading
        try {
          const storedForDebug = localStorage.getItem('mock_case_workflow_steps');
          const allStoredItems = storedForDebug ? JSON.parse(storedForDebug) : [];
          console.log('[MOCK CLIENT] Loading workflow steps:', {
            fromMutableStore: mutableItems.length,
            fromLocalStorage: localStorageItems.length,
            total: raw.length,
            totalInLocalStorage: allStoredItems.length,
            hasStored: !!stored,
            mutableItems: mutableItems.map((item: Record<string, unknown>) => ({
              id: item.id,
              step_key: item.step_key,
              state: item.state,
              run_id: item.run_id,
              hasStepKey: !!item.step_key,
              allKeys: Object.keys(item),
            })),
            localStorageItems: localStorageItems.map((item: Record<string, unknown>) => ({
              id: item.id,
              step_key: item.step_key,
              state: item.state,
              run_id: item.run_id,
              hasStepKey: !!item.step_key,
              allKeys: Object.keys(item),
            })),
            allStoredItems: allStoredItems.map((item: Record<string, unknown>) => ({
              id: item.id,
              step_key: item.step_key,
              run_id: item.run_id,
              hasStepKey: !!item.step_key,
            })),
          });
        } catch (e) {
          console.error('[MOCK CLIENT] Error reading localStorage for debug:', e);
        }
        
        // Fix any incorrect states in ALL items (both from localStorage and preview)
        let needsUpdate = false;
        raw = raw.map((item) => {
          // Fix steps that are incorrectly marked as DONE
          if (item.step_key !== 'OPEN_CASE' && item.state === 'DONE') {
            if (!item.completed_at) {
              needsUpdate = true;
              return {
                ...item,
                state: 'ACTIVE',
                activated_at: item.activated_at || new Date().toISOString(),
                completed_at: null,
                completed_by: null,
              };
            }
          }
          // Fix PENDING steps that should be ACTIVE (for new cases)
          if (item.state === 'PENDING' && !item.completed_at && item.step_key !== 'OPEN_CASE') {
            needsUpdate = true;
            return {
              ...item,
              state: 'ACTIVE',
              activated_at: item.activated_at || new Date().toISOString(),
            };
          }
          // Ensure ACTIVE steps have activated_at
          if (item.state === 'ACTIVE' && !item.activated_at) {
            needsUpdate = true;
            return {
              ...item,
              activated_at: item.activated_at || new Date().toISOString(),
            };
          }
          return item;
        });
        
        // Update localStorage with ALL items (including new ones from mutableStore)
        // This ensures new cases are persisted across page reloads
        try {
          // Save all items that are in mutableStore (new cases) or were in localStorage
          const mutableIds = new Set(mutableItems.map((item) => item.id));
          let storedIds = new Set<string>();
          if (stored) {
            try {
              const parsedStoredItems = JSON.parse(stored) as Record<string, unknown>[];
              storedIds = new Set(parsedStoredItems.map((item) => item.id as string));
            } catch (e) {
              // Ignore parse errors
            }
          }
          const itemsToSave = raw.filter((item) => mutableIds.has(item.id) || storedIds.has(item.id as string));
          localStorage.setItem(key, JSON.stringify(itemsToSave));
          if (needsUpdate) {
            console.log('[MOCK CLIENT] Updated workflow steps in localStorage with fixes');
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      } else {
        // For other tables, merge as before
        if (stored) {
          try {
            const storedItems = JSON.parse(stored) as Record<string, unknown>[];
            const existingIds = new Set((raw || []).map((r) => r.id));
            const newItems = storedItems.filter((item) => !existingIds.has(item.id));
            if (newItems.length > 0 && raw) {
              raw = [...raw, ...newItems];
              mutableStore[table] = raw as unknown;
            }
          } catch (e) {
            console.error('[MOCK CLIENT] Error parsing localStorage for', table, ':', e);
          }
        }
      }
    } catch (e) {
      console.error('[MOCK CLIENT] Error loading from localStorage:', e);
    }
  }

  if (!raw || !Array.isArray(raw)) {
    return { data: [], error: null };
  }

  // Fix any incorrect states in the raw data (for workflow steps)
  // This runs EVERY TIME we query workflow steps, ensuring data is always correct
  if (table === 'case_workflow_steps') {
    let needsUpdate = false;
    raw = raw.map((item) => {
      // CRITICAL FIX: If a step is DONE but doesn't have completed_at, it's invalid
      // This happens when steps are incorrectly saved. Fix them to ACTIVE.
      // Only OPEN_CASE can be DONE without completed_at (it's set during creation)
      if (item.step_key !== 'OPEN_CASE' && item.state === 'DONE') {
        // Check if completed_at exists and is not null/undefined
        const hasCompletedAt = item.completed_at && item.completed_at !== null;
        if (!hasCompletedAt) {
          needsUpdate = true;
          // DEBUG: Log the fix
          if (typeof window !== 'undefined') {
            console.log('[MOCK CLIENT] Fixing DONE step without completed_at:', {
              step_key: item.step_key,
              id: item.id,
              state: item.state,
              completed_at: item.completed_at,
            });
          }
          return {
            ...item,
            state: 'ACTIVE',
            activated_at: item.activated_at || new Date().toISOString(),
            completed_at: null,
            completed_by: null,
          };
        }
      }
      // Fix PENDING steps that should be ACTIVE (for new cases)
      if (item.state === 'PENDING' && !item.completed_at && item.step_key !== 'OPEN_CASE') {
        needsUpdate = true;
        if (typeof window !== 'undefined') {
          console.log('[MOCK CLIENT] Fixing PENDING step to ACTIVE:', {
            step_key: item.step_key,
            id: item.id,
          });
        }
        return {
          ...item,
          state: 'ACTIVE',
          activated_at: item.activated_at || new Date().toISOString(),
        };
      }
      // Ensure ACTIVE steps have activated_at
      if (item.state === 'ACTIVE' && !item.activated_at) {
        needsUpdate = true;
        return {
          ...item,
          activated_at: item.activated_at || new Date().toISOString(),
        };
      }
      return item;
    });
    
    // If we fixed any items, update both mutableStore and localStorage
    if (needsUpdate) {
      mutableStore[table] = raw as unknown;
      // Also update localStorage (client-side only)
      if (typeof window !== 'undefined') {
        try {
          const key = `mock_${table}`;
          localStorage.setItem(key, JSON.stringify(raw));
          console.log('[MOCK CLIENT] Updated workflow steps in store and localStorage');
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }
  }

  rows = raw.map((r) => ({ ...r }));

  // DEBUG: Log before filtering
  if (table === 'case_workflow_steps' && typeof window !== 'undefined') {
    console.log('[MOCK CLIENT] Before filtering:', {
      totalRows: rows.length,
      eqFilters: options.eq,
      inFilters: options.in,
      selectStr: options.select,
      sampleRows: rows.slice(0, 3).map((r: Record<string, unknown>) => ({
        id: r.id,
        step_key: r.step_key,
        hasStepKey: 'step_key' in r,
        stepKeyValue: r.step_key,
        state: r.state,
        run_id: r.run_id,
        allKeys: Object.keys(r),
        fullRow: JSON.stringify(r, null, 2),
      })),
    });
  }

  for (const [k, v] of options.eq ?? []) {
    rows = filterEq(rows, k, v);
  }
  for (const [k, vals] of options.in ?? []) {
    rows = filterIn(rows, k, vals as unknown[]);
  }
  
  // DEBUG: Log after filtering
  if (table === 'case_workflow_steps' && typeof window !== 'undefined') {
    console.log('[MOCK CLIENT] After filtering:', {
      totalRows: rows.length,
      selectStr: options.select,
      filteredRows: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        step_key: r.step_key,
        hasStepKey: 'step_key' in r,
        stepKeyValue: r.step_key,
        state: r.state,
        run_id: r.run_id,
        allKeys: Object.keys(r),
      })),
    });
  }
  if (options.isNull) {
    rows = filterIsNull(rows, options.isNull);
  }
  if (options.order) {
    rows.sort((a, b) => {
      const va = a[options.order!.column];
      const vb = b[options.order!.column];
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return options.order!.ascending ? cmp : -cmp;
    });
  }
  if (options.limit) rows = rows.slice(0, options.limit);

  const selectStr = options.select ?? '*';
  const expandCarsMatch = selectStr.match(/cars\s*!?\w*\(\s*([^)]+)\s*\)/);
  const expandBranchesMatch = selectStr.match(/branches\s*\(\s*([^)]+)\s*\)/);
  const expandCasesMatch = selectStr.match(/cases\s*\(\s*([^)]+)\s*\)/);
  const mainCols = selectStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !s.includes('(') && s !== '*');
  const useAllCols = selectStr === '*' || (mainCols.length === 0 && !expandCarsMatch && !expandBranchesMatch && !expandCasesMatch);

  let result = rows.map((r) => {
    let row = useAllCols ? { ...r } : pick(r, mainCols.length ? mainCols : Object.keys(r), table);
    
    // CRITICAL FIX: For workflow steps, ALWAYS include step_key if it exists in the source row
    // This ensures step_key is never lost, even if not explicitly in the select clause
    if (table === 'case_workflow_steps') {
      if (r.step_key !== undefined && r.step_key !== null) {
        row.step_key = r.step_key;
      }
      // Also ensure other critical fields are included
      if (r.state !== undefined && r.state !== null && !row.state) {
        row.state = r.state;
      }
      if (r.order_index !== undefined && r.order_index !== null && !row.order_index) {
        row.order_index = r.order_index;
      }
      
      // DEBUG: Log if step_key is missing
      if (typeof window !== 'undefined' && table === 'case_workflow_steps') {
        if (!row.step_key && r.step_key) {
          console.warn('[MOCK CLIENT] step_key exists in source but not in result!', {
            sourceStepKey: r.step_key,
            resultKeys: Object.keys(row),
            selectStr,
            useAllCols,
            mainCols,
            sourceRow: JSON.stringify(r, null, 2),
            resultRow: JSON.stringify(row, null, 2),
          });
        }
        // Always log the final result for debugging
        if (rows.length <= 3) {
          console.log('[MOCK CLIENT] Final result row:', {
            id: row.id,
            step_key: row.step_key,
            hasStepKey: !!row.step_key,
            state: row.state,
            allKeys: Object.keys(row),
            fullRow: JSON.stringify(row, null, 2),
          });
        }
      }
    }
    
    if (expandCarsMatch && table === 'cases') row = expandCars(row, expandCarsMatch[1].split(',').map((x) => x.trim()));
    if (expandBranchesMatch && table === 'cases') row = expandBranches(row, expandBranchesMatch[1].split(',').map((x) => x.trim()));
    if (expandCasesMatch && (table === 'ceo_approvals' || table === 'bodywork_extras')) row = expandCases(row, expandCasesMatch[1]);
    return row;
  });

  if (options.single) {
    if (result.length !== 1) return { data: null, error: null };
    return { data: result[0], error: null };
  }
  if (options.maybeSingle) {
    return { data: result[0] ?? null, error: null };
  }
  return { data: result, error: null };
}

function buildChain(table: TableName) {
  const state: {
    select?: string;
    eq: [string, unknown][];
    in: [string, unknown[]][];
    isNull?: string;
    order?: { column: string; ascending: boolean };
    limit?: number;
    single?: boolean;
    maybeSingle?: boolean;
  } = { eq: [], in: [] };

  const run = () => runQuery(table, state);

  const chain = {
    select(columns: string) {
      state.select = columns;
      return chain;
    },
    eq(column: string, value: unknown) {
      state.eq.push([column, value]);
      return chain;
    },
    in(column: string, values: unknown[]) {
      state.in.push([column, values]);
      return chain;
    },
    is(column: string, value: null) {
      if (value === null) state.isNull = column;
      return chain;
    },
    order(column: string, opts: { ascending?: boolean }) {
      state.order = { column, ascending: opts?.ascending ?? true };
      return chain;
    },
    limit(n: number) {
      state.limit = n;
      return chain;
    },
    single() {
      state.single = true;
      return Promise.resolve(run());
    },
    maybeSingle() {
      state.maybeSingle = true;
      return Promise.resolve(run());
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      const out = run();
      resolve(out);
      return Promise.resolve(out);
    },
    insert(payload: unknown) {
      // Generate a UUID-like ID for new records
      const generateId = () => {
        // Generate UUID v4 format
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      
      const newId = generateId();
      const payloadObj = payload as Record<string, unknown>;
      const now = new Date().toISOString();
      const newRecord: Record<string, unknown> = { 
        ...payloadObj, 
        id: newId, 
        created_at: now, 
        updated_at: now 
      };
      
      // CRITICAL FIX: For workflow steps, ALWAYS preserve step_key from payload
      // This MUST happen before any other processing
      if (table === 'case_workflow_steps') {
        if (payloadObj.step_key) {
          newRecord.step_key = payloadObj.step_key;
        } else {
          // If step_key is missing, log error
          if (typeof window !== 'undefined') {
            console.error('[MOCK CLIENT] ERROR: step_key is missing in payload for workflow step!', {
              payload: payloadObj,
              payloadKeys: Object.keys(payloadObj),
            });
          }
        }
        // CRITICAL: Ensure step_key is ALWAYS present - if it's missing, we can't save
        if (!newRecord.step_key) {
          console.error('[MOCK CLIENT] FATAL: step_key is missing in newRecord after initial setup!', {
            payload: payloadObj,
            newRecord,
            newRecordKeys: Object.keys(newRecord),
          });
        }
      }
      
      // For workflow steps, ALWAYS preserve the state from payload exactly as sent
      // The state comes from createCase function and should be respected
      if (table === 'case_workflow_steps') {
        // CRITICAL: Preserve state from payload - this is what createCase sends
        // Don't override it unless it's completely missing
        const originalState = payloadObj.state as string | undefined;
        if (originalState) {
          newRecord.state = originalState;
        } else {
          // Only set default if state is completely missing
          newRecord.state = 'ACTIVE';
        }
        
        // DEBUG: Log what we're saving
        if (typeof window !== 'undefined') {
          console.log('[MOCK CLIENT] Inserting workflow step:', {
            step_key: payloadObj.step_key,
            state: newRecord.state,
            originalState,
            hasCompletedAt: !!payloadObj.completed_at,
          });
        }
        
        // CRITICAL FIX: If state is ACTIVE or PENDING, ensure completed_at is null
        // If state is DONE but not OPEN_CASE, ensure completed_at exists
        if (newRecord.state === 'ACTIVE' || newRecord.state === 'PENDING') {
          newRecord.completed_at = null;
          newRecord.completed_by = null;
          // Ensure activated_at is set for ACTIVE steps
          if (newRecord.state === 'ACTIVE' && !newRecord.activated_at) {
            newRecord.activated_at = now;
          }
        } else if (newRecord.state === 'DONE') {
          // For DONE steps, ensure completed_at is set
          // Only OPEN_CASE should be DONE without completed_at during creation
          if (!newRecord.completed_at && payloadObj.step_key !== 'OPEN_CASE') {
            // This shouldn't happen - if it does, log it
            if (typeof window !== 'undefined') {
              console.warn('[MOCK CLIENT] DONE step without completed_at:', payloadObj.step_key);
            }
            newRecord.completed_at = now;
          }
        } else if (newRecord.state === 'SKIPPED') {
          // For SKIPPED steps, completed_at should be set
          if (!newRecord.completed_at) {
            newRecord.completed_at = now;
          }
        }
      }
      
      // Add the new record to the mutable store
      // Initialize the table array if it doesn't exist yet
      if (!mutableStore[table] || !Array.isArray(mutableStore[table])) {
        (mutableStore as Record<string, unknown>)[table] = [];
      }
      if (Array.isArray(mutableStore[table])) {
        (mutableStore[table] as unknown[]).push(newRecord);
        
        // Also save to localStorage (client-side only) for persistence
        if (typeof window !== 'undefined') {
          try {
            const key = `mock_${table}`;
            const existing = localStorage.getItem(key);
            const items = existing ? JSON.parse(existing) : [];
            // Remove any duplicate by ID before adding
            const filteredItems = items.filter((item: Record<string, unknown>) => item.id !== newId);
            filteredItems.push(newRecord);
            
            // DEBUG: Log when saving workflow steps
            if (table === 'case_workflow_steps') {
              // CRITICAL FIX: Ensure step_key is ALWAYS in the saved record
              // Double-check that step_key exists - if not, try to get it from payload
              if (!newRecord.step_key) {
                if (payloadObj.step_key) {
                  console.warn('[MOCK CLIENT] step_key missing in newRecord, adding it from payload:', payloadObj.step_key);
                  newRecord.step_key = payloadObj.step_key;
                  // Update the item in the array before saving
                  filteredItems[filteredItems.length - 1] = newRecord;
                } else {
                  console.error('[MOCK CLIENT] FATAL: step_key is missing in both newRecord and payload!', {
                    payload: payloadObj,
                    newRecord,
                    newRecordKeys: Object.keys(newRecord),
                    payloadKeys: Object.keys(payloadObj),
                  });
                  // Remove the item from the array if it doesn't have step_key
                  filteredItems.pop();
                  // Don't save to localStorage if step_key is missing
                  return {
                    select: () => ({
                      single: () =>
                        Promise.resolve({
                          data: { id: newId },
                          error: null,
                        }),
                    }),
                  };
                }
              }
              
              // CRITICAL FIX: If step is DONE but doesn't have completed_at (and it's not OPEN_CASE), fix it to ACTIVE
              if (newRecord.step_key && newRecord.step_key !== 'OPEN_CASE' && newRecord.state === 'DONE' && !newRecord.completed_at) {
                console.warn('[MOCK CLIENT] Fixing step from DONE to ACTIVE before saving:', newRecord.step_key);
                newRecord.state = 'ACTIVE';
                newRecord.completed_at = null;
                newRecord.completed_by = null;
                // Update the item in the array before saving
                filteredItems[filteredItems.length - 1] = newRecord;
              }
              
              // CRITICAL: Save to localStorage - step_key should be guaranteed at this point
              localStorage.setItem(key, JSON.stringify(filteredItems));
              console.log('[MOCK CLIENT] Saved workflow step to localStorage:', {
                step_key: payloadObj.step_key,
                newRecordStepKey: newRecord.step_key,
                state: newRecord.state,
                originalState: payloadObj.state,
                run_id: payloadObj.run_id,
                newRecordRunId: newRecord.run_id,
                completed_at: newRecord.completed_at,
                hasCompletedAt: !!newRecord.completed_at,
                allKeys: Object.keys(newRecord),
                hasStepKeyInPayload: !!payloadObj.step_key,
                hasStepKeyInRecord: !!newRecord.step_key,
                totalItemsInLocalStorage: filteredItems.length,
                itemId: newId,
                fullNewRecord: JSON.stringify(newRecord, null, 2),
              });
            } else {
              localStorage.setItem(key, JSON.stringify(filteredItems));
            }
          } catch (e) {
            console.error('[MOCK CLIENT] Error saving to localStorage:', e);
          }
        }
      }
      
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: newId },
              error: null,
            }),
        }),
      };
    },
    update(payload: unknown) {
      const payloadObj = payload as Record<string, unknown>;
      const updatedAt = new Date().toISOString();
      
      const thenable = {
        then: (resolve: (v: { error: null }) => void) => {
          // This will be called with .eq() to filter which records to update
          resolve({ error: null });
          return Promise.resolve({ error: null });
        },
        eq: (column: string, value: unknown) => {
          // Update records matching the filter
          let updatedCount = 0;
          if (mutableStore[table] && Array.isArray(mutableStore[table])) {
            (mutableStore[table] as Record<string, unknown>[]).forEach((record) => {
              if (record[column] === value) {
                const oldState = record.state;
                Object.assign(record, payloadObj, { updated_at: updatedAt });
                updatedCount++;
                
                // DEBUG: Log updates for workflow steps
                if (table === 'case_workflow_steps' && typeof window !== 'undefined') {
                  console.log('[MOCK CLIENT] Updating workflow step in mutableStore:', {
                    id: record.id,
                    step_key: record.step_key,
                    oldState,
                    newState: record.state,
                    column,
                    value,
                    allKeys: Object.keys(record),
                  });
                }
              }
            });
            
            // CRITICAL: Also save to localStorage (client-side only)
            if (typeof window !== 'undefined' && updatedCount > 0) {
              try {
                const key = `mock_${table}`;
                const existing = localStorage.getItem(key);
                const items = existing ? JSON.parse(existing) : [];
                
                // Update items in localStorage that match the filter
                const updatedItems = items.map((item: Record<string, unknown>) => {
                  if (item[column] === value) {
                    const updated = { ...item, ...payloadObj, updated_at: updatedAt };
                    if (table === 'case_workflow_steps' && typeof window !== 'undefined') {
                      console.log('[MOCK CLIENT] Updating workflow step in localStorage:', {
                        id: item.id,
                        step_key: item.step_key,
                        oldState: item.state,
                        newState: updated.state,
                      });
                    }
                    return updated;
                  }
                  return item;
                });
                
                localStorage.setItem(key, JSON.stringify(updatedItems));
                
                if (table === 'case_workflow_steps') {
                  console.log('[MOCK CLIENT] Saved updated workflow steps to localStorage:', {
                    updatedCount,
                    column,
                    value,
                    totalItems: updatedItems.length,
                  });
                }
              } catch (e) {
                console.error('[MOCK CLIENT] Error saving update to localStorage:', e);
              }
            }
          }
          
          // Return a promise that resolves immediately
          return Promise.resolve({ error: null });
        },
      };
      return thenable;
    },
  };
  return chain;
}

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: () => {
        const profile = getActivePreviewProfile();
        return Promise.resolve({
          data: {
            user: {
              id: profile.id,
              email: `${profile.full_name}@preview.local`,
            },
          },
          error: null,
        });
      },
      signOut: () => Promise.resolve({ error: null }),
    },
    from(_table: TableName) {
      return buildChain(_table);
    },
  };
}
