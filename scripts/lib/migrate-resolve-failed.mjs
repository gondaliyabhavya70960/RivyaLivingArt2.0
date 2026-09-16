/**
 * The guarded self-heal for P3009 — "migrate found failed migrations in the
 * target database".
 *
 * THE INCIDENT, as it actually happened. (The first version of this file told
 * a different story — "a cancelled preview build died mid-apply" — read off
 * the P3009 line alone. The build logs say otherwise, and the difference is
 * the whole design.) Vercel runs `npm run build`, and therefore `migrate
 * deploy`, for PREVIEW deployments too, against the production database. On
 * 2026-09-16 at 08:16 UTC a preview build of the abandoned branch
 * `feat/b8-analytics-opportunity-score` applied ITS migration,
 * `20260916210000_analytics_opportunity`, to production: `AnalyticsSnapshot`
 * and `OpportunityScore` in that branch's shape, a
 * `ShortlistEntry.linkedOpportunityId` column, their indexes and foreign
 * keys. The B8 that merged (#84, branch `b8-analytics-opportunity`) carried
 * a rewritten migration under a NEW name, `20260917090000_analytics_opportunity`,
 * with different columns. At 09:47 UTC its preview build ran that one and
 * Postgres answered 42P07 — `relation "AnalyticsSnapshot" already exists`.
 * Prisma recorded the migration as failed and refused every deploy after it:
 * production stayed on #83 while B9, A9, #87 and #88 merged.
 *
 * Nothing in that outcome needs a person at a keyboard — it needs the facts
 * read in the right order, and every fact is readable from the migration's
 * own SQL and the database's catalog. That is what this module does, and it
 * does nothing it cannot prove.
 *
 * THE GUARD, stated exactly. A failed migration's SQL declares its FOOTPRINT:
 * the tables (with their columns), indexes, constraints, enum types, enum
 * values and extensions it creates. The database is read for each of them,
 * and the record is resolved only when one of three facts holds:
 *
 *   1. NOTHING it declares exists → it applied nothing durable →
 *      `migrate resolve --rolled-back`, and the deploy re-applies it.
 *      (#87's rule, tightened: it used to check tables alone, and Prisma
 *      does NOT run a migration script atomically — a probe on 2026-09-16
 *      showed the first CREATE TABLE surviving the second's failure — so an
 *      enum type created before a table that failed would have made the
 *      re-apply fail on "type already exists", forever.)
 *   2. EVERYTHING it declares exists in the declared shape — every column
 *      with its type and nullability, every index with its uniqueness and
 *      columns, every constraint, every enum label, every extension — and it
 *      carries no data statement and nothing this parser does not understand
 *      → its work is all present and only the record is wrong →
 *      `migrate resolve --applied`.
 *   3. SOME of it exists but not in the declared shape (the 2026-09-16
 *      case: a predecessor under another name built the tables differently),
 *      and everything that would have to go holds NO DATA — an index, a
 *      constraint, an enum type, a table with no rows, or a table this file
 *      declares a DERIVATION (its rows are rebuilt wholesale by the code
 *      that owns them) — and nothing it would ADD to a pre-existing table (a
 *      column, an enum value) is already there, and it writes no data to a
 *      pre-existing table → the stray objects are dropped in one transaction
 *      (foreign keys pointing at them first), the record is marked
 *      rolled-back, and the deploy re-applies the migration from scratch.
 *
 * Anything else prints the exact manual commands and stops the build, as
 * before: a table with rows the guard cannot vouch for, a column half-added
 * to a live table, a DROP or a RENAME in the migration, a type it cannot
 * check. The failure direction is always "refuse": a parser gap turns into a
 * stopped build with instructions, never into a resolve.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The failed-migration names from P3009 output — one or several. */
export function failedMigrationNames(output) {
  const text = String(output ?? "");
  const names = [];
  const re = /The `([^`]+)` migration started at [^\n]* failed/g;
  let match;
  while ((match = re.exec(text)) !== null) names.push(match[1]);
  return names;
}

/**
 * Tables whose rows are DERIVATIONS — rebuilt wholesale by the code that
 * owns them, never entered by a person — so a stray copy left by a failed or
 * superseded migration may be dropped with its rows. Add a table here only
 * with the reason, and only when its writer replaces the whole set:
 * `analytics-query.ts` runs `deleteMany({})` + `createMany` for both of
 * these on every recompute, and the B8 migration's own comment says the
 * same ("derivations, not dated records — D24 protects what a source said,
 * not what we computed from it").
 */
export const DERIVED_TABLES = new Map([
  ["AnalyticsSnapshot", "B8: replaced wholesale on every recompute (analytics-query.ts)"],
  ["OpportunityScore", "B8: replaced wholesale on every recompute (analytics-query.ts)"],
]);

// ---------------------------------------------------------------------------
// SQL — the additive vocabulary this repo's hand-written migrations use.
// ---------------------------------------------------------------------------

/** `--` line comments removed, outside string literals — a table named in
 *  a comment is prose, not an object. */
export function stripSqlComments(sql) {
  let out = "";
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (inString) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 1;
        } else inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Split on `sep` at parenthesis depth 0, outside string literals. */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (text[i + 1] === "'") {
          current += "'";
          i += 1;
        } else inString = false;
      }
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The statements of a migration, comments stripped, in order. */
export function sqlStatements(sql) {
  return splitTopLevel(stripSqlComments(String(sql ?? "")), ";");
}

const IDENT_SOURCE = String.raw`(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))`;
const ident = (match, quotedIndex) =>
  match[quotedIndex] ?? match[quotedIndex + 1].toLowerCase(); // Postgres folds bare names

/** The content between the first `(` at or after `from` and its balanced
 *  `)`, or null. */
function balancedParens(text, from = 0) {
  const open = text.indexOf("(", from);
  if (open === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "'" && text[i + 1] !== "'") inString = false;
      else if (ch === "'") i += 1;
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** SQL type spellings this guard can check against `information_schema`'s
 *  `udt_name`. Anything else is "a type it cannot check" — a refusal. */
const UDT_BY_TYPE = new Map([
  ["text", "text"],
  ["integer", "int4"],
  ["int", "int4"],
  ["int4", "int4"],
  ["serial", "int4"],
  ["bigint", "int8"],
  ["int8", "int8"],
  ["bigserial", "int8"],
  ["smallint", "int2"],
  ["int2", "int2"],
  ["double precision", "float8"],
  ["float8", "float8"],
  ["real", "float4"],
  ["float4", "float4"],
  ["numeric", "numeric"],
  ["decimal", "numeric"],
  ["boolean", "bool"],
  ["bool", "bool"],
  ["jsonb", "jsonb"],
  ["json", "json"],
  ["timestamp", "timestamp"],
  ["timestamp without time zone", "timestamp"],
  ["timestamptz", "timestamptz"],
  ["timestamp with time zone", "timestamptz"],
  ["date", "date"],
  ["time", "time"],
  ["uuid", "uuid"],
  ["varchar", "varchar"],
  ["character varying", "varchar"],
  ["char", "bpchar"],
  ["character", "bpchar"],
  ["bytea", "bytea"],
  ["vector", "vector"],
  ["tsvector", "tsvector"],
]);

/** The `udt_name` a declared column type should show, or null when this
 *  guard does not know the spelling. A quoted type is a named one — an enum
 *  — and its own name is the udt. */
export function expectedUdt(rawType) {
  let type = String(rawType ?? "").trim();
  let isArray = false;
  if (type.endsWith("[]")) {
    isArray = true;
    type = type.slice(0, -2).trim();
  }
  const quoted = type.match(/^"([^"]+)"$/);
  let udt;
  if (quoted) udt = quoted[1];
  else {
    const folded = type
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    udt = UDT_BY_TYPE.get(folded) ?? null;
  }
  if (udt === null) return null;
  return isArray ? `_${udt}` : udt;
}

const COLUMN_TAIL =
  /\b(NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|GENERATED|COLLATE|CONSTRAINT)\b/i;

/** `"name" TYPE [NOT NULL] [DEFAULT …] [PRIMARY KEY]` → the column's
 *  declared shape, or null when the item is not a column. */
function parseColumnDef(item) {
  const match = item.match(new RegExp(`^${IDENT_SOURCE}\\s+([\\s\\S]*)$`));
  if (!match) return null;
  const name = ident(match, 1);
  const rest = match[3].trim();
  const stop = rest.search(COLUMN_TAIL);
  const rawType = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  if (!rawType) return null;
  const tail = stop === -1 ? "" : rest.slice(stop);
  const primaryKey = /\bPRIMARY\s+KEY\b/i.test(tail);
  const notNull = /\bNOT\s+NULL\b/i.test(tail);
  return {
    name,
    rawType,
    udt: expectedUdt(rawType),
    nullable: !(notNull || primaryKey),
    primaryKey,
  };
}

const CONSTRAINT_KIND = [
  [/^PRIMARY\s+KEY\b/i, "p"],
  [/^UNIQUE\b/i, "u"],
  [/^FOREIGN\s+KEY\b/i, "f"],
  [/^CHECK\b/i, "c"],
  [/^EXCLUDE\b/i, "x"],
];

/** `CONSTRAINT "name" FOREIGN KEY (…) REFERENCES "T" (…)` and friends. */
function parseNamedConstraint(text) {
  const match = text.match(new RegExp(`^CONSTRAINT\\s+${IDENT_SOURCE}\\s+([\\s\\S]*)$`, "i"));
  if (!match) return null;
  const name = ident(match, 1);
  const body = match[3].trim();
  const kind = CONSTRAINT_KIND.find(([re]) => re.test(body))?.[1] ?? null;
  let refTable = null;
  if (kind === "f") {
    const ref = body.match(new RegExp(`\\bREFERENCES\\s+${IDENT_SOURCE}`, "i"));
    refTable = ref ? ident(ref, 1) : null;
  }
  return { name, kind, refTable };
}

/** The column list of an index — `("a", "b")`, `("title" gin_trgm_ops)` —
 *  or null when any item is an expression this guard does not read. */
function parseIndexColumns(inner) {
  const columns = [];
  for (const item of splitTopLevel(inner, ",")) {
    const match = item.match(new RegExp(`^${IDENT_SOURCE}(?:\\s+[^()]*)?$`));
    if (!match) return null;
    columns.push(ident(match, 1));
  }
  return columns;
}

const RE = {
  createTable: new RegExp(
    `^CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${IDENT_SOURCE}\\s*\\(`,
    "i",
  ),
  createIndex: new RegExp(
    `^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT_SOURCE}\\s+ON\\s+(?:ONLY\\s+)?${IDENT_SOURCE}`,
    "i",
  ),
  alterTable: new RegExp(
    `^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${IDENT_SOURCE}\\s+([\\s\\S]*)$`,
    "i",
  ),
  addConstraint: /^ADD\s+CONSTRAINT\b/i,
  addColumn: /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*)$/i,
  createEnum: new RegExp(`^CREATE\\s+TYPE\\s+${IDENT_SOURCE}\\s+AS\\s+ENUM\\s*\\(`, "i"),
  addEnumValue: new RegExp(
    `^ALTER\\s+TYPE\\s+${IDENT_SOURCE}\\s+ADD\\s+VALUE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?'((?:[^']|'')*)'`,
    "i",
  ),
  createExtension: new RegExp(
    `^CREATE\\s+EXTENSION\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${IDENT_SOURCE}`,
    "i",
  ),
  insert: new RegExp(`^INSERT\\s+INTO\\s+${IDENT_SOURCE}`, "i"),
  update: new RegExp(`^UPDATE\\s+(?:ONLY\\s+)?${IDENT_SOURCE}`, "i"),
  delete: new RegExp(`^DELETE\\s+FROM\\s+(?:ONLY\\s+)?${IDENT_SOURCE}`, "i"),
};

const excerpt = (text) => text.replace(/\s+/g, " ").slice(0, 80);

/**
 * Everything a migration's SQL declares it will leave in the database, as
 * data the guard can check one item at a time. `unknown` holds every
 * statement outside the additive vocabulary — a DROP, a RENAME, an ALTER
 * COLUMN, a bare `SET` — and one entry there is enough to refuse an
 * `--applied` or a drop, because a footprint with a hole in it proves
 * nothing.
 */
export function parseMigrationFootprint(sql) {
  const footprint = {
    tables: [], // { name, ifNotExists, columns: [...], primaryKey, constraints: [{ name, kind, refTable }] }
    columns: [], // ADD COLUMN → { table, name, rawType, udt, nullable }
    indexes: [], // { name, table, unique, columns: string[] | null }
    constraints: [], // ADD CONSTRAINT → { table, name, kind, refTable }
    enums: [], // { name, labels }
    enumValues: [], // { type, label }
    extensions: [], // { name, ifNotExists }
    data: [], // { verb, table }
    unknown: [], // string — the statement's first 80 characters
  };

  for (const statement of sqlStatements(sql)) {
    let match;

    if ((match = statement.match(RE.createTable))) {
      const parens = balancedParens(statement, match[0].length - 1);
      if (!parens) {
        footprint.unknown.push(excerpt(statement));
        continue;
      }
      const table = {
        name: ident(match, 2),
        ifNotExists: Boolean(match[1]),
        columns: [],
        primaryKey: false,
        constraints: [],
      };
      for (const item of splitTopLevel(parens.inner, ",")) {
        if (/^CONSTRAINT\b/i.test(item)) {
          const constraint = parseNamedConstraint(item);
          if (!constraint) {
            footprint.unknown.push(excerpt(item));
            continue;
          }
          if (constraint.kind === "p") table.primaryKey = true;
          table.constraints.push(constraint);
          continue;
        }
        if (/^PRIMARY\s+KEY\b/i.test(item)) {
          table.primaryKey = true;
          continue;
        }
        if (/^(UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE|LIKE)\b/i.test(item)) {
          footprint.unknown.push(excerpt(`${table.name}: ${item}`));
          continue;
        }
        const column = parseColumnDef(item);
        if (!column) {
          footprint.unknown.push(excerpt(`${table.name}: ${item}`));
          continue;
        }
        if (column.primaryKey) table.primaryKey = true;
        table.columns.push(column);
      }
      footprint.tables.push(table);
      continue;
    }

    if ((match = statement.match(RE.createIndex))) {
      const parens = balancedParens(statement, match[0].length);
      footprint.indexes.push({
        name: ident(match, 2),
        table: ident(match, 4),
        unique: Boolean(match[1]),
        columns: parens ? parseIndexColumns(parens.inner) : null,
      });
      continue;
    }

    if ((match = statement.match(RE.alterTable))) {
      const table = ident(match, 1);
      for (const action of splitTopLevel(match[3], ",")) {
        if (RE.addConstraint.test(action)) {
          const constraint = parseNamedConstraint(action.replace(/^ADD\s+/i, ""));
          if (constraint) footprint.constraints.push({ table, ...constraint });
          else footprint.unknown.push(excerpt(`${table}: ${action}`));
          continue;
        }
        const add = action.match(RE.addColumn);
        const column = add && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b/i.test(add[1])
          ? parseColumnDef(add[1])
          : null;
        if (column) footprint.columns.push({ table, ...column });
        else footprint.unknown.push(excerpt(`${table}: ${action}`));
      }
      continue;
    }

    if ((match = statement.match(RE.createEnum))) {
      const parens = balancedParens(statement, match[0].length - 1);
      const labels = [];
      if (parens) {
        const re = /'((?:[^']|'')*)'/g;
        let label;
        while ((label = re.exec(parens.inner)) !== null) labels.push(label[1].replace(/''/g, "'"));
      }
      footprint.enums.push({ name: ident(match, 1), labels });
      continue;
    }

    if ((match = statement.match(RE.addEnumValue))) {
      footprint.enumValues.push({ type: ident(match, 1), label: match[3].replace(/''/g, "'") });
      continue;
    }

    if ((match = statement.match(RE.createExtension))) {
      footprint.extensions.push({ name: ident(match, 2), ifNotExists: Boolean(match[1]) });
      continue;
    }

    if ((match = statement.match(RE.insert))) {
      footprint.data.push({ verb: "INSERT", table: ident(match, 1) });
      continue;
    }
    if ((match = statement.match(RE.update))) {
      footprint.data.push({ verb: "UPDATE", table: ident(match, 1) });
      continue;
    }
    if ((match = statement.match(RE.delete))) {
      footprint.data.push({ verb: "DELETE", table: ident(match, 1) });
      continue;
    }

    footprint.unknown.push(excerpt(statement));
  }

  return footprint;
}

/** The tables a migration creates, in order — #87's original question. */
export function tablesCreatedBy(migrationSql) {
  return [...new Set(parseMigrationFootprint(migrationSql).tables.map((t) => t.name))];
}

// ---------------------------------------------------------------------------
// The database — read through one `query(text, params) → rows` function so
// the reading is testable without Postgres and the deciding is pure.
// ---------------------------------------------------------------------------

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Double-quoted, and refused outright when the name could carry anything
 *  but a name — the identifiers come from a file in this repo, but a DROP
 *  is built from them. */
export function quoteIdent(name) {
  if (!SAFE_IDENT.test(name)) throw new Error(`refusing to quote identifier ${JSON.stringify(name)}`);
  return `"${name}"`;
}

/** The catalog's answer for every object the footprint names. */
export async function inspectFootprint(query, footprint) {
  const created = footprint.tables.map((t) => t.name);
  const tablesOfInterest = [
    ...new Set([
      ...created,
      ...footprint.columns.map((c) => c.table),
      ...footprint.indexes.map((i) => i.table),
      ...footprint.constraints.map((c) => c.table),
    ]),
  ];
  const enumNames = [
    ...new Set([...footprint.enums.map((e) => e.name), ...footprint.enumValues.map((v) => v.type)]),
  ];
  const extensionNames = footprint.extensions.map((e) => e.name);
  for (const name of [...tablesOfInterest, ...enumNames, ...extensionNames]) quoteIdent(name);

  const observed = {
    tables: new Set(),
    columns: new Map(), // "Table.column" → { udt, nullable }
    indexes: new Map(), // name → { table, unique, def }
    constraints: new Map(), // "Table.name" → { contype, refTable }
    pkTables: new Set(),
    enums: new Map(), // name → labels[]
    extensions: new Set(),
    rows: new Map(), // created table that exists → has at least one row
    dependents: [], // foreign keys from OTHER tables onto created tables
  };

  if (tablesOfInterest.length > 0) {
    for (const row of await query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1)`,
      [tablesOfInterest],
    )) {
      observed.tables.add(row.table_name);
    }
    for (const row of await query(
      `select table_name, column_name, udt_name, is_nullable
       from information_schema.columns
       where table_schema = 'public' and table_name = any($1)`,
      [tablesOfInterest],
    )) {
      observed.columns.set(`${row.table_name}.${row.column_name}`, {
        udt: row.udt_name,
        nullable: row.is_nullable === "YES",
      });
    }
    for (const row of await query(
      `select tablename, indexname, indexdef from pg_indexes
       where schemaname = 'public' and tablename = any($1)`,
      [tablesOfInterest],
    )) {
      observed.indexes.set(row.indexname, {
        table: row.tablename,
        unique: /^CREATE\s+UNIQUE\s+INDEX/i.test(row.indexdef),
        def: row.indexdef,
      });
    }
    for (const row of await query(
      `select c.relname as table_name, con.conname, con.contype,
              coalesce(r.relname, '') as ref_table
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_class r on r.oid = con.confrelid
       where n.nspname = 'public' and c.relname = any($1)`,
      [tablesOfInterest],
    )) {
      observed.constraints.set(`${row.table_name}.${row.conname}`, {
        contype: row.contype,
        refTable: row.ref_table,
      });
      if (row.contype === "p") observed.pkTables.add(row.table_name);
    }
  }

  const existingCreated = created.filter((name) => observed.tables.has(name));
  if (existingCreated.length > 0) {
    for (const row of await query(
      `select c.relname as from_table, con.conname, r.relname as to_table
       from pg_constraint con
       join pg_class r on r.oid = con.confrelid
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = r.relnamespace
       where con.contype = 'f' and n.nspname = 'public'
         and r.relname = any($1) and not (c.relname = any($1))
       order by c.relname, con.conname`,
      [existingCreated],
    )) {
      observed.dependents.push({
        fromTable: row.from_table,
        conname: row.conname,
        toTable: row.to_table,
      });
    }
    for (const name of existingCreated) {
      const [row] = await query(
        `select exists (select 1 from ${quoteIdent(name)} limit 1) as has_rows`,
        [],
      );
      observed.rows.set(name, Boolean(row?.has_rows));
    }
  }

  if (enumNames.length > 0) {
    for (const row of await query(
      `select t.typname, coalesce(array_agg(e.enumlabel order by e.enumsortorder)
                                  filter (where e.enumlabel is not null), '{}') as labels
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       left join pg_enum e on e.enumtypid = t.oid
       where n.nspname = 'public' and t.typtype = 'e' and t.typname = any($1)
       group by t.typname`,
      [enumNames],
    )) {
      observed.enums.set(row.typname, row.labels);
    }
  }

  if (extensionNames.length > 0) {
    for (const row of await query(
      `select extname from pg_extension where extname = any($1)`,
      [extensionNames],
    )) {
      observed.extensions.add(row.extname);
    }
  }

  return observed;
}

// ---------------------------------------------------------------------------
// The decision — pure, so the whole table of outcomes is unit-testable.
// ---------------------------------------------------------------------------

const indexNamesColumn = (def, column) =>
  new RegExp(`[\\s(,]"?${column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?[\\s),]`).test(def);

/** Why the footprint is not all present in the declared shape — empty means
 *  it is. */
function completenessGaps(footprint, observed) {
  const gaps = [];
  const checkColumn = (table, column) => {
    const key = `${table}.${column.name}`;
    const found = observed.columns.get(key);
    if (!found) return gaps.push(`column ${key} is missing`);
    if (column.udt === null) return gaps.push(`column ${key}: type ${column.rawType} is one this guard cannot check`);
    if (found.udt !== column.udt) return gaps.push(`column ${key} is ${found.udt}, declared ${column.rawType}`);
    if (found.nullable !== column.nullable)
      return gaps.push(`column ${key} is ${found.nullable ? "nullable" : "NOT NULL"}, declared ${column.nullable ? "nullable" : "NOT NULL"}`);
    return undefined;
  };

  for (const table of footprint.tables) {
    if (!observed.tables.has(table.name)) {
      gaps.push(`table ${table.name} is missing`);
      continue;
    }
    for (const column of table.columns) checkColumn(table.name, column);
    if (table.primaryKey && !observed.pkTables.has(table.name)) gaps.push(`table ${table.name} has no primary key`);
    for (const constraint of table.constraints) checkConstraint(table.name, constraint);
  }
  for (const column of footprint.columns) {
    if (!observed.tables.has(column.table)) gaps.push(`table ${column.table} is missing`);
    else checkColumn(column.table, column);
  }
  for (const index of footprint.indexes) {
    const found = observed.indexes.get(index.name);
    if (!found) {
      gaps.push(`index ${index.name} is missing`);
      continue;
    }
    if (found.table !== index.table) gaps.push(`index ${index.name} is on ${found.table}, declared on ${index.table}`);
    if (found.unique !== index.unique) gaps.push(`index ${index.name} is ${found.unique ? "unique" : "not unique"}, declared ${index.unique ? "unique" : "not unique"}`);
    for (const column of index.columns ?? []) {
      if (!indexNamesColumn(found.def, column)) gaps.push(`index ${index.name} does not cover ${column}`);
    }
  }
  function checkConstraint(table, constraint) {
    const found = observed.constraints.get(`${table}.${constraint.name}`);
    if (!found) return gaps.push(`constraint ${constraint.name} on ${table} is missing`);
    if (constraint.kind && found.contype !== constraint.kind)
      return gaps.push(`constraint ${constraint.name} on ${table} is of kind ${found.contype}, declared ${constraint.kind}`);
    if (constraint.refTable && found.refTable !== constraint.refTable)
      return gaps.push(`constraint ${constraint.name} references ${found.refTable}, declared ${constraint.refTable}`);
    return undefined;
  }
  for (const constraint of footprint.constraints) checkConstraint(constraint.table, constraint);
  for (const enumType of footprint.enums) {
    const labels = observed.enums.get(enumType.name);
    if (!labels) {
      gaps.push(`enum type ${enumType.name} is missing`);
      continue;
    }
    for (const label of enumType.labels) if (!labels.includes(label)) gaps.push(`enum ${enumType.name} lacks '${label}'`);
  }
  for (const value of footprint.enumValues) {
    const labels = observed.enums.get(value.type);
    if (!labels) gaps.push(`enum type ${value.type} is missing`);
    else if (!labels.includes(value.label)) gaps.push(`enum ${value.type} lacks '${value.label}'`);
  }
  for (const extension of footprint.extensions) {
    if (!observed.extensions.has(extension.name)) gaps.push(`extension ${extension.name} is missing`);
  }
  return gaps;
}

/** Whether any object the footprint declares is present at all. */
function anyPresent(footprint, observed) {
  return (
    footprint.tables.some((t) => observed.tables.has(t.name)) ||
    footprint.columns.some((c) => observed.columns.has(`${c.table}.${c.name}`)) ||
    footprint.indexes.some((i) => observed.indexes.has(i.name)) ||
    footprint.constraints.some((c) => observed.constraints.has(`${c.table}.${c.name}`)) ||
    footprint.enums.some((e) => observed.enums.has(e.name)) ||
    footprint.enumValues.some((v) => observed.enums.get(v.type)?.includes(v.label)) ||
    // an extension is created with IF NOT EXISTS or not at all here; either
    // way its presence says nothing about THIS migration having run
    false
  );
}

/**
 * The resolution for one failed migration, from its footprint and what the
 * catalog showed. Exactly one of:
 *
 *   { action: "rolled-back" }                         — nothing of it exists
 *   { action: "applied" }                             — all of it exists, as declared
 *   { action: "drop-and-rolled-back", plan, discarded } — a stray, data-free
 *                                                        partial, droppable
 *   { action: "manual", gaps, blockers }              — everything else
 *
 * `gaps` are the completeness findings (what was missing or different);
 * `blockers` are the reasons a drop would not be lossless. Both are printed
 * so the person reading the build log starts from the facts, not the P3009.
 */
export function decideResolution(footprint, observed, derivedTables = DERIVED_TABLES) {
  const gaps = completenessGaps(footprint, observed);
  const unverifiable = [
    ...footprint.unknown.map((text) => `a statement this guard cannot check: ${text}`),
    ...footprint.data.map((d) => `a data statement it cannot verify ran: ${d.verb} on ${d.table}`),
  ];

  if (!anyPresent(footprint, observed)) {
    if (footprint.tables.length === 0 && footprint.enums.length === 0 && footprint.columns.length === 0 && footprint.indexes.length === 0 && footprint.constraints.length === 0 && footprint.enumValues.length === 0) {
      return { action: "manual", gaps, blockers: ["the migration declares nothing this guard can check", ...unverifiable] };
    }
    return { action: "rolled-back", gaps, blockers: [] };
  }

  if (gaps.length === 0 && unverifiable.length === 0) {
    return { action: "applied", gaps, blockers: [] };
  }

  // Partial or mismatched. A drop is lossless only when every object that
  // would go holds no data, and the re-apply would not collide with anything
  // on a table this migration did not create.
  const created = new Set(footprint.tables.map((t) => t.name));
  const blockers = [...unverifiable.filter((r) => !r.startsWith("a data statement"))];
  for (const d of footprint.data) {
    if (!created.has(d.table)) blockers.push(`a data statement on a table it did not create would run twice: ${d.verb} on ${d.table}`);
  }
  for (const column of footprint.columns) {
    if (!created.has(column.table) && observed.columns.has(`${column.table}.${column.name}`))
      blockers.push(`column ${column.table}.${column.name} already exists on a table it did not create — a column may hold data, and this guard never drops one`);
  }
  for (const value of footprint.enumValues) {
    if (observed.enums.get(value.type)?.includes(value.label))
      blockers.push(`enum value '${value.label}' already exists on ${value.type} — Postgres cannot remove an enum value`);
  }
  for (const extension of footprint.extensions) {
    if (!extension.ifNotExists && observed.extensions.has(extension.name))
      blockers.push(`extension ${extension.name} exists and the migration creates it without IF NOT EXISTS`);
  }
  const discarded = [];
  for (const table of footprint.tables) {
    if (!observed.tables.has(table.name)) continue;
    const hasRows = observed.rows.get(table.name) === true;
    const derived = derivedTables.has(table.name);
    if (hasRows && !derived) blockers.push(`table ${table.name} has rows and is not a declared derivation`);
    discarded.push({ table: table.name, hasRows, derived: derived ? derivedTables.get(table.name) : null });
  }

  const plan = [];
  for (const d of observed.dependents) {
    if (created.has(d.toTable)) plan.push(`ALTER TABLE ${quoteIdent(d.fromTable)} DROP CONSTRAINT ${quoteIdent(d.conname)}`);
  }
  for (const constraint of footprint.constraints) {
    if (!created.has(constraint.table) && observed.constraints.has(`${constraint.table}.${constraint.name}`))
      plan.push(`ALTER TABLE ${quoteIdent(constraint.table)} DROP CONSTRAINT ${quoteIdent(constraint.name)}`);
  }
  for (const index of footprint.indexes) {
    if (!created.has(index.table) && observed.indexes.has(index.name)) plan.push(`DROP INDEX ${quoteIdent(index.name)}`);
  }
  for (const table of [...footprint.tables].reverse()) {
    if (observed.tables.has(table.name)) plan.push(`DROP TABLE ${quoteIdent(table.name)}`);
  }
  for (const enumType of [...footprint.enums].reverse()) {
    if (observed.enums.has(enumType.name)) plan.push(`DROP TYPE ${quoteIdent(enumType.name)}`);
  }

  if (blockers.length > 0) return { action: "manual", gaps, blockers, plan: [] };
  return { action: "drop-and-rolled-back", gaps, blockers: [], plan, discarded };
}

/** The exact manual resolution, printed when the guard cannot prove any of
 *  its three facts. Written for the build log — the only place anyone will
 *  read it. */
export function manualResolveInstructions(name, decision) {
  const gaps = decision?.gaps ?? [];
  const blockers = decision?.blockers ?? [];
  const lines = [
    `migrate-deploy: NOT auto-resolving \`${name}\` — its footprint is neither absent, nor complete, nor droppable without loss.`,
  ];
  if (gaps.length > 0) lines.push("  What differs from the migration's own SQL:", ...gaps.map((g) => `    - ${g}`));
  if (blockers.length > 0) lines.push("  Why the stray objects were not dropped:", ...blockers.map((b) => `    - ${b}`));
  lines.push(
    "  Resolve it by hand, against the production DATABASE_URL:",
    `    1. npx prisma migrate status                          # see the failed record`,
    `    2. Compare each object above with prisma/migrations/${name}/migration.sql (psql: \\d "Table")`,
    `    3. If the work is ALL present and correct:  npx prisma migrate resolve --applied ${name}`,
    `       Otherwise drop what the migration would recreate (DROP TABLE …; foreign keys onto it first),`,
    `       then:                                    npx prisma migrate resolve --rolled-back ${name}`,
    `    4. Redeploy — the migration re-applies from scratch.`,
  );
  return lines.join("\n");
}

const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

/** The migration's own SQL from the repo, or null when the name is not a
 *  migration directory we carry (a failed record from a deleted branch's
 *  migration is a human problem, not a guard's). */
export function readMigrationSql(name) {
  if (!/^[\w-]+$/.test(name)) return null; // a name is a directory, nothing else
  try {
    return readFileSync(`${MIGRATIONS_DIR}/${name}/migration.sql`, "utf8");
  } catch {
    return null;
  }
}
