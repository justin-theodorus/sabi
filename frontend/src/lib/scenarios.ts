export interface ScenarioIcon {
  id: string
  label: string
}

export interface ScenarioEvent {
  id: string
  npcLine: string   // what the NPC says when the event fires (shown in IntruderBubble)
  context: string   // brief context string passed to dialogue engine as active_event
}

export interface ScenarioConfig {
  id: string
  dbId: string          // UUID from Supabase scenarios table
  title: string
  description: string
  background: string
  npc: string
  npcName: string
  npcGreeting: string
  scenarioIcons: ScenarioIcon[]
  events: ScenarioEvent[]
  // Custom scenario fields (set when scenario originates from DB)
  baseScenario?: string   // one of: hawker_centre | group_project | queue_shop
  npcPersonality?: string // Friendly | Impatient | Confused
  supportLevel?: string   // High | Moderate | Low | Independent
  hintLevel?: string      // No hints | Gentle nudge | Full guidance
}

// These dbIds match what was seeded in the Supabase scenarios table
export const SCENARIOS: Record<string, ScenarioConfig> = {
  hawker_centre: {
    id: 'hawker_centre',
    dbId: 'fe9da364-1de6-48fd-a87f-250774df0f2b',
    title: 'Hawker Centre',
    description: 'Order food at a local hawker stall',
    background: '/backgrounds/hawker-centre.jpg',
    npc: '/npc/hawker-uncle.png',
    npcName: 'Uncle Beng',
    npcGreeting: 'Hello! Welcome to my stall. What would you like today?',
    scenarioIcons: [
      { id: 'chicken-rice', label: 'chicken rice' },
      { id: 'chicken', label: 'chicken' },
      { id: 'rice', label: 'rice' },
      { id: 'noodle', label: 'noodle' },
      { id: 'wonton', label: 'wonton' },
      { id: 'drink', label: 'drink' },
      { id: 'water', label: 'water' },
      { id: 'tea', label: 'tea' },
      { id: 'food', label: 'food' },
      { id: 'eat', label: 'eat' },
      { id: 'hot', label: 'hot' },
      { id: 'cold', label: 'cold' },
      { id: 'spicy', label: 'spicy' },
      { id: 'one', label: 'one' },
      { id: 'two', label: 'two' },
      { id: 'how-much', label: 'how much' },
      { id: 'takeaway', label: 'takeaway' },
    ],
    events: [
      {
        id: 'queue_cutter',
        npcLine: '*Another customer pushes in and shouts their order!*',
        context: 'A rude customer just jumped the queue and is trying to order ahead of the learner. The uncle looks flustered. The learner may want to speak up or wait.',
      },
      {
        id: 'ingredient_shortage',
        npcLine: 'Aiyah, sorry ah — today no more chicken already!',
        context: 'The uncle just announced they have run out of chicken. The learner needs to choose an alternative dish.',
      },
    ],
  },
  group_project: {
    id: 'group_project',
    dbId: '1f0930f9-1c48-4ec8-abff-93fba2845800',
    title: 'Group Project',
    description: 'Collaborate with classmates on a school project',
    background: '/backgrounds/group-project.jpg',
    npc: '/npc/classmate.png',
    npcName: 'Classmate',
    npcGreeting: "Hey! Let's work on our project. What should we do first?",
    scenarioIcons: [
      { id: 'write', label: 'write' },
      { id: 'draw', label: 'draw' },
      { id: 'present', label: 'present' },
      { id: 'research', label: 'research' },
      { id: 'done', label: 'done' },
      { id: 'ready', label: 'ready' },
      { id: 'idea', label: 'idea' },
      { id: 'agree', label: 'agree' },
      { id: 'disagree', label: 'disagree' },
      { id: 'together', label: 'together' },
      { id: 'share', label: 'share' },
      { id: 'my-turn', label: 'my turn' },
      { id: 'leader', label: 'leader' },
      { id: 'team', label: 'team' },
    ],
    events: [
      {
        id: 'teacher_drops_by',
        npcLine: '*Teacher walks over and asks how the project is going!*',
        context: 'The teacher has just approached the group and is asking for a quick progress update. The learner may want to summarise what they have done.',
      },
      {
        id: 'presentation_deadline',
        npcLine: 'Oh no — the teacher moved our presentation to tomorrow!',
        context: 'The classmate just found out the presentation deadline has been brought forward to tomorrow. The group needs to decide what to prioritise.',
      },
    ],
  },
  queue_shop: {
    id: 'queue_shop',
    dbId: '',  // inserted in migration, fetch from DB if needed
    title: 'Queue / Shop',
    description: 'Confront someone who cut in front of you in a queue',
    background: '/backgrounds/queue-shop.jpg',
    npc: '/npc/shop-assistant.png',
    npcName: 'Queue Cutter',
    npcGreeting: "*pushes in front of you in the queue*",
    scenarioIcons: [
      { id: 'stop', label: 'stop' },
      { id: 'wait', label: 'wait' },
      { id: 'not', label: 'not' },
      { id: 'go', label: 'go back' },
      { id: 'i', label: 'I' },
      { id: 'you', label: 'you' },
      { id: 'first', label: 'first' },
      { id: 'wrong', label: 'wrong' },
      { id: 'excuse-me', label: 'excuse me' },
      { id: 'my-turn', label: 'my turn' },
      { id: 'help', label: 'help' },
    ],
    events: [
      {
        id: 'security_arrives',
        npcLine: '*A security guard walks over and is watching!*',
        context: 'A mall security guard has appeared nearby and is observing the situation. The queue cutter looks nervous. The learner may use this as leverage or de-escalate.',
      },
      {
        id: 'bystander_helps',
        npcLine: '*Someone behind you says "Eh, he cut queue lah!"*',
        context: 'A bystander in the queue is backing the learner up by calling out the queue cutter. The learner can use this support to speak up more confidently.',
      },
    ],
  },
  home_family: {
    id: 'home_family',
    dbId: '',
    title: 'Home / Family',
    description: 'Decide what to eat for lunch with a family member',
    background: '/backgrounds/home-family.jpg',
    npc: '/npc/family-member.png',
    npcName: 'Family Member',
    npcGreeting: "I'm making lunch! What do you want to eat today?",
    scenarioIcons: [
      { id: 'rice', label: 'rice' },
      { id: 'noodle', label: 'noodles' },
      { id: 'bread', label: 'bread' },
      { id: 'egg', label: 'egg' },
      { id: 'chicken', label: 'chicken' },
      { id: 'vegetable', label: 'vegetables' },
      { id: 'soup', label: 'soup' },
      { id: 'hot', label: 'hot' },
      { id: 'cold', label: 'cold' },
      { id: 'spicy', label: 'spicy' },
      { id: 'more', label: 'more' },
      { id: 'enough', label: 'enough' },
    ],
    events: [
      {
        id: 'phone_rings',
        npcLine: '*Family member gets a phone call and steps away briefly!*',
        context: 'The family member just received a phone call and has briefly stepped away. The learner has a moment alone before they return — and may need to repeat their request.',
      },
      {
        id: 'unexpected_guest',
        npcLine: 'Wah, your cousin coming over later also — cook extra or not?',
        context: 'A cousin is unexpectedly coming over for lunch. The family member is asking whether to cook more food. The learner needs to weigh in on the decision.',
      },
    ],
  },
}

export const SCENARIO_LIST = Object.values(SCENARIOS)

// ── DB fetch (merges custom scenarios from Supabase) ─────────────────────────

import { supabase } from '@/lib/supabase'

interface DBScenarioRow {
  id: string
  name: string
  slug: string | null
  description: string | null
  npc_name: string | null
  npc_greeting: string | null
  npc_path: string | null
  npc_background_url: string | null
  scenario_icons: Array<{ id: string; label: string }> | null
  base_scenario: string
  npc_personality: string | null
  support_level: string | null
  hint_level: string | null
}

/**
 * Fetches active custom scenarios from Supabase and merges with hardcoded SCENARIOS.
 * Custom scenarios inherit assets and events from their base_scenario, overriding
 * only the fields explicitly set by the therapist.
 * Base scenarios themselves are not overridden by DB rows — hardcoded entries win
 * for the 3 built-in slugs (hawker_centre, group_project, queue_shop).
 */
export async function fetchScenariosFromDB(): Promise<Record<string, ScenarioConfig>> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, slug, description, npc_name, npc_greeting, npc_path, npc_background_url, scenario_icons, base_scenario, npc_personality, support_level, hint_level')
    .eq('is_active', true)

  if (error || !data) return SCENARIOS

  const merged: Record<string, ScenarioConfig> = { ...SCENARIOS }
  const BASE_IDS = new Set(Object.keys(SCENARIOS))

  for (const row of data as DBScenarioRow[]) {
    const key = row.slug ?? row.id
    // Never overwrite a hardcoded base scenario
    if (BASE_IDS.has(key)) continue

    const base = SCENARIOS[row.base_scenario] ?? SCENARIOS.hawker_centre

    merged[key] = {
      id: key,
      dbId: row.id,
      title: row.name,
      description: row.description ?? base.description,
      // Inherit background + NPC from base unless therapist set a real image path
      // (npc_path is overloaded in session-service to also store unpredictableEvents,
      //  so we only trust it if it looks like an actual path starting with '/')
      background: row.npc_background_url?.trim() || base.background,
      npc: (row.npc_path?.startsWith('/') ? row.npc_path : null) || base.npc,
      npcName: row.npc_name?.trim() || base.npcName,
      npcGreeting: row.npc_greeting?.trim() || base.npcGreeting,
      // Merge: scenario-specific icons from DB first, then fill with base icons
      scenarioIcons: (row.scenario_icons && row.scenario_icons.length > 0)
        ? row.scenario_icons
        : base.scenarioIcons,
      // Always inherit events from base scenario
      events: base.events,
      baseScenario: row.base_scenario,
      npcPersonality: row.npc_personality ?? undefined,
      supportLevel: row.support_level ?? undefined,
      hintLevel: row.hint_level ?? undefined,
    }
  }

  return merged
}
