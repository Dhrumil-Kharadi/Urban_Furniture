/**
 * Migration: Ledger integrity triggers
 *
 * WHY THIS EXISTS
 *
 * accounting.service.js already refuses to post an unbalanced entry, already
 * refuses to edit a posted one, and is the only code path that is supposed to
 * write to these tables. None of that is a guarantee.
 *
 * Application validation can be defeated by a bug, a migration script, a
 * psql session, a future module that writes the tables directly, or a
 * well-meaning fix that skips the service. These triggers cannot be. They are
 * the difference between "the ledger balances because our code is correct" and
 * "the ledger balances".
 *
 * FOUR GUARANTEES
 *
 *  1. Every non-draft entry balances — SUM(debit) = SUM(credit).
 *     Enforced by a DEFERRABLE CONSTRAINT TRIGGER, checked at COMMIT rather
 *     than per statement, because an entry is genuinely unbalanced in the
 *     middle of inserting its own lines. Checking per row would make correct
 *     code impossible to write.
 *
 *  2. Every non-draft entry has at least two lines.
 *     A one-line "double entry" is not a double entry.
 *
 *  3. A posted entry's LINES are immutable.
 *     BEFORE UPDATE OR DELETE, raising unless the parent is still draft.
 *
 *  4. A posted entry's HEADER is immutable except for reversal.
 *     The only permitted change is posted → reversed with reversed_by_entry_id
 *     set. Nothing may renumber, redate or rejournal a posted entry, and
 *     nothing may delete one.
 *
 * Correction is by reversing entry only — technicalrequirement.md §3.8.
 */

const UP = `
  -- ── Guarantees 1 and 2: balance and line count ────────────────────────────
  CREATE OR REPLACE FUNCTION assert_journal_entry_balanced()
  RETURNS TRIGGER AS $$
  DECLARE
    v_entry_id     UUID;
    v_status       TEXT;
    v_total_debit  NUMERIC(15,2);
    v_total_credit NUMERIC(15,2);
    v_line_count   INTEGER;
  BEGIN
    v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

    SELECT status INTO v_status FROM journal_entries WHERE id = v_entry_id;

    -- The parent was deleted in this same transaction (a draft entry going
    -- away takes its lines with it). There is nothing left to balance.
    IF v_status IS NULL THEN
      RETURN NULL;
    END IF;

    -- A draft is still being assembled and is allowed to be lopsided.
    IF v_status = 'draft' THEN
      RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
      INTO v_total_debit, v_total_credit, v_line_count
      FROM journal_entry_lines
     WHERE journal_entry_id = v_entry_id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION
        'Journal entry % has % line(s); a double-entry posting needs at least two',
        v_entry_id, v_line_count
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION
        'Journal entry % is unbalanced: debit % <> credit %',
        v_entry_id, v_total_debit, v_total_credit
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_journal_entry_lines_balanced ON journal_entry_lines;
  CREATE CONSTRAINT TRIGGER trg_journal_entry_lines_balanced
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_balanced();

  -- The same check, driven from the header. Without this, an entry inserted
  -- with status 'posted' and NO lines at all would never touch the line
  -- trigger and would slip through.
  CREATE OR REPLACE FUNCTION assert_journal_entry_header_balanced()
  RETURNS TRIGGER AS $$
  DECLARE
    v_total_debit  NUMERIC(15,2);
    v_total_credit NUMERIC(15,2);
    v_line_count   INTEGER;
  BEGIN
    IF NEW.status = 'draft' THEN
      RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
      INTO v_total_debit, v_total_credit, v_line_count
      FROM journal_entry_lines
     WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION
        'Journal entry % has % line(s); a double-entry posting needs at least two',
        NEW.id, v_line_count
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION
        'Journal entry % is unbalanced: debit % <> credit %',
        NEW.id, v_total_debit, v_total_credit
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_journal_entries_balanced ON journal_entries;
  CREATE CONSTRAINT TRIGGER trg_journal_entries_balanced
    AFTER INSERT OR UPDATE ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_header_balanced();

  -- ── Guarantee 3: posted lines are immutable ───────────────────────────────
  CREATE OR REPLACE FUNCTION forbid_posted_line_change()
  RETURNS TRIGGER AS $$
  DECLARE
    v_entry_id UUID;
    v_status   TEXT;
  BEGIN
    v_entry_id := COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

    SELECT status INTO v_status FROM journal_entries WHERE id = v_entry_id;

    -- The parent row is already gone, so this DELETE is the FK cascade from
    -- removing a draft entry. That is legitimate.
    IF v_status IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    IF v_status <> 'draft' THEN
      RAISE EXCEPTION
        'Journal entry lines are immutable once posted (entry %, status %). Correct by reversing entry.',
        v_entry_id, v_status
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_journal_entry_lines_immutable ON journal_entry_lines;
  CREATE TRIGGER trg_journal_entry_lines_immutable
    BEFORE UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW EXECUTE FUNCTION forbid_posted_line_change();

  -- ── Guarantee 4: posted headers are immutable except for reversal ─────────
  CREATE OR REPLACE FUNCTION forbid_posted_entry_change()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION
          'A posted journal entry cannot be deleted (entry %, status %). Correct by reversing entry.',
          OLD.id, OLD.status
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN OLD;
    END IF;

    -- A draft may still be freely edited.
    IF OLD.status = 'draft' THEN
      RETURN NEW;
    END IF;

    -- Already reversed: the entry is closed history.
    IF OLD.status = 'reversed' THEN
      RAISE EXCEPTION
        'A reversed journal entry cannot be modified (entry %)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Posted: the ONLY permitted transition is to 'reversed', and nothing that
    -- identifies or values the entry may move with it.
    IF NEW.status <> 'reversed' THEN
      RAISE EXCEPTION
        'A posted journal entry is immutable (entry %). Correct by reversing entry.',
        OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.entry_number   IS DISTINCT FROM OLD.entry_number
    OR NEW.entry_date     IS DISTINCT FROM OLD.entry_date
    OR NEW.journal_id     IS DISTINCT FROM OLD.journal_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.source_type    IS DISTINCT FROM OLD.source_type
    OR NEW.source_id      IS DISTINCT FROM OLD.source_id
    OR NEW.posted_at      IS DISTINCT FROM OLD.posted_at THEN
      RAISE EXCEPTION
        'A posted journal entry cannot be renumbered, redated or rejournalled (entry %)',
        OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
  CREATE TRIGGER trg_journal_entries_immutable
    BEFORE UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_posted_entry_change();
`;

const DOWN = `
  DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
  DROP TRIGGER IF EXISTS trg_journal_entry_lines_immutable ON journal_entry_lines;
  DROP TRIGGER IF EXISTS trg_journal_entries_balanced ON journal_entries;
  DROP TRIGGER IF EXISTS trg_journal_entry_lines_balanced ON journal_entry_lines;

  DROP FUNCTION IF EXISTS forbid_posted_entry_change();
  DROP FUNCTION IF EXISTS forbid_posted_line_change();
  DROP FUNCTION IF EXISTS assert_journal_entry_header_balanced();
  DROP FUNCTION IF EXISTS assert_journal_entry_balanced();
`;

module.exports = { name: '028_ledger_integrity_triggers', up: UP, down: DOWN };
