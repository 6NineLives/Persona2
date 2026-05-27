/** Shared Sunny Day yellow dress listing (carousel item 1 + yellow-dress trigger) */
export const YELLOW_DRESS_ITEM = {
  title: "Sunny Day Yellow Wrap Dress",
  price: "₱1,890.00",
  description:
    "Light, breathable, and perfect for sunny mall days or weekend coffee runs. Adjustable wrap fit and pockets so you can stay comfy while you shop.",
};

/** Product catalog for voice-triggered offer sidebar */
export const PRODUCT_CATALOG = {
  "yellow-dress": {
    tag: "Recommended for you",
    items: [
      {
        ...YELLOW_DRESS_ITEM,
        image: "/output/704850246_4315650588708485_9096660679281236525_n.jpg",
      },
    ],
  },
  dress: {
    tag: "Dresses for you",
    items: [
      {
        ...YELLOW_DRESS_ITEM,
        image: "/output/dresses/dress%201.jpg",
      },
      {
        title: "Floral Day Dress",
        price: "₱2,190.00",
        description:
          "Soft fabric and a breezy cut made for warm afternoons. Pair with sandals and a tote for your next coffee-and-shopping run.",
        image: "/output/dresses/dress%202.jpg",
      },
      {
        title: "Evening Slip Dress",
        price: "₱2,890.00",
        description:
          "Sleek and minimal with a smooth drape—ideal when you want something dressy without feeling overdressed.",
        image: "/output/dresses/dress%203.jpg",
      },
    ],
  },
  hoodie: {
    tag: "Hoodies for you",
    items: [
      {
        title: "Essential Pullover Hoodie",
        price: "₱1,290.00",
        description:
          "Cozy fleece inside, clean shape outside—your go-to layer for AC-heavy malls and late-night food runs.",
        image: "/output/hoodie/hoodie%201.jpg",
      },
      {
        title: "Streetwear Zip Hoodie",
        price: "₱1,590.00",
        description:
          "Relaxed fit with a full zip so you can layer fast. Works with joggers, denim, or over a gym tee.",
        image: "/output/hoodie/hoodie%202.jpg",
      },
      {
        title: "Oversized Cozy Hoodie",
        price: "₱1,790.00",
        description:
          "Extra room for comfort without looking sloppy—soft, warm, and built for all-day wear.",
        image: "/output/hoodie/hoodie%203.jpg",
      },
    ],
  },
};

export const YELLOW_DRESS_REPLY =
  "Perfect—you want the Sunny Day Yellow Wrap Dress. Since you were just browsing the dress picks, this is the one at ₱1,890: light, breathable, with that easy wrap fit. What size should I put you in, or should I add it to your cart now?";

/** Match order matters: yellow dress before dress */
export function detectProductTrigger(text) {
  const normalized = text.toLowerCase();
  if (/\byellow\s+dress\b/.test(normalized)) return "yellow-dress";
  if (/\bhoodie\b/.test(normalized)) return "hoodie";
  if (/\bdress\b/.test(normalized)) return "dress";
  return null;
}
