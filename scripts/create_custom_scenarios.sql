-- Run this in your Supabase SQL editor (https://supabase.com/dashboard/project/dpkjznxwcpvqwubolsqy/sql)

CREATE TABLE IF NOT EXISTS public.custom_scenarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id        UUID NOT NULL,
  learner_id          UUID,
  title               TEXT NOT NULL,
  description         TEXT DEFAULT '',
  support_level       TEXT DEFAULT 'Moderate',
  mode_access         TEXT[] DEFAULT ARRAY['Learning Mode'],
  hint_level          TEXT DEFAULT 'Gentle nudge',
  npc_personality     TEXT DEFAULT 'Friendly',
  unpredictable_events TEXT DEFAULT 'Off',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_scenarios ENABLE ROW LEVEL SECURITY;

-- Allow therapists to manage their own scenarios
CREATE POLICY "therapists_manage_own_scenarios"
  ON public.custom_scenarios
  FOR ALL
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- Allow learners to read scenarios assigned to them
CREATE POLICY "learners_read_assigned_scenarios"
  ON public.custom_scenarios
  FOR SELECT
  USING (learner_id = auth.uid());
