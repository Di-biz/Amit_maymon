/**
 * Mock Supabase client for PREVIEW mode. Returns chainable API that reads from preview-data.
 */
import { getPreviewStore, PREVIEW_USER_ID, MOCK_CASES, MOCK_RUNS } from './preview-data';

const store = getPreviewStore();

type TableName = keyof typeof store;

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

function pick<T extends Record<string, unknown>>(row: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in row) out[k] = row[k];
  }
  return out;
}

function expandCars(row: Record<string, unknown>, selectCarKeys: string[]): Record<string, unknown> {
  const carId = row.car_id as string | undefined;
  if (!carId) return { ...row, cars: null };
  const car = store.cars.find((c) => c.id === carId);
  if (!car) return { ...row, cars: null };
  const carRow = pick(car as unknown as Record<string, unknown>, selectCarKeys);
  return { ...row, cars: carRow };
}

function expandBranches(row: Record<string, unknown>, selectBranchKeys: string[]): Record<string, unknown> {
  const branchId = row.branch_id as string | undefined;
  if (!branchId) return { ...row, branches: null };
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) return { ...row, branches: null };
  return { ...row, branches: pick(branch as unknown as Record<string, unknown>, selectBranchKeys) };
}

function expandCases(row: Record<string, unknown>, caseSelect: string): Record<string, unknown> {
  const caseId = row.case_id as string | undefined;
  if (!caseId) return { ...row, cases: null };
  const caseRow = store.cases.find((c) => c.id === caseId) as Record<string, unknown> | undefined;
  if (!caseRow) return { ...row, cases: null };
  let c: Record<string, unknown> = { ...caseRow };
  if (caseSelect.includes('cars(')) {
    const carKeys = caseSelect.includes('license_plate') ? ['license_plate'] : [];
    const carId = caseRow.car_id as string;
    const car = store.cars.find((x) => x.id === carId);
    c = { ...c, cars: car ? pick(car as unknown as Record<string, unknown>, carKeys) : null };
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
  const raw = store[table] as Record<string, unknown>[];

  rows = raw.map((r) => ({ ...r }));

  for (const [k, v] of options.eq ?? []) {
    rows = filterEq(rows, k, v);
  }
  for (const [k, vals] of options.in ?? []) {
    rows = filterIn(rows, k, vals as unknown[]);
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
    let row = useAllCols ? { ...r } : pick(r, mainCols.length ? mainCols : Object.keys(r));
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
    insert(_payload: unknown) {
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id:
                  table === 'cases'
                    ? MOCK_CASES[0].id
                    : table === 'case_workflow_runs'
                      ? MOCK_RUNS[0].id
                      : 'mock-id',
              },
              error: null,
            }),
        }),
      };
    },
    update(_payload: unknown) {
      const thenable = {
        then: (resolve: (v: { error: null }) => void) => {
          resolve({ error: null });
          return Promise.resolve({ error: null });
        },
        eq: () => thenable,
      };
      return thenable;
    },
  };
  return chain;
}

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: PREVIEW_USER_ID,
              email: 'preview@example.com',
            },
          },
          error: null,
        }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from(_table: TableName) {
      return buildChain(_table);
    },
  };
}
