import type { PreviewLook } from "@/types/look";

export const editorialHero = require("../../assets/editorial/hero.jpg");

// Explicitly temporary UI fixtures. Never use these as user-owned wardrobe records.
export const previewLooks: readonly PreviewLook[] = [
  {
    id: "tailored-neutrals",
    title: "Softly tailored",
    occasion: "Coffee & catch-ups",
    savedLabel: "Saved yesterday",
    image: require("../../assets/editorial/tailored.jpg"),
    imageDescription:
      "A relaxed beige blazer styled with light neutral separates.",
    notes:
      "Easy layers and a tonal palette give everyday tailoring a softer side.",
    pieces: [
      "Beige blazer & trousers",
      "Black bandeau",
      "Hoop earrings",
      "Black sunglasses",
    ],
  },
  {
    id: "city-layers",
    title: "The city uniform",
    occasion: "A day in the city",
    savedLabel: "Saved on Wednesday",
    image: require("../../assets/editorial/city.jpg"),
    imageDescription: "A dark layered street-style outfit with sunglasses.",
    notes:
      "A soft black knit, patterned tights, and lace-up boots bring a little Parisian spirit to an afternoon out.",
    pieces: [
      "Black knit & mini skirt",
      "Dotted tights",
      "Lace-up boots",
      "Black beret",
      "Sunglasses",
    ],
  },
];
