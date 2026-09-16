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
 * the tables (with their columns, types, nullability and defaults, and their
 * primary key), indexes (uniqueness, method, columns in order), constraints
 * (kind, columns, referenced table and columns, actions), enum types and
 * values, and extensions it creates. The database is read for each of them,
 * and the record is resolved only when one of three facts holds:
 *
 *   1. NOTHING it declares exists, and it carries no statement this parser
 *      cannot read and writes no data to a table it does not create → it
 *      applied nothing durable → `migrate resolve --rolled-back`, and the
 *      deploy re-applies it. (#87's rule, tightened: it used to check tables
 *      alone, and Prisma does NOT run a migration script atomically — a
 *      probe on 2026-09-16 showed the first CREATE TABLE surviving the
 *      second's failure — so an enum type created before a table that
 *      failed would have made the re-apply fail on "type already exists",
 *      forever.)
 *   2. EVERYTHING it declares exists in the declared shape, the tables it
 *      creates carry NOTHING it did not declare, and it carries no data
 *      statement and nothing this parser does not understand → its work is
 *      all present and only the record is wrong → `migrate resolve --applied`.
 *   3. SOME of it exists but not in the declared shape (the 2026-09-16
 *      case: a predecessor under another name built the tables differently),
 *      and everything that would have to go holds NO DATA — an index, a
 *      constraint, an enum type, a table with no rows, or a table this file
 *      declares a DERIVATION (its rows are rebuilt wholesale by the code
 *      that owns them) — and nothing it would ADD to a pre-existing table (a
 *      column, an enum value) is already there, and none of its names is
 *      taken by an object on some other table, and it writes no data to a
 *      pre-existing table → the stray objects are dropped in one
 *      transaction (foreign keys pointing at them first), the record is
 *      marked rolled-back, and the deploy re-applies the migration from
 *      scratch.
 *
 * Anything else prints the exact manual commands and stops the build, as
 * before: a table with rows the guard cannot vouch for, a column half-added
 * to a live table, a DROP or a RENAME in the migration, a type or an
 * expression it cannot compare. The failure direction is always "refuse": a
 * parser gap turns into a stopped build with instructions, never into a
 * resolve.
 *
 * TWO BUILDS AT ONCE. Every push runs two builds against the one database
 * (preview and production), and while a record is failed BOTH see P3009.
 * Prisma serialises only `migrate deploy` (its advisory lock, 72707369); a
 * guard that read the catalog, then dropped, could drop the tables the
 * other build had just re-applied and leave the record saying "applied"
 * over an empty schema. So the whole heal — the catalog read, the decision
 * and the drop — runs in ONE transaction that first takes Prisma's own lock
 * (so no deploy is mid-apply) and then locks the failed record itself
 * (`FOR UPDATE`; no row means the other build already resolved it), and
 * resolves the record itself — the same writes `prisma migrate resolve`
 * makes — before it commits, so the drop and the record change land
 * together or not at all.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

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

/** The advisory lock `prisma migrate deploy` takes for the length of an
 *  apply — `SELECT pg_advisory_lock(72707369)` in the schema engine's own
 *  strings. Holding it as a transaction lock while the guard reads and drops
 *  means no deploy is mid-apply underneath it, and no deploy starts until
 *  the drop has committed. (`PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` turns
 *  Prisma's side off; the guard's transaction still serialises guards.) */
export const PRISMA_MIGRATE_LOCK = 72707369;

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

/** A comma list of plain identifiers — `("a", b)` → ["a", "b"] — or null
 *  when any item is an expression this guard does not read. */
function identList(inner) {
  const names = [];
  for (const item of splitTopLevel(inner, ",")) {
    const match = item.match(new RegExp(`^${IDENT_SOURCE}$`));
    if (!match) return null;
    names.push(ident(match, 1));
  }
  return names;
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

/**
 * A DEFAULT expression in the form both sides can be compared in. Postgres
 * renders `''` as `''::text`, `'NEW'` as `'NEW'::"ShortlistState"`,
 * `ARRAY[]::TEXT[]` as `ARRAY[]::text[]` and `now()` as `now()` — the casts
 * and the spelling of "now" are the only differences a hand-written default
 * in this repo shows against the catalog, so those are the only things
 * folded. Anything else has to match verbatim.
 */
export function normalizeDefault(text) {
  if (text === null || text === undefined) return null;
  let value = String(text).trim();
  while (/^\([\s\S]*\)$/.test(value)) value = value.slice(1, -1).trim();
  value = value
    .replace(/::"[^"]+"(?:\[\])*/g, "")
    .replace(/::[A-Za-z_][A-Za-z0-9_ ]*(?:\[\])*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^now\(\)$/i.test(value) || /^current_timestamp(?:\(\d*\))?$/i.test(value)) return "CURRENT_TIMESTAMP";
  if (/^(true|false|null)$/i.test(value)) return value.toLowerCase();
  return value;
}

const COLUMN_TAIL =
  /\b(NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|GENERATED|COLLATE|CONSTRAINT)\b/i;
const DEFAULT_EXPR =
  /\bDEFAULT\s+([\s\S]*?)(?=\s+(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|GENERATED|COLLATE|CONSTRAINT)\b|$)/i;

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
  const serial = /^(big)?serial$/i.test(rawType);
  const defaultMatch = tail.match(DEFAULT_EXPR);
  return {
    name,
    rawType,
    udt: expectedUdt(rawType),
    nullable: !(notNull || primaryKey),
    primaryKey,
    // A serial's default is a sequence the catalog names and the SQL does
    // not; null here means "do not compare".
    default: serial ? null : defaultMatch ? normalizeDefault(defaultMatch[1]) : "",
  };
}

const ACTION = /(SET\s+NULL|SET\s+DEFAULT|CASCADE|RESTRICT|NO\s+ACTION)/i;
const foldAction = (text) => (text ? text.toUpperCase().replace(/\s+/g, " ") : "NO ACTION");

/**
 * The body of a constraint — what follows `CONSTRAINT "name"` in a
 * migration, and what `pg_get_constraintdef` renders — as data. One parser
 * for both sides is what makes the comparison honest.
 */
export function parseConstraintBody(text) {
  const body = String(text ?? "").trim();
  let match;
  if ((match = body.match(/^PRIMARY\s+KEY\s*\(/i))) {
    const parens = balancedParens(body, match[0].length - 1);
    return { kind: "p", columns: parens ? identList(parens.inner) : null };
  }
  if ((match = body.match(/^UNIQUE\s*(?:NULLS\s+(?:NOT\s+)?DISTINCT\s*)?\(/i))) {
    const parens = balancedParens(body, match[0].length - 1);
    return { kind: "u", columns: parens ? identList(parens.inner) : null };
  }
  if ((match = body.match(/^FOREIGN\s+KEY\s*\(/i))) {
    const cols = balancedParens(body, match[0].length - 1);
    if (!cols) return { kind: "f", columns: null, refTable: null, refColumns: null };
    const after = body.slice(cols.end);
    const ref = after.match(
      new RegExp(`^\\s*REFERENCES\\s+(?:(?:"[^"]+"|\\w+)\\.)?${IDENT_SOURCE}\\s*`, "i"),
    );
    if (!ref) return { kind: "f", columns: identList(cols.inner), refTable: null, refColumns: null };
    const refTable = ident(ref, 1);
    const refCols = balancedParens(after, ref[0].length);
    const tail = refCols ? after.slice(refCols.end) : after.slice(ref[0].length);
    const onDelete = tail.match(new RegExp(`ON\\s+DELETE\\s+${ACTION.source}`, "i"));
    const onUpdate = tail.match(new RegExp(`ON\\s+UPDATE\\s+${ACTION.source}`, "i"));
    return {
      kind: "f",
      columns: identList(cols.inner),
      refTable,
      refColumns: refCols && refCols.end <= after.length && after.slice(ref[0].length).trimStart().startsWith("(")
        ? identList(refCols.inner)
        : null,
      onDelete: foldAction(onDelete?.[1]),
      onUpdate: foldAction(onUpdate?.[1]),
    };
  }
  if (/^CHECK\b/i.test(body)) return { kind: "c", checkable: false };
  if (/^EXCLUDE\b/i.test(body)) return { kind: "x", checkable: false };
  return null;
}

/** `CONSTRAINT "name" <body>` in a migration. */
function parseNamedConstraint(text) {
  const match = text.match(new RegExp(`^CONSTRAINT\\s+${IDENT_SOURCE}\\s+([\\s\\S]*)$`, "i"));
  if (!match) return null;
  const parsed = parseConstraintBody(match[3]);
  if (!parsed) return null;
  return { name: ident(match, 1), ...parsed };
}

/** The column list of an index — `("a", "b")`, `("title" gin_trgm_ops)`,
 *  `(view, "sourceKey")` — or null when any item is an expression. Ordering
 *  words and operator classes after the name are allowed and ignored. */
function parseIndexColumns(inner) {
  const columns = [];
  for (const item of splitTopLevel(inner, ",")) {
    const match = item.match(new RegExp(`^${IDENT_SOURCE}(?:\\s+[^()]*)?$`));
    if (!match) return null;
    columns.push(ident(match, 1));
  }
  return columns;
}

/**
 * `pg_indexes.indexdef` as data — `CREATE [UNIQUE] INDEX "n" ON
 * public."T" USING btree (a, "B")` — in the same shape the migration's own
 * CREATE INDEX is parsed into.
 */
export function parseIndexDef(def) {
  const match = String(def ?? "").match(
    new RegExp(
      `^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+${IDENT_SOURCE}\\s+ON\\s+(?:ONLY\\s+)?(?:(?:"[^"]+"|\\w+)\\.)?${IDENT_SOURCE}\\s+USING\\s+(\\w+)\\s*\\(`,
      "i",
    ),
  );
  if (!match) return null;
  const parens = balancedParens(def, match[0].length - 1);
  if (!parens) return null;
  const rest = def.slice(parens.end);
  return {
    unique: Boolean(match[1]),
    name: ident(match, 2),
    table: ident(match, 4),
    method: match[6].toLowerCase(),
    columns: parseIndexColumns(parens.inner),
    where: /\bWHERE\b/i.test(rest),
    include: /\bINCLUDE\b/i.test(rest),
  };
}

const RE = {
  createTable: new RegExp(
    `^CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${IDENT_SOURCE}\\s*\\(`,
    "i",
  ),
  createIndex: new RegExp(
    `^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT_SOURCE}\\s+ON\\s+(?:ONLY\\s+)?${IDENT_SOURCE}\\s*(?:USING\\s+(\\w+)\\s*)?\\(`,
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
 * COLUMN, a bare `SET` — and one entry there is enough to refuse every
 * resolve, because a footprint with a hole in it proves nothing.
 */
export function parseMigrationFootprint(sql) {
  const footprint = {
    tables: [], // { name, ifNotExists, columns, primaryKey, primaryKeyColumns, constraints }
    columns: [], // ADD COLUMN → { table, name, rawType, udt, nullable, default }
    indexes: [], // { name, table, unique, method, columns, where, include }
    constraints: [], // ADD CONSTRAINT → { table, name, kind, columns, refTable, refColumns, onDelete, onUpdate }
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
        primaryKeyColumns: null,
        constraints: [],
      };
      for (const item of splitTopLevel(parens.inner, ",")) {
        if (/^CONSTRAINT\b/i.test(item)) {
          const constraint = parseNamedConstraint(item);
          if (!constraint) {
            footprint.unknown.push(excerpt(item));
            continue;
          }
          if (constraint.kind === "p") {
            table.primaryKey = true;
            table.primaryKeyColumns = constraint.columns;
          }
          table.constraints.push(constraint);
          continue;
        }
        if (/^PRIMARY\s+KEY\b/i.test(item)) {
          table.primaryKey = true;
          table.primaryKeyColumns = parseConstraintBody(item)?.columns ?? null;
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
        if (column.primaryKey) {
          table.primaryKey = true;
          table.primaryKeyColumns = [column.name];
        }
        table.columns.push(column);
      }
      footprint.tables.push(table);
      continue;
    }

    if ((match = statement.match(RE.createIndex))) {
      const parens = balancedParens(statement, match[0].length - 1);
      const rest = parens ? statement.slice(parens.end) : "";
      footprint.indexes.push({
        name: ident(match, 2),
        table: ident(match, 4),
        unique: Boolean(match[1]),
        method: (match[6] ?? "btree").toLowerCase(),
        columns: parens ? parseIndexColumns(parens.inner) : null,
        where: /\bWHERE\b/i.test(rest),
        include: /\bINCLUDE\b/i.test(rest),
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
        const column =
          add && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b/i.test(add[1]) ? parseColumnDef(add[1]) : null;
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

/** An empty catalog, in the shape `inspectFootprint` fills. */
export function emptyObserved() {
  return {
    tables: new Set(),
    columns: new Map(), // "Table.column" → { udt, nullable, default }
    indexes: new Map(), // name → { table, unique, method, columns, where, include, def }
    constraints: new Map(), // "Table.name" → { contype, def, ...parseConstraintBody(def) }
    enums: new Map(), // name → labels[]
    types: new Map(), // name → typtype, for every declared enum name that exists as any type
    extensions: new Set(),
    relations: new Map(), // name → { kind, table } for every declared table/index name, schema-wide
    rows: new Map(), // created table that exists → has at least one row
    dependents: [], // foreign keys from OTHER tables onto created tables
  };
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
  const relationNames = [...new Set([...created, ...footprint.indexes.map((i) => i.name)])];
  const enumNames = [
    ...new Set([...footprint.enums.map((e) => e.name), ...footprint.enumValues.map((v) => v.type)]),
  ];
  const extensionNames = footprint.extensions.map((e) => e.name);
  for (const name of [...tablesOfInterest, ...relationNames, ...enumNames, ...extensionNames]) quoteIdent(name);

  const observed = emptyObserved();

  if (tablesOfInterest.length > 0) {
    for (const row of await query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1)`,
      [tablesOfInterest],
    )) {
      observed.tables.add(row.table_name);
    }
    for (const row of await query(
      `select table_name, column_name, udt_name, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public' and table_name = any($1)`,
      [tablesOfInterest],
    )) {
      observed.columns.set(`${row.table_name}.${row.column_name}`, {
        udt: row.udt_name,
        nullable: row.is_nullable === "YES",
        default: normalizeDefault(row.column_default) ?? "",
      });
    }
    for (const row of await query(
      `select tablename, indexname, indexdef from pg_indexes
       where schemaname = 'public' and tablename = any($1)`,
      [tablesOfInterest],
    )) {
      const parsed = parseIndexDef(row.indexdef);
      observed.indexes.set(row.indexname, {
        table: row.tablename,
        unique: parsed ? parsed.unique : /^CREATE\s+UNIQUE\s+INDEX/i.test(row.indexdef),
        method: parsed?.method ?? null,
        columns: parsed?.columns ?? null,
        where: parsed?.where ?? true,
        include: parsed?.include ?? true,
        def: row.indexdef,
      });
    }
    for (const row of await query(
      `select c.relname as table_name, con.conname, con.contype,
              pg_get_constraintdef(con.oid) as def
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = any($1)`,
      [tablesOfInterest],
    )) {
      observed.constraints.set(`${row.table_name}.${row.conname}`, {
        contype: row.contype,
        def: row.def,
        ...(parseConstraintBody(row.def) ?? {}),
      });
    }
  }

  if (relationNames.length > 0) {
    for (const row of await query(
      `select c.relname, c.relkind, coalesce(t.relname, '') as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_index i on i.indexrelid = c.oid
       left join pg_class t on t.oid = i.indrelid
       where n.nspname = 'public' and c.relname = any($1)`,
      [relationNames],
    )) {
      observed.relations.set(row.relname, { kind: row.relkind, table: row.table_name });
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
    // `enumlabel` is of type `name`, and node-postgres hands a `name[]` back
    // as the raw '{A,B}' string — the cast to text[] is what makes it a list.
    for (const row of await query(
      `select t.typname, t.typtype,
              coalesce(array_agg(e.enumlabel::text order by e.enumsortorder)
                       filter (where e.enumlabel is not null), '{}'::text[]) as labels
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       left join pg_enum e on e.enumtypid = t.oid
       where n.nspname = 'public' and t.typname = any($1)
       group by t.typname, t.typtype`,
      [enumNames],
    )) {
      observed.types.set(row.typname, row.typtype);
      if (row.typtype === "e") observed.enums.set(row.typname, Array.isArray(row.labels) ? row.labels : null);
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

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const show = (list) => (Array.isArray(list) ? `(${list.join(", ")})` : "(something this guard cannot read)");

/**
 * What EVERY OTHER migration in the repo declares — the tables, columns,
 * indexes, constraints and enum types that are live schema by definition,
 * because a migration that is not the failed one created them. A stray is
 * only ever something NO carried migration owns; an empty table the failed
 * migration happens to name, but an earlier applied migration created, is
 * not a stray and is never dropped.
 */
export function ownedByOtherMigrations(name, migrationsDir = MIGRATIONS_DIR) {
  const owned = { tables: new Map(), columns: new Map(), indexes: new Map(), constraints: new Map(), enums: new Map() };
  let dirs = [];
  try {
    dirs = readdirSync(migrationsDir).filter((d) => d !== name && /^[\w-]+$/.test(d));
  } catch {
    return owned;
  }
  for (const dir of dirs) {
    let sql;
    try {
      sql = readFileSync(`${migrationsDir}/${dir}/migration.sql`, "utf8");
    } catch {
      continue;
    }
    const fp = parseMigrationFootprint(sql);
    for (const t of fp.tables) {
      owned.tables.set(t.name, dir);
      for (const c of t.columns) owned.columns.set(`${t.name}.${c.name}`, dir);
      for (const k of t.constraints) owned.constraints.set(`${t.name}.${k.name}`, dir);
    }
    for (const c of fp.columns) owned.columns.set(`${c.table}.${c.name}`, dir);
    for (const i of fp.indexes) owned.indexes.set(i.name, dir);
    for (const k of fp.constraints) owned.constraints.set(`${k.table}.${k.name}`, dir);
    for (const e of fp.enums) owned.enums.set(e.name, dir);
  }
  return owned;
}

/** An ownership index with nothing in it — for tests, and for a decision
 *  that is deliberately taken without the migrations directory. */
export const nothingOwned = () => ({
  tables: new Map(),
  columns: new Map(),
  indexes: new Map(),
  constraints: new Map(),
  enums: new Map(),
});
const NOTHING_OWNED = nothingOwned;

/** Why the footprint is not all present in the declared shape — empty means
 *  it is. Every comparison is exact; anything this guard cannot compare (an
 *  expression, a CHECK, a partial index, an unknown type) is a gap too,
 *  because "cannot tell" is not "present". */
function completenessGaps(footprint, observed) {
  const gaps = [];
  const declaredTables = new Map(footprint.tables.map((t) => [t.name, t]));

  const checkColumn = (table, column) => {
    const key = `${table}.${column.name}`;
    const found = observed.columns.get(key);
    if (!found) return gaps.push(`column ${key} is missing`);
    if (column.udt === null) return gaps.push(`column ${key}: type ${column.rawType} is one this guard cannot check`);
    if (found.udt !== column.udt) return gaps.push(`column ${key} is ${found.udt}, declared ${column.rawType}`);
    if (found.nullable !== column.nullable)
      return gaps.push(
        `column ${key} is ${found.nullable ? "nullable" : "NOT NULL"}, declared ${column.nullable ? "nullable" : "NOT NULL"}`,
      );
    if (column.default !== null && found.default !== column.default)
      return gaps.push(
        `column ${key} defaults to ${found.default === "" ? "nothing" : found.default}, declared ${column.default === "" ? "no default" : column.default}`,
      );
    return undefined;
  };

  const checkConstraint = (table, constraint) => {
    const found = observed.constraints.get(`${table}.${constraint.name}`);
    if (!found) return gaps.push(`constraint ${constraint.name} on ${table} is missing`);
    if (constraint.kind && found.contype !== constraint.kind)
      return gaps.push(`constraint ${constraint.name} on ${table} is of kind ${found.contype}, declared ${constraint.kind}`);
    if (constraint.kind === "c" || constraint.kind === "x" || !constraint.kind)
      return gaps.push(`constraint ${constraint.name} on ${table} is one this guard cannot compare`);
    if (!sameList(found.columns, constraint.columns))
      return gaps.push(`constraint ${constraint.name} on ${table} covers ${show(found.columns)}, declared ${show(constraint.columns)}`);
    if (constraint.kind === "f") {
      if (found.refTable !== constraint.refTable)
        return gaps.push(`constraint ${constraint.name} references ${found.refTable}, declared ${constraint.refTable}`);
      if (!sameList(found.refColumns, constraint.refColumns))
        return gaps.push(`constraint ${constraint.name} references ${show(found.refColumns)}, declared ${show(constraint.refColumns)}`);
      if (found.onDelete !== constraint.onDelete || found.onUpdate !== constraint.onUpdate)
        return gaps.push(
          `constraint ${constraint.name} is ON DELETE ${found.onDelete} ON UPDATE ${found.onUpdate}, declared ON DELETE ${constraint.onDelete} ON UPDATE ${constraint.onUpdate}`,
        );
    }
    return undefined;
  };

  for (const table of footprint.tables) {
    const relation = observed.relations.get(table.name);
    if (relation && relation.kind !== "r") {
      gaps.push(`the name ${table.name} is taken by a relation of kind ${relation.kind}, not a table`);
      continue;
    }
    if (!observed.tables.has(table.name)) {
      gaps.push(`table ${table.name} is missing`);
      continue;
    }
    for (const column of table.columns) checkColumn(table.name, column);
    for (const constraint of table.constraints) checkConstraint(table.name, constraint);
    // What the migration adds to its own table in later statements —
    // Prisma's spelling puts every foreign key in an ALTER TABLE after the
    // CREATE — is part of the table's declared shape.
    for (const column of footprint.columns) if (column.table === table.name) checkColumn(table.name, column);
    for (const constraint of footprint.constraints) if (constraint.table === table.name) checkConstraint(table.name, constraint);

    // The primary key: present, on exactly the declared columns.
    const pk = [...observed.constraints.entries()].find(
      ([key, c]) => key.startsWith(`${table.name}.`) && c.contype === "p",
    );
    if (table.primaryKey) {
      if (!pk) gaps.push(`table ${table.name} has no primary key`);
      else if (!sameList(pk[1].columns, table.primaryKeyColumns))
        gaps.push(`table ${table.name} has primary key ${show(pk[1].columns)}, declared ${show(table.primaryKeyColumns)}`);
    } else if (pk) gaps.push(`table ${table.name} has a primary key it does not declare`);

    // Nothing the migration did not declare — a created table in a
    // different shape is not "the migration's work", even as a superset.
    const declaredColumns = new Set([
      ...table.columns.map((c) => c.name),
      ...footprint.columns.filter((c) => c.table === table.name).map((c) => c.name),
    ]);
    for (const key of observed.columns.keys()) {
      const [owner, column] = key.split(".");
      if (owner === table.name && !declaredColumns.has(column)) gaps.push(`column ${key} exists but is not declared`);
    }
    const declaredIndexes = new Set(footprint.indexes.filter((i) => i.table === table.name).map((i) => i.name));
    const pkName = pk ? pk[0].slice(table.name.length + 1) : null;
    for (const [name, index] of observed.indexes) {
      if (index.table === table.name && !declaredIndexes.has(name) && name !== pkName)
        gaps.push(`index ${name} on ${table.name} exists but is not declared`);
    }
    const declaredConstraints = new Set([
      ...table.constraints.map((c) => c.name),
      ...footprint.constraints.filter((c) => c.table === table.name).map((c) => c.name),
      ...(pkName ? [pkName] : []),
    ]);
    for (const [key, c] of observed.constraints) {
      if (!key.startsWith(`${table.name}.`)) continue;
      const name = key.slice(table.name.length + 1);
      // 'n' (NOT NULL, Postgres 18) and 't' (trigger) are not objects a
      // migration declares by name.
      if (c.contype === "n" || c.contype === "t") continue;
      if (!declaredConstraints.has(name)) gaps.push(`constraint ${name} on ${table.name} exists but is not declared`);
    }
  }

  for (const column of footprint.columns) {
    if (declaredTables.has(column.table)) continue; // checked with its table above
    if (!observed.tables.has(column.table)) gaps.push(`table ${column.table} is missing`);
    else checkColumn(column.table, column);
  }

  for (const index of footprint.indexes) {
    const relation = observed.relations.get(index.name);
    const found = observed.indexes.get(index.name);
    if (!found) {
      if (relation) gaps.push(`the name ${index.name} is taken by a ${relation.kind === "i" ? `index on ${relation.table}` : `relation of kind ${relation.kind}`}, not an index on ${index.table}`);
      else gaps.push(`index ${index.name} is missing`);
      continue;
    }
    if (found.table !== index.table) {
      gaps.push(`index ${index.name} is on ${found.table}, declared on ${index.table}`);
      continue;
    }
    if (found.unique !== index.unique)
      gaps.push(`index ${index.name} is ${found.unique ? "unique" : "not unique"}, declared ${index.unique ? "unique" : "not unique"}`);
    if (found.method !== index.method) gaps.push(`index ${index.name} uses ${found.method ?? "an unreadable method"}, declared ${index.method}`);
    if (index.columns === null || found.columns === null)
      gaps.push(`index ${index.name} is an expression index this guard cannot compare`);
    else if (!sameList(found.columns, index.columns))
      gaps.push(`index ${index.name} covers ${show(found.columns)}, declared ${show(index.columns)}`);
    if (index.where || found.where || index.include || found.include)
      gaps.push(`index ${index.name} is a partial or covering index this guard cannot compare`);
  }

  for (const constraint of footprint.constraints) {
    if (declaredTables.has(constraint.table)) continue; // checked with its table above
    if (!observed.tables.has(constraint.table)) gaps.push(`table ${constraint.table} is missing`);
    else checkConstraint(constraint.table, constraint);
  }

  for (const enumType of footprint.enums) {
    const typtype = observed.types.get(enumType.name);
    if (typtype && typtype !== "e") {
      gaps.push(`the name ${enumType.name} is taken by a type that is not an enum`);
      continue;
    }
    const labels = observed.enums.get(enumType.name);
    if (!labels) {
      gaps.push(`enum type ${enumType.name} is missing`);
      continue;
    }
    if (!sameList(labels, enumType.labels)) gaps.push(`enum ${enumType.name} has ${show(labels)}, declared ${show(enumType.labels)}`);
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

/** Whether any object the footprint declares is present at all — including
 *  a declared NAME taken by something else, which is "present" in the sense
 *  that matters: the re-apply would collide with it. */
function anyPresent(footprint, observed) {
  return (
    footprint.tables.some((t) => observed.tables.has(t.name) || observed.relations.has(t.name)) ||
    footprint.columns.some((c) => observed.columns.has(`${c.table}.${c.name}`)) ||
    footprint.indexes.some((i) => observed.indexes.has(i.name) || observed.relations.has(i.name)) ||
    footprint.constraints.some((c) => observed.constraints.has(`${c.table}.${c.name}`)) ||
    footprint.enums.some((e) => observed.types.has(e.name)) ||
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
 *   { action: "applied" }                             — all of it exists, as declared, and nothing else
 *   { action: "drop-and-rolled-back", plan, discarded } — a stray, data-free
 *                                                        partial, droppable
 *   { action: "manual", gaps, blockers }              — everything else
 *
 * `gaps` are the completeness findings (what was missing or different);
 * `blockers` are the reasons a resolve would not be safe. Both are printed
 * so the person reading the build log starts from the facts, not the P3009.
 */
export function decideResolution(footprint, observed, options = {}) {
  const derivedTables = options.derivedTables ?? DERIVED_TABLES;
  const owned = options.ownedElsewhere ?? NOTHING_OWNED();
  const gaps = completenessGaps(footprint, observed);
  const created = new Set(footprint.tables.map((t) => t.name));
  const unreadable = footprint.unknown.map((text) => `a statement this guard cannot check: ${text}`);
  const dataOnLiveTables = footprint.data
    .filter((d) => !created.has(d.table))
    .map((d) => `a data statement on a table it did not create may already have run, and would run again: ${d.verb} on ${d.table}`);
  const anyData = footprint.data.map((d) => `a data statement it cannot verify ran: ${d.verb} on ${d.table}`);

  if (!anyPresent(footprint, observed)) {
    const declaresNothing =
      footprint.tables.length === 0 &&
      footprint.enums.length === 0 &&
      footprint.columns.length === 0 &&
      footprint.indexes.length === 0 &&
      footprint.constraints.length === 0 &&
      footprint.enumValues.length === 0;
    const blockers = [
      ...(declaresNothing ? ["the migration declares nothing this guard can check"] : []),
      ...unreadable,
      ...dataOnLiveTables,
    ];
    if (blockers.length > 0) return { action: "manual", gaps, blockers, plan: [] };
    return { action: "rolled-back", gaps, blockers: [], plan: [] };
  }

  if (gaps.length === 0 && unreadable.length === 0 && anyData.length === 0) {
    return { action: "applied", gaps, blockers: [], plan: [] };
  }
  if (gaps.length === 0) {
    // Every object is there, but the migration also did something the
    // catalog cannot show — an UPDATE, a statement outside the vocabulary.
    // Neither "applied" nor a re-apply is provable.
    return { action: "manual", gaps, blockers: [...unreadable, ...anyData], plan: [] };
  }

  // Partial or mismatched. A drop is lossless only when every object that
  // would go holds no data, and the re-apply would not collide with anything
  // on a table this migration did not create.
  const blockers = [...unreadable, ...dataOnLiveTables];
  for (const table of footprint.tables) {
    const relation = observed.relations.get(table.name);
    if (relation && relation.kind !== "r")
      blockers.push(`the name ${table.name} is taken by a relation of kind ${relation.kind} this migration did not create`);
  }
  for (const index of footprint.indexes) {
    const relation = observed.relations.get(index.name);
    if (relation && (relation.kind !== "i" || relation.table !== index.table))
      blockers.push(
        `the name ${index.name} is taken by ${relation.kind === "i" ? `an index on ${relation.table}` : `a relation of kind ${relation.kind}`}, which this migration did not create`,
      );
  }
  for (const column of footprint.columns) {
    if (!created.has(column.table) && observed.columns.has(`${column.table}.${column.name}`))
      blockers.push(
        `column ${column.table}.${column.name} already exists on a table it did not create — a column may hold data, and this guard never drops one`,
      );
  }
  for (const enumType of footprint.enums) {
    const typtype = observed.types.get(enumType.name);
    if (typtype && typtype !== "e") blockers.push(`the name ${enumType.name} is taken by a type that is not an enum`);
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
    // Live schema is never a stray: a table another carried migration
    // creates, or one carrying a column, index or constraint another
    // migration declares, was built by the migration history, not by a
    // predecessor of this one.
    const ownerOfTable = owned.tables.get(table.name);
    if (ownerOfTable) blockers.push(`table ${table.name} is created by migration ${ownerOfTable} as well — live schema, not a stray`);
    for (const key of observed.columns.keys()) {
      if (key.startsWith(`${table.name}.`) && owned.columns.has(key))
        blockers.push(`column ${key} is declared by migration ${owned.columns.get(key)} — ${table.name} is live schema, not a stray`);
    }
    for (const [indexName, index] of observed.indexes) {
      if (index.table === table.name && owned.indexes.has(indexName))
        blockers.push(`index ${indexName} on ${table.name} is declared by migration ${owned.indexes.get(indexName)} — live schema, not a stray`);
    }
    for (const key of observed.constraints.keys()) {
      if (key.startsWith(`${table.name}.`) && owned.constraints.has(key))
        blockers.push(`constraint ${key} is declared by migration ${owned.constraints.get(key)} — ${table.name} is live schema, not a stray`);
    }
    // CREATE TABLE IF NOT EXISTS would have left an existing table exactly
    // as it was, so a differing one is not this migration's to replace.
    if (table.ifNotExists) blockers.push(`table ${table.name} is created with IF NOT EXISTS and exists in another shape — the migration would not have touched it`);
    const hasRows = observed.rows.get(table.name) === true;
    const derived = derivedTables.has(table.name);
    if (hasRows && !derived) blockers.push(`table ${table.name} has rows and is not a declared derivation`);
    discarded.push({ table: table.name, hasRows, derived: derived ? derivedTables.get(table.name) : null });
  }
  for (const enumType of footprint.enums) {
    if (observed.enums.has(enumType.name) && owned.enums.has(enumType.name))
      blockers.push(`enum type ${enumType.name} is created by migration ${owned.enums.get(enumType.name)} as well — live schema, not a stray`);
  }
  for (const index of footprint.indexes) {
    if (!created.has(index.table) && observed.indexes.get(index.name)?.table === index.table && owned.indexes.has(index.name))
      blockers.push(`index ${index.name} is declared by migration ${owned.indexes.get(index.name)} as well — live schema, not a stray`);
  }
  for (const constraint of footprint.constraints) {
    const key = `${constraint.table}.${constraint.name}`;
    if (!created.has(constraint.table) && observed.constraints.has(key) && owned.constraints.has(key))
      blockers.push(`constraint ${key} is declared by migration ${owned.constraints.get(key)} as well — live schema, not a stray`);
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
    if (!created.has(index.table) && observed.indexes.get(index.name)?.table === index.table)
      plan.push(`DROP INDEX ${quoteIdent(index.name)}`);
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

// ---------------------------------------------------------------------------
// The heal — one transaction under Prisma's own lock, then the resolve, then
// the record read back. Takes the connection and the resolver so the whole
// sequence is testable against a real database with a fake `resolve`.
// ---------------------------------------------------------------------------

const FAILED_RECORD = `select id from _prisma_migrations
  where migration_name = $1 and finished_at is null and rolled_back_at is null`;

/** The checksum Prisma records for a migration — the sha256 of its
 *  migration.sql, as hex. Verified against `migrate deploy`'s own rows. */
export function migrationChecksum(sql) {
  return createHash("sha256").update(String(sql ?? ""), "utf8").digest("hex");
}

/**
 * Heal ONE failed migration on an open pg client.
 *
 *   sql → the migration's own SQL, read from the repo when not given (its
 *         sha256 is the checksum an applied row carries)
 *   log → the build log
 *
 * The record is resolved INSIDE the transaction, by the same writes
 * `prisma migrate resolve` makes — watched against the CLI on 2026-09-16:
 * `--rolled-back` stamps `rolled_back_at` on the failed rows; `--applied`
 * does that and inserts a fresh row with `finished_at` set, the file's
 * checksum and `applied_steps_count` 0. Doing it here, under the same lock
 * and in the same transaction as the drop, means there is no moment at
 * which a drop is committed while the record still says failed — the
 * moment the other build of the same push would otherwise act on.
 *
 * Returns { outcome, decision }: outcome is "resolved" (the record is no
 * longer failed, by this build), "resolved-elsewhere" (another build got
 * there first — the caller just runs the deploy again), or "manual" (the
 * decision or the database said no; the caller prints the instructions).
 */
export async function healFailedMigration({
  client,
  name,
  footprint,
  sql = readMigrationSql(name),
  log,
  derivedTables = DERIVED_TABLES,
  ownedElsewhere = ownedByOtherMigrations(name),
  lockTimeout = "120s",
  maxHeals = 2,
}) {
  const query = async (text, params = []) => (await client.query(text, params)).rows;
  let decision = null;

  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL lock_timeout = '${String(lockTimeout).replace(/[^0-9a-z]/gi, "")}'`);
    await client.query("select pg_advisory_xact_lock($1)", [PRISMA_MIGRATE_LOCK]);
    const failed = await query(`${FAILED_RECORD} for update`, [name]);
    if (failed.length === 0) {
      await client.query("ROLLBACK");
      log(`\`${name}\` is no longer recorded as failed — another build resolved it while this one waited. Running the deploy again.`);
      return { outcome: "resolved-elsewhere", decision: null };
    }

    // A heal that keeps being needed is a re-apply that keeps failing, and
    // the error it fails with is in the PREVIOUS build's log, not here. Two
    // rounds allow for a re-apply lost to a dropped connection; a third
    // means a person has to read that error.
    const [{ heals }] = await query(
      `select count(*)::int as heals from _prisma_migrations where migration_name = $1 and rolled_back_at is not null`,
      [name],
    );
    if (heals >= maxHeals) {
      await client.query("ROLLBACK");
      return {
        outcome: "manual",
        decision: {
          action: "manual",
          gaps: [],
          blockers: [
            `\`${name}\` has already been marked rolled back ${heals} times and failed again each time — the re-apply itself is failing; read the error in the previous build's log`,
          ],
          plan: [],
        },
      };
    }

    const observed = await inspectFootprint(query, footprint);
    decision = decideResolution(footprint, observed, { derivedTables, ownedElsewhere });

    if (decision.action === "manual") {
      await client.query("ROLLBACK");
      return { outcome: "manual", decision };
    }

    if (decision.action === "drop-and-rolled-back") {
      log(
        `\`${name}\` is recorded as failed and what exists does not match its SQL ` +
          `(${decision.gaps.length} difference${decision.gaps.length === 1 ? "" : "s"}; first: ${decision.gaps[0]}). ` +
          "Nothing that would go holds data a person entered:",
      );
      for (const d of decision.discarded) {
        log(`    - ${d.table}: ${d.hasRows ? "HAS rows" : "no rows"}${d.derived ? ` — a declared derivation (${d.derived})` : ""}`);
      }
      log("Dropping the stray objects and marking the migration rolled-back in one transaction, under Prisma's migrate lock:");
      for (const statement of decision.plan) log(`    ${statement};`);
      for (const statement of decision.plan) await client.query(statement);
    } else if (decision.action === "applied") {
      log(
        `\`${name}\` is recorded as failed, and every object its SQL declares exists in the ` +
          `declared shape with nothing undeclared beside it (${describeFootprint(footprint)}) — its work is all present. Marking it applied.`,
      );
    } else {
      log(
        `\`${name}\` is recorded as failed, and nothing its SQL declares exists ` +
          `(${describeFootprint(footprint)}) — it provably applied nothing. Marking it rolled-back so this deploy can apply it cleanly.`,
      );
    }

    // The record, in the same transaction: what `prisma migrate resolve`
    // would write, without the window before it.
    await client.query(`update _prisma_migrations set rolled_back_at = now() where id = any($1)`, [failed.map((r) => r.id)]);
    if (decision.action === "applied") {
      await client.query(
        `insert into _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         values (gen_random_uuid()::text, $1, now(), $2, null, null, now(), 0)`,
        [migrationChecksum(sql), name],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    log(`the check-and-heal transaction failed and was rolled back (${error.message}) — resolve by hand.`);
    return { outcome: "manual", decision: decision ?? { action: "manual", gaps: [], blockers: [error.message], plan: [] } };
  }

  if (decision.action === "drop-and-rolled-back") log("Dropped and marked rolled-back. This deploy re-applies the migration from scratch.");

  // Read back rather than trusted — the one cheap check that the commit
  // did what the log just claimed.
  const stillFailed = await query(FAILED_RECORD, [name]);
  if (stillFailed.length > 0) {
    log(`the record for \`${name}\` is still failed after the commit — resolve by hand.`);
    return { outcome: "manual", decision };
  }
  if (decision.action === "applied") {
    const applied = await query(
      `select id from _prisma_migrations where migration_name = $1 and finished_at is not null and rolled_back_at is null`,
      [name],
    );
    if (applied.length === 0) {
      log(`no applied record exists for \`${name}\` after the commit — resolve by hand.`);
      return { outcome: "manual", decision };
    }
  }
  return { outcome: "resolved", decision };
}

/** "2 tables, 4 indexes, 1 constraint" — for the build log's one line. */
export function describeFootprint(footprint) {
  const count = (n, one, many) => (n === 0 ? null : `${n} ${n === 1 ? one : many}`);
  return (
    [
      count(footprint.tables.length, "table", "tables"),
      count(footprint.columns.length, "added column", "added columns"),
      count(footprint.indexes.length, "index", "indexes"),
      count(footprint.constraints.length, "constraint", "constraints"),
      count(footprint.enums.length, "enum type", "enum types"),
      count(footprint.enumValues.length, "enum value", "enum values"),
      count(footprint.extensions.length, "extension", "extensions"),
    ]
      .filter(Boolean)
      .join(", ") || "nothing checkable"
  );
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
  if (blockers.length > 0) lines.push("  Why it was not resolved:", ...blockers.map((b) => `    - ${b}`));
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
