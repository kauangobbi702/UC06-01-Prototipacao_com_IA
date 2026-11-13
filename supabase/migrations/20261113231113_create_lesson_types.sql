/*
# Create lesson_types table

Stores the kinds of English lessons the teacher offers (name, duration and price).
Students and the teacher read the same list, so the table is shared data.

1. New Tables
- `lesson_types`
  - `id` (uuid, primary key, generated automatically)
  - `name` (text, required, at least 3 visible characters)
  - `duration_minutes` (integer, required, between 15 and 120)
  - `price_cents` (integer, required, greater than 0; stored in cents, e.g. R$ 90,00 = 9000)
  - `created_at` (timestamp, defaults to now)

2. Security
- Row Level Security is enabled on `lesson_types`.
- The app has no sign-in screen, so the anon and authenticated roles are granted SELECT and INSERT only.
- Policies allow reading and creating lesson types. There is no update or delete path yet, so those verbs are not granted.

3. Important Notes
- The table has no owner column because the app is single-tenant without accounts.
- The CHECK constraints enforce the same rules as the form, so invalid rows cannot be saved even if the browser is bypassed.
*/

CREATE TABLE IF NOT EXISTS lesson_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) >= 3),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 120),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lesson_types ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON lesson_types TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_lesson_types" ON lesson_types;
CREATE POLICY "anon_select_lesson_types" ON lesson_types FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lesson_types" ON lesson_types;
CREATE POLICY "anon_insert_lesson_types" ON lesson_types FOR INSERT
  TO anon, authenticated WITH CHECK (true);
