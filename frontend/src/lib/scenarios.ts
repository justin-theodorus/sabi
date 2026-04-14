export interface ScenarioIcon {
  id: string
  label: string
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
}

/**
 * Fetches active custom scenarios from Supabase and merges with hardcoded SCENARIOS.
 * DB rows with the same slug as a hardcoded scenario override the hardcoded entry.
 */
export async function fetchScenariosFromDB(): Promise<Record<string, ScenarioConfig>> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, slug, description, npc_name, npc_greeting, npc_path, npc_background_url, scenario_icons')
    .eq('is_active', true)

  if (error || !data) return SCENARIOS

  const merged: Record<string, ScenarioConfig> = { ...SCENARIOS }

  for (const row of data as DBScenarioRow[]) {
    const key = row.slug ?? row.id
    merged[key] = {
      id: key,
      dbId: row.id,
      title: row.name,
      description: row.description ?? '',
      background: row.npc_background_url ?? '/backgrounds/hawker-centre.jpg',
      npc: row.npc_path ?? '/npc/hawker-uncle.png',
      npcName: row.npc_name ?? 'NPC',
      npcGreeting: row.npc_greeting ?? 'Hello! How can I help you?',
      scenarioIcons: row.scenario_icons ?? [],
    }
  }

  return merged
}
