export type FoodWallPreset = {
  id: string;
  food: string;
  price: string;
  promoMessage: string;
  imageUrl: string;
  custom?: boolean;
};

export const EXTRA_FOOD_PRESET_KEY = "flobama.foodPresets.extra";

export const BUILTIN_FOOD_PRESETS: FoodWallPreset[] = [
  {
    id: "8-smoked-wings",
    food: "8 Smoked Wings",
    price: "13.99",
    promoMessage: "Smoked wings. Good music. Your kind of night.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779420935/menu/prod/5e8503a55711fa000806ef47/rgickzjzebh5ndhhxtxsjri1uu_1779420929742.jpg",
  },
  {
    id: "bbq-nachos",
    food: "BBQ Nachos",
    price: "12.99",
    promoMessage: "Make room for nachos. The next round can wait.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1586186275/menu/prod/5e8503a55711fa000806ef47/1xvqxytcxjchtirtfldxueia2q_1586186268489.jpg",
  },
  {
    id: "breaded-mushrooms",
    food: "Breaded Mushrooms",
    price: "9.99",
    promoMessage: "Give your table something to snack on.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779424973/menu/prod/5e8503a55711fa000806ef47/nrcpsb2nr3gq5baw3m1znwzj12_1779424967669.jpg",
  },
  {
    id: "onion-petals",
    food: "Onion Petals",
    price: "10.50",
    promoMessage: "Order a basket. See how long it lasts.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779425040/menu/prod/5e8503a55711fa000806ef47/sgd0oz3ucjbczl3rqmttxnx3oe_1779425033087.jpg",
  },
  {
    id: "half-chicken-plate",
    food: "1/2 Chicken Plate",
    price: "15.49",
    promoMessage: "Settle in. Supper is calling.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779421087/menu/prod/5e8503a55711fa000806ef47/ymhwokivqzewxfxfaaykrykwgq_1779421032887.jpg",
  },
  {
    id: "chicken-tenders",
    food: "Chicken Tenders",
    price: "12.99",
    promoMessage: "Your next bite is an easy choice.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779422141/menu/prod/5e8503a55711fa000806ef47/hma1dkifpnfwbhjc4tyjajmcfq_1779422129840.jpg",
  },
  {
    id: "large-rib",
    food: "Large Rib",
    price: "22.99",
    promoMessage: "Bring your appetite. Leave happy.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1588440281/menu/prod/5e8503a55711fa000806ef47/ncompb55nfar1jayjzo3vnlesu_1588440276065.jpg",
  },
  {
    id: "pork-plate",
    food: "Pork Plate",
    price: "13.25",
    promoMessage: "Good BBQ belongs in your evening plans.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779425912/menu/prod/5e8503a55711fa000806ef47/zoyef1po5rgitk1bwtv3a1x22u_1779425893427.jpg",
  },
  {
    id: "rib-wing-combo",
    food: "Rib & Wing Combo",
    price: "21.99",
    promoMessage: "Why pick one? Make it a combo.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779425934/menu/prod/5e8503a55711fa000806ef47/45xfskq2nbfuje2bprpq5kdflm_1779425928176.jpg",
  },
  {
    id: "big-cowboy-burger",
    food: "Big Cowboy Burger",
    price: "13.99",
    promoMessage: "Big appetite? Meet your next order.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779420452/menu/prod/5e8503a55711fa000806ef47/1i1px0x1qbhvnnwnm1jsngb1l2_1779420435319.jpg",
  },
  {
    id: "big-bama-dog",
    food: "Big Bama Dog",
    price: "11.79",
    promoMessage: "Go big before the next song.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779427273/menu/prod/5e8503a55711fa000806ef47/mukq40hn4va1bfovsfu2s1a2py_1779427265854.jpg",
  },
  {
    id: "philly-steak",
    food: "Philly Steak and Cheese",
    price: "11.99",
    promoMessage: "Take a break between songs. Grab a Philly.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779427126/menu/prod/5e8503a55711fa000806ef47/n1hlfzi2rjfqdnuywhzoji2uwa_1779427120181.jpg",
  },
  {
    id: "smoked-chicken-quesadilla",
    food: "Smoked Chicken Quesadilla",
    price: "11.99",
    promoMessage: "One more reason to stay for another song.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779422087/menu/prod/5e8503a55711fa000806ef47/cel5tarbeffs3jftycuywvzspm_1779422076879.jpg",
  },
  {
    id: "chicken-salad",
    food: "Chicken Salad",
    price: "11.75",
    promoMessage: "Switch up your usual order tonight.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1586186114/menu/prod/5e8503a55711fa000806ef47/4oyp4ard1nbirofllwqfip3eri_1586186099580.jpg",
  },
  {
    id: "spicy-tender-wrap",
    food: "Spicy Tender Wrap",
    price: "12.49",
    promoMessage: "Give your night a little kick.",
    imageUrl:
      "https://res.cloudinary.com/emaginepos/image/upload/c_fit%2Ch_338%2Cq_90%2Cr_0%2Cw_600/v1779426845/menu/prod/5e8503a55711fa000806ef47/myvqz3pmrzclxi2irmc0xipbzy_1779426836743.jpg",
  },
];

export function formatFoodPrice(price: string) {
  const trimmed = price.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("$")) return trimmed;
  return `$${trimmed}`;
}

export function foodPresetCanvasUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com") {
      return `/api/server-station/food-image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}

export function isFoodPreset(value: unknown): value is FoodWallPreset {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FoodWallPreset>;
  return (
    typeof row.id === "string" &&
    typeof row.food === "string" &&
    typeof row.price === "string" &&
    typeof row.promoMessage === "string" &&
    typeof row.imageUrl === "string" &&
    row.food.trim().length > 0
  );
}

export function readExtraFoodPresets() {
  if (typeof window === "undefined") return [] as FoodWallPreset[];
  try {
    const raw = JSON.parse(window.localStorage.getItem(EXTRA_FOOD_PRESET_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(isFoodPreset).map((preset) => ({ ...preset, custom: true }));
  } catch {
    return [];
  }
}

export function writeExtraFoodPresets(presets: FoodWallPreset[]) {
  const next = presets.filter(isFoodPreset).slice(0, 24);
  window.localStorage.setItem(EXTRA_FOOD_PRESET_KEY, JSON.stringify(next));
  return next;
}
