// Shopping catalog intelligence — pure, framework-free. Shared by the
// server service (auto-suggest on write) and the client (live preview).
// Phase1-Shopping (W20 v2).

export type ItemCategory =
  | 'Produce'
  | 'Dairy'
  | 'Meat'
  | 'Pantry'
  | 'Frozen'
  | 'Household'
  | 'Other';

export const CATEGORIES: ItemCategory[] = [
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Frozen',
  'Household',
  'Other',
];

/** Store-aisle order — the board renders category groups in this order. */
export const CATEGORY_ORDER: ItemCategory[] = CATEGORIES;

const CATEGORY_EMOJI: Record<ItemCategory, string> = {
  Produce: '🥬',
  Dairy: '🥛',
  Meat: '🍗',
  Pantry: '🫙',
  Frozen: '🧊',
  Household: '🧽',
  Other: '📦',
};

export function categoryEmoji(cat: ItemCategory): string {
  return CATEGORY_EMOJI[cat];
}

/* ------------------------------------------------------------------ */
/* category auto-suggest                                               */
/* ------------------------------------------------------------------ */

interface CategoryRule {
  category: ItemCategory;
  /** Multi-word phrases — checked before single words. */
  phrases: string[];
  /** Whole-word matches. */
  words: string[];
}

// Order = precedence. Frozen first so "ice cream" doesn't land in Dairy;
// Pantry's "canned"/"dried" modifiers beat Produce's generic words.
const RULES: CategoryRule[] = [
  {
    category: 'Frozen',
    phrases: ['ice cream', 'frozen pizza', 'frozen waffle', 'frozen fruit', 'frozen veg'],
    words: [
      'frozen', 'pizza', 'popsicle', 'gelato', 'sorbet', 'waffle', 'dumpling',
      'potsticker', 'taquito', 'burrito',
    ],
  },
  {
    category: 'Dairy',
    phrases: [
      'sour cream', 'cream cheese', 'cottage cheese', 'half and half', 'whipped cream',
      'string cheese', 'mac and cheese',
    ],
    words: [
      'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'mozzarella',
      'cheddar', 'parmesan', 'gouda', 'brie', 'feta', 'ricotta', 'kefir', 'eggnog',
      'egg', 'eggs',
    ],
  },
  {
    category: 'Meat',
    phrases: ['ground beef', 'ground turkey', 'hot dog', 'deli meat', 'lunch meat'],
    words: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'steak',
      'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'seafood', 'tilapia',
      'cod', 'pepperoni', 'salami', 'ribs', 'lamb', 'veal', 'duck', 'chorizo',
      'meatball', 'wing', 'tender',
    ],
  },
  {
    category: 'Produce',
    phrases: [
      'bell pepper', 'green beans', 'brussels sprouts', 'sweet potato', 'red onion',
      'green onion', 'spring mix',
    ],
    words: [
      'apple', 'banana', 'orange', 'lemon', 'lime', 'lettuce', 'spinach', 'kale',
      'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'avocado', 'berry',
      'berries', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'grape',
      'peach', 'pear', 'plum', 'melon', 'watermelon', 'pineapple', 'mango', 'kiwi',
      'cucumber', 'celery', 'pepper', 'mushroom', 'garlic', 'ginger', 'corn',
      'pea', 'cabbage', 'cauliflower', 'zucchini', 'squash', 'asparagus', 'cilantro',
      'basil', 'parsley', 'mint', 'dill', 'rosemary', 'thyme', 'salad', 'slaw',
      'fruit', 'veggie', 'vegetable', 'herb', 'produce', 'cherry', 'apricot',
      'nectarine', 'papaya', 'coconut', 'date', 'fig', 'olive',
    ],
  },
  {
    category: 'Pantry',
    phrases: [
      'peanut butter', 'almond butter', 'olive oil', 'black pepper', 'pancake mix',
      'baking soda', 'baking powder', 'mac and cheese', 'canned beans', 'dried beans',
      'soy sauce', 'hot sauce', 'bbq sauce',
    ],
    words: [
      'bread', 'rice', 'pasta', 'spaghetti', 'macaroni', 'flour', 'sugar', 'salt',
      'oil', 'vinegar', 'cereal', 'oatmeal', 'oats', 'granola', 'jelly', 'jam',
      'honey', 'syrup', 'coffee', 'tea', 'soup', 'broth', 'stock', 'sauce',
      'ketchup', 'mustard', 'mayo', 'mayonnaise', 'salsa', 'spice', 'seasoning',
      'cracker', 'chips', 'tortilla', 'wrap', 'baking', 'yeast', 'chocolate',
      'cocoa', 'nuts', 'almond', 'peanut', 'cashew', 'walnut', 'pecan', 'canned',
      'dried', 'lentil', 'quinoa', 'couscous', 'breadcrumb', 'marinade', 'dressing',
      'pickle', 'tahini', 'noodle', 'ramen',
    ],
  },
  {
    category: 'Household',
    phrases: [
      'paper towel', 'toilet paper', 'trash bag', 'garbage bag', 'dish soap',
      'hand soap', 'dryer sheet', 'fabric softener', 'light bulb', 'air freshener',
      'plastic wrap',
    ],
    words: [
      'napkin', 'tissue', 'soap', 'detergent', 'laundry', 'cleaning', 'cleaner',
      'disinfect', 'bleach', 'wipes', 'sponge', 'mop', 'broom', 'shampoo',
      'conditioner', 'toothpaste', 'toothbrush', 'deodorant', 'razor', 'lotion',
      'sunscreen', 'bandage', 'battery', 'batteries', 'candle', 'ziploc', 'foil',
      'parchment',
    ],
  },
];

const WORD_RE = /[a-z0-9&]+/g;

/** Suggest a store-section category from an item name. Pure + total. */
export function suggestCategory(rawName: string): ItemCategory {
  const name = rawName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!name) return 'Other';
  const words = new Set(name.match(WORD_RE) ?? []);
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (name.includes(phrase)) return rule.category;
    }
    for (const word of rule.words) {
      if (words.has(word)) return rule.category;
    }
  }
  return 'Other';
}

/* ------------------------------------------------------------------ */
/* smart quick-add parsing: "2 gallons milk" → { qty 2, unit "gal", … } */
/* ------------------------------------------------------------------ */

const UNIT_ALIASES: Record<string, string> = {
  gallon: 'gal', gallons: 'gal', gal: 'gal', gals: 'gal',
  quart: 'qt', quarts: 'qt', qt: 'qt',
  pint: 'pt', pints: 'pt', pt: 'pt',
  liter: 'L', liters: 'L', litre: 'L', litres: 'L', l: 'L',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', kg: 'kg',
  pack: 'pk', packs: 'pk', pk: 'pk', pks: 'pk',
  box: 'box', boxes: 'box',
  can: 'can', cans: 'can',
  bottle: 'bottle', bottles: 'bottle',
  bag: 'bag', bags: 'bag',
  bunch: 'bunch', bunches: 'bunch',
  dozen: 'dozen',
  slice: 'slice', slices: 'slice',
  clove: 'clove', cloves: 'clove',
  stick: 'stick', sticks: 'stick',
  jar: 'jar', jars: 'jar',
  tub: 'tub', tubs: 'tub',
  container: 'ctn', containers: 'ctn',
  loaf: 'loaf', loaves: 'loaf',
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5,
};

function parseQtyToken(token: string): number | null {
  const t = token.toLowerCase();
  if (NUMBER_WORDS[t] != null) return NUMBER_WORDS[t];
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  const num = Number(t);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export interface ParsedAdd {
  quantity: number;
  unit: string | null;
  name: string;
  category: ItemCategory;
}

/**
 * Parse a quick-add line. Handles "2 gallons milk", "a dozen eggs",
 * "1/2 lb butter", "3x granola bars", and plain "milk" (→ qty 1).
 * Anything unparseable degrades to the raw text as the name.
 */
export function parseQuickAdd(raw: string): ParsedAdd {
  const text = raw.trim().replace(/\s+/g, ' ');
  const fallback = (): ParsedAdd => ({
    quantity: 1,
    unit: null,
    name: text,
    category: suggestCategory(text),
  });
  if (!text) return fallback();

  // "3x granola bars" / "3 x granola bars"
  const xMatch = text.match(/^(\d+(?:\.\d+)?)\s*[x×]\s+(.+)$/i);
  if (xMatch) {
    const name = xMatch[2].trim();
    return { quantity: Number(xMatch[1]), unit: null, name, category: suggestCategory(name) };
  }

  const tokens = text.split(' ');
  const qty = parseQtyToken(tokens[0]);
  if (qty == null) return fallback();
  let idx = 1;
  let unit: string | null = null;
  // "2 gallons of milk" — swallow a stray "of"
  const maybeUnit = (tokens[idx] ?? '').toLowerCase();
  if (UNIT_ALIASES[maybeUnit]) {
    unit = UNIT_ALIASES[maybeUnit];
    idx += 1;
  }
  if ((tokens[idx] ?? '').toLowerCase() === 'of') idx += 1;
  const name = tokens.slice(idx).join(' ').trim();
  if (!name) return fallback();
  return { quantity: qty, unit, name, category: suggestCategory(name) };
}

/** Display name — names are stored normalized lowercase; Title Case them. */
export function displayName(normalized: string): string {
  return normalized
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
