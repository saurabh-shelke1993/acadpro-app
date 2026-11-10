# Kheltriva — PS-L2.3B B3.3 Original Migration SQL Source and Statement Review

**Checkpoint:** 11 November 2026 (Asia/Kolkata)  
**Branch:** `payment-module-finalization`  
**Active Supabase:** `ulyealhkmlorsbdiknrh`  
**Execution boundary:** Connected Supabase **SELECT only**, sanitized GitHub source evidence, isolated Python CI. No production writes, database password reset, `migration repair`, original SQL deployment or subscriptions billing changes.

## Main result

**Original ledger source inspected and every retained element fingerprinted; initial-schema token discrepancy clarified.** The complete private archive of executable historical SQL has **not** yet been copied to an approved private workspace, so full original-source recovery and replay authorization are **NOT complete**.

### A. Recovered original element-level source identities

Using `SELECT` and `unnest(statements) WITH ORDINALITY` against `supabase_migrations.schema_migrations`:

| Evidence | Actual result |
|---|---:|
| Migration versions | **82** |
| Original SQL array elements | **168** |
| Total UTF-8 bytes across the 168 retained source elements | **361,302** |
| Initial `20260823093317` array elements | **87** |
| Per-element SHA-256/ordinal/byte-length metadata records | **168** |
| Missing versions or changed statement counts compared with B2.4 | **0** |

Source evidence: `supabase/recovery/historical-baseline/b3_3_original_statement_fingerprints_20261111.json`. It contains the original version, name, **1-based ordinal**, exact element byte length, SHA-256, and conservative safety flags. **It contains no SQL bodies, quoted identifiers, customer UUIDs, credential strings or historical data rows.**

**Important distinction:** 168 means original **ledger array elements**, not necessarily 168 independently executable top-level SQL statements. The earlier B2.6 non-executing lexer found multiple SQL segments within individual elements. The immutable SHA-256 identity is of each original array string, preserving its exact bytes and order.

Broad lexical risk screening of the 168 source elements marked **73** with possible DML keywords, **71** with possible GRANT/REVOKE, **25** with SECURITY DEFINER and **7** with possible procedural DO patterns. These overlap and can include text inside function bodies/comments; they **must not** replace the B2.6 direct top-level DML (11 migrations, 20 direct statements) and 14 high-priority quarantine classifications.

The first version of this flag scan used an incompatible PostgreSQL word-boundary expression and undercounted flags. It was **corrected and re-run** against all 168 unchanged source SHA-256s before this checkpoint. The original SQL hashes are unaffected.

### B. Correction to initial-schema source mismatch

Prior B2.4/B3.2 whole-file comparison treated `20260823093317_remote_schema` as token-different: the retained SQL was concatenated using `array_to_string(statements, '')`, which strips **the meaningful boundaries between 87 separate SQL array entries**.

A fresh read-only review found:

- The original remote ledger has **87 separately retained base-SQL strings**, **none** with a trailing semicolon.
- The tracked Git `supabase/migrations/20260823093317_remote_schema.sql` has **87 semicolon-delimited SQL statements**.
- After preserving original array ordering, parsing the Git semicolon statement boundaries and ignoring comment/whitespace/statement delimiters while **retaining all quoted string/identifier values and SQL tokens**, **all 87 ordered statement positions match at the lexical-token level**.
- No unterminated SQL quotes/comments were detected by this lexical scanner.
- **This is not byte identity, full PostgreSQL parse-tree equivalence, RLS/grant/function behavior validation, or clean replay evidence.** The six original *strict raw-content* mismatch categories in B2.4 remain historically accurate; B3.3 explains the apparent token mismatch in the **initial snapshot**, rather than rewriting the pinned source fingerprints.

Sanitized review record: `supabase/recovery/historical-baseline/b3_3_base_statement_review_20261111.json`.

**Implication:** We should prioritize actual security/constraint parity and original-source replay testing for the base schema rather than assuming it contains substantive DDL differences merely because the raw concatenated file hash disagrees.

### C. Other historical SQL review gates

The remaining five same-version SQL differences have not been approved: three September 20 player-batch routine migrations had lexically aligned SQL in B3.2 but still require parser/function/trigger and `SECURITY DEFINER` validation; two September 20 historical player-batch cleanup migrations still differ by **two** and **one** UUID-shaped selectors respectively.

**Those two record-specific cleanup migrations remain STOP / QUARANTINE.** Source comparison is not authorization to execute operations against live player data, and no identifier values were printed or committed.

The **14** historical data/procedural migrations remain under mandatory review. An apparently pure DDL element could still invoke a function or create a trigger with side effects, so other migration entries are not deemed automatically safe.

### D. Offline verifier and tests

Implemented:
- `supabase/recovery/historical-baseline/b3_3_original_source_audit.py` — fail-closed, source-ordered audit of all **168** committed original element hashes, names and ordinals against B3.1/B3.2 metadata. With an optional **privately archived, SHA-256-verified original SQL source**, it independently validates all 168 actual source elements and compares six divergent migrations without emitting SQL text, quoted literals or customer values.
- `test_b3_3_original_source_audit.py` — ten tests of source inventory completeness, archive-not-ready gating, semicolon-free statement handling, protected string and dollar-quoted bodies, changed historical UUID literals, invalid quotes/comments, tampering of source order, premature approval and falsely claimed base-schema semantic parity.
- `.github/workflows/subscriptions-ps-l2-3-b3-3-original-source.yml` — metadata-only CI; **no database connection or SQL execution**, and it publishes a short-lived non-executable attestation artifact.
- **GitHub Actions [42886224678](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42886224678): PASS — 10 tests**, metadata checks, blocked replay assertions.

From the repository root (no DB password required for the metadata-only step):

```powershell
python supabase/recovery/historical-baseline/b3_3_original_source_audit.py --root . --output "$env:TEMP\kheltriva_b3_3_original_source_review.json"
```

When a verified, ignored private archive exists, add `--archive <private-archive-directory>`. Only then may the report state `all_168_element_hashes_verified_from_private_archive=true`. **Even then, replay readiness remains false until all migration-security and data-review gates pass.**

## Status and next gate

| Workstream | Status |
|---|---|
| Live original ledger inspection and 168 element-level SHA-256 source fingerprints | **Completed read-only** |
| Initial base migration 87/87 lexical statement matching | **Completed at lexical level; semantic/SQL replay untested** |
| Verified local private source archive containing 82 original migration arrays | **Not yet generated** |
| Full source/privilege/record-specific SQL manual sign-off | **Pending** |
| Six divergence semantic and data-literal disposition | **Pending** |
| B2.9 current helper bootstrap / historical creation timing | **Synthetic test passed; historical provenance unresolved** |
| B3 executable isolated Supabase migration replay | **Blocked; not attempted** |
| B4 subscription Auth/RLS/finance integration tests | **Not run** |
| Hosted DB/financial records/credentials/production migrations | **Unchanged** |

**Next practical task:** B3.4 protected original SQL archive acquisition and verification, or targeted parser-level security/constraint review using the connected read-only database. The raw archive is needed for a fully reproducible disposable database replay. Do not commit original SQL bodies to GitHub or silently replace it with the modern current-state catalog.

**Subscription lifecycle:** Expiry, renewal, proration and next-period payment-dues generation remain **unimplemented / unapproved for deployment** in the current PS-L2.3 lifecycle.
