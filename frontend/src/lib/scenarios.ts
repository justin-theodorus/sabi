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
      { id: 'laksa', label: 'laksa' },
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
    description: 'Buy something at a retail shop',
    background: '/backgrounds/queue-shop.jpg',
    npc: '/npc/shop-assistant.png',
    npcName: 'Shop Assistant',
    npcGreeting: "Hi there! How can I help you today?",
    scenarioIcons: [
      { id: 'buy', label: 'buy' },
      { id: 'pay', label: 'pay' },
      { id: 'price', label: 'price' },
      { id: 'how-much', label: 'how much' },
      { id: 'receipt', label: 'receipt' },
      { id: 'bag', label: 'bag' },
      { id: 'shirt', label: 'shirt' },
      { id: 'shoes', label: 'shoes' },
      { id: 'try', label: 'try' },
      { id: 'too-expensive', label: 'too expensive' },
      { id: 'discount', label: 'discount' },
      { id: 'color', label: 'color' },
      { id: 'size', label: 'size' },
      { id: 'change', label: 'change' },
    ],
  },
}

export const SCENARIO_LIST = Object.values(SCENARIOS)
