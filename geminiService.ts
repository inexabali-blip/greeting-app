import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GenerateRequest, Gender, Relationship, Holiday } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to check API Key
export const hasApiKey = (): boolean => !!apiKey;

// --- PROMPT DATA CONSTANTS ---

const AGE_GROUPS = {
  CHILD: { min: 0, max: 12 },
  TEEN: { min: 13, max: 17 },
  YOUNG_ADULT: { min: 18, max: 30 },
  ADULT: { min: 31, max: 55 },
  SENIOR: { min: 56, max: 150 }
};

const BASE_PROMPTS = {
  CHILD: "Modern soft-themed greeting card for a child (3–12) — gentle pastel palette, airy lighting, minimalistic playful elements, subtle sparkles, dreamy and warm mood, premium contemporary aesthetic, clean composition.",
  TEEN: "Trendy modern greeting card for a teenager (13–17) — bold refined colors, soft neon accents, abstract geometric minimalism, dynamic lighting, stylish youthful mood, premium contemporary aesthetic.",
  YOUNG_ADULT: "Modern stylish greeting card for a young adult (18–30) — contemporary premium design, clean layout, soft cinematic lighting, abstract minimalistic shapes, confident and fresh aesthetic.",
  ADULT: "Premium modern greeting card for an adult (31–55) — elegant muted palette, sophisticated lighting, refined minimalistic design, calm and confident mood, contemporary luxury aesthetic.",
  SENIOR: "Warm elegant modern greeting card for an older adult (55+) — soft muted colors, gentle light, minimalistic botanical or abstract elements, calm respectful atmosphere, premium contemporary design."
};

const ATTRIBUTES = {
  CHILD: {
    [Gender.FEMALE]: "airy toys, bunny or teddy bear in modern style, pastel balloons, little stars, small crown, butterflies",
    [Gender.MALE]: "minimalist toy cars, airplanes, sports ball, sci-fi glowing lines, small motorcycle icon, cubes"
  },
  TEEN: {
    [Gender.FEMALE]: "headphones, skateboard, smartphone, sports bottle, neon lines, stylish accessories",
    [Gender.MALE]: "skateboard, bmx, roller skates, gaming controllers, headphones, motorcycle silhouette, sports accents, backpack"
  },
  YOUNG_ADULT: {
    [Gender.FEMALE]: "roses, peonies, cosmetics, laptop/tablet, glass of sparkling wine, fashion accessories, travel theme",
    [Gender.MALE]: "motorcycle silhouette, classic watch, car silhouette, glass of whiskey/bourbon, gaming elements, sports attributes"
  },
  ADULT: {
    [Gender.FEMALE]: "red/white roses, jewelry, wellness elements, interior details, business accessories",
    [Gender.MALE]: "cognac/whiskey glass, cigars (premium style), car, watch, cufflinks, office elements"
  },
  SENIOR: {
    [Gender.FEMALE]: "plaid blanket, tea set, lavender, roses, books, cozy lamp",
    [Gender.MALE]: "chess, books, glasses, cane, nature, home comfort"
  }
};

const ROLE_MOODS = {
  [Gender.FEMALE]: {
    'mother': "soft warm lighting, gentle pastel tones, emotional warmth",
    'sister': "youthful dynamic mood, abstract bright accents",
    'colleague': "muted corporate tones, geometric professionalism",
    'friend': "playful stylish gradients, lifestyle vibe",
    'daughter': "dreamy soft palette, tender textures",
    'grandmother': "delicate botanical style, warm atmosphere",
    'loved_one': "romantic soft cinematic light",
    'wife': "refined luxury minimalism",
    'relative': "neutral elegant palette"
  },
  [Gender.MALE]: {
    'grandfather': "noble muted tones, soft lighting",
    'father': "confident minimalism, deep warm shades",
    'brother': "energetic youthful geometry",
    'son': "fresh soft gradients",
    'grandson': "warm family-oriented soft tones",
    'colleague': "sleek business minimalism",
    'friend': "vibrant stylish dynamics",
    'husband': "romantic premium minimalism",
    'loved_one': "intimate warm cinematic style",
    'relative': "neutral understated elegance"
  }
};

const HOLIDAY_CONFIG: Record<string, { basePrompt: string, attributes: string }> = {
  [Holiday.NEW_YEAR]: {
    basePrompt: "Modern elegant New Year greeting card — silver-blue palette, soft glow, minimalistic snowflakes, premium winter aesthetic, bokeh lights, contemporary luxury style.",
    attributes: "cold palette, white, silver, blue, minimalistic snowflakes, soft glow, champagne glasses silhouette, bokeh lights, elegant christmas balls"
  },
  [Holiday.CHRISTMAS]: {
    basePrompt: "Warm modern Christmas greeting card — golden lights, pine branches, soft red-green muted palette, minimalistic gifts, premium cozy holiday aesthetic.",
    attributes: "warm lights, pine branches, pine cones, golden candles, muted red-green palette, minimalistic gift boxes"
  },
  [Holiday.VALENTINES_DAY]: {
    basePrompt: "Modern romantic Valentine’s Day greeting — soft red-pink tones, minimalistic heart shapes, cinematic glow, roses, premium intimate aesthetic.",
    attributes: "soft red-pink tones, minimalistic heart shapes, cinematic glow, roses, abstract neon lines"
  },
  [Holiday.WOMENS_DAY]: {
    basePrompt: "Modern elegant International Women’s Day greeting — pastel floral palette, tulips and mimosa, gold accents, soft spring light, premium feminine minimalism.",
    attributes: "fresh flowers, tulips, mimosa, roses, pastel shades, soft spring forms, gold accents, airy light"
  },
  [Holiday.MENS_DAY]: {
    basePrompt: "Modern masculine greeting card — deep blue-gray palette, sharp geometric minimalism, subtle metallic details, premium contemporary male aesthetic.",
    attributes: "deep blue, graphite, dark gray shades, strict geometric lines, metallic accents, male aesthetic silhouettes (watch, tie)"
  },
  [Holiday.ANNIVERSARY]: {
    basePrompt: "Premium anniversary greeting — black-gold luxury palette, clean numeric elements, metallic accents, elegant minimalistic celebration design.",
    attributes: "black-gold or white-silver palette, large minimalist numbers, metallic textures, solemn tone"
  },
  [Holiday.WEDDING]: {
    basePrompt: "Elegant wedding/anniversary greeting — white-gold palette, minimalist rings, roses, cinematic warm light, premium romantic aesthetic.",
    attributes: "white, cream, gold palette, ring silhouettes, white roses, soft romantic light, candles"
  },
  [Holiday.NEWBORN]: {
    // This will be dynamically overridden if childGender is present
    basePrompt: "Modern newborn celebration card — pastel palette, clouds and stars, soft warm lighting, minimalistic baby-themed elements, premium gentle aesthetic.",
    attributes: "pastel tones, soft forms, clouds, stars, minimalistic baby symbols, calm light"
  },
  [Holiday.GRADUATION]: {
    basePrompt: "Modern graduation greeting — minimalistic academic cap, gold accents, clean geometric shapes, premium success aesthetic.",
    attributes: "academic cap, gold lines, certificate icon, feeling of achievement"
  },
  [Holiday.PROMOTION]: {
    basePrompt: "Modern promotion greeting — sharp geometric lines, deep business palette, minimal growth graph, sleek professional luxury aesthetic.",
    attributes: "business palette (blue, graphite), strict geometric lines, minimal growth graph, premium office accents"
  },
  [Holiday.NEW_PROJECT]: {
    basePrompt: "Modern business launch greeting — clean minimalistic tech elements, growth lines, soft glow, contemporary innovative aesthetic.",
    attributes: "laptop/tablet, growth graphics, bright energy accents, 'new beginning' elements"
  }
};

// --- LOGIC ---

export const generateGreetingText = async (data: GenerateRequest): Promise<string> => {
  if (!hasApiKey()) throw new Error("API Key is missing");

  // Logic to refine relationship terms (e.g. Mom/Dad)
  let relationshipContext = data.relationship as string;
  if (data.relationship === Relationship.PARENT) {
    if (data.gender === Gender.FEMALE) {
      relationshipContext = "Мама (Мамочка)";
    } else if (data.gender === Gender.MALE) {
      relationshipContext = "Папа";
    }
  } else if (data.relationship === Relationship.GRANDPARENT) {
    if (data.gender === Gender.FEMALE) {
      relationshipContext = "Бабушка";
    } else if (data.gender === Gender.MALE) {
      relationshipContext = "Дедушка";
    }
  }

  let holidayContext = data.holiday === Holiday.BIRTHDAY 
    ? `День рождения (Возраст: ${data.age})` 
    : data.holiday;

  // Enhance context for NEWBORN with Child Gender
  if (data.holiday === Holiday.NEWBORN && data.childGender) {
      holidayContext = `Рождение ребенка (Пол ребенка: ${data.childGender}). Поздравь с рождением ${data.childGender === Gender.MALE ? 'сына/мальчика' : 'дочери/девочки'}!`;
  }

  const prompt = `
    Задача: Напиши поздравление.
    Праздник: ${holidayContext}.
    Кому: ${relationshipContext}, Имя: ${data.name}, Пол: ${data.gender}.
    Требования:
    - Длина: 3-4 предложения.
    - Стиль: Душевный, теплый, с использованием подходящих эмодзи.
    - СТРОГО БЕЗ заголовков типа "Поздравительная открытка", "Текст поздравления".
    - Сразу начинай с поздравления.
    - Обращайся лично на "Ты" или "Вы" в зависимости от статуса (Маме/Папе/Другу на ты, Коллеге на Вы, Бабушке/Дедушке на Вы или Ты по контексту теплоты).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
    });
    const text = response.text?.trim();
    if (!text) return `С праздником: ${data.holiday}! Желаю счастья и радости!`;
    
    // Clean up if model adds quotes or markdown
    return text.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error("Text generation error:", error);
    throw error;
  }
};

const getAgeKey = (age: number): keyof typeof AGE_GROUPS => {
  if (age <= 12) return 'CHILD';
  if (age <= 17) return 'TEEN';
  if (age <= 30) return 'YOUNG_ADULT';
  if (age <= 55) return 'ADULT';
  return 'SENIOR';
};

const mapRelationshipToKey = (rel: string, gender: Gender): string => {
  switch (rel) {
    case Relationship.PARENT:
      return gender === Gender.MALE ? 'father' : 'mother';
    case Relationship.CHILD:
      return gender === Gender.MALE ? 'son' : 'daughter';
    case Relationship.GRANDPARENT:
      return gender === Gender.MALE ? 'grandfather' : 'grandmother';
    case Relationship.GRANDCHILD:
      return gender === Gender.MALE ? 'grandson' : 'daughter'; // Map granddaughter to daughter mood as fallback
    case Relationship.PARTNER:
      return gender === Gender.MALE ? 'husband' : 'wife'; 
    case Relationship.FRIEND:
      return 'friend';
    case Relationship.COLLEAGUE:
      return 'colleague';
    default:
      return 'relative';
  }
};

export const generateGreetingImage = async (data: GenerateRequest): Promise<string> => {
  if (!hasApiKey()) throw new Error("API Key is missing");

  // 1. Setup common role mood
  const roleKey = mapRelationshipToKey(data.relationship, data.gender);
  // @ts-ignore
  const roleMood = ROLE_MOODS[data.gender][roleKey] || (data.gender === Gender.MALE ? "neutral understated elegance" : "neutral elegant palette");
  
  let finalPrompt = '';

  // 2. Logic Branch: Birthday vs Other Holidays
  if (data.holiday === Holiday.BIRTHDAY) {
      const ageKey = getAgeKey(data.age);
      const basePrompt = BASE_PROMPTS[ageKey];
      const attributes = ATTRIBUTES[ageKey][data.gender];
      
      finalPrompt = `
        High quality 3D render of a Birthday Greeting Card.
        Style Description: ${basePrompt}
        Mood & Atmosphere: ${roleMood}
        Key Elements (Artistic Composition): ${attributes}, birthday cake, festive atmosphere.
        
        CRITICAL RESTRICTIONS:
        - NO PEOPLE, NO HUMANS, NO FACES.
        - NO TEXT, NO LETTERS, NO WRITING on the card.
        - Purely aesthetic still life composition.
        - 8k resolution, cinematic lighting, photorealistic 3D render.
        - Aspect Ratio: 1:1.
      `;
  } else {
      // Logic for International Holidays
      const holidayConfig = HOLIDAY_CONFIG[data.holiday];
      
      if (!holidayConfig) {
          // Fallback if holiday not found
          finalPrompt = `Beautiful greeting card for ${data.holiday}, festive, elegant, no text, no people.`;
      } else {
          
          let attributes = holidayConfig.attributes;
          let basePrompt = holidayConfig.basePrompt;

          // Special logic for NEWBORN gender
          if (data.holiday === Holiday.NEWBORN && data.childGender) {
              if (data.childGender === Gender.MALE) {
                  attributes = "baby boy aesthetic, soft blue, white, beige palette, minimalist clouds, tiny stars, cute bear";
                  basePrompt = basePrompt.replace("pastel palette", "soft blue and beige palette");
              } else {
                  attributes = "baby girl aesthetic, soft pink, peach, cream palette, flowers, butterflies, tiny heart";
                  basePrompt = basePrompt.replace("pastel palette", "soft pink and peach palette");
              }
          }

          finalPrompt = `
            High quality 3D render of a ${data.holiday} Greeting Card.
            Style Description: ${basePrompt}
            Mood & Atmosphere: ${roleMood}
            Key Elements: ${attributes}.
            
            CRITICAL RESTRICTIONS:
            - NO PEOPLE, NO HUMANS, NO FACES.
            - NO TEXT, NO LETTERS, NO WRITING on the card.
            - Purely aesthetic still life composition.
            - 8k resolution, cinematic lighting, photorealistic 3D render.
            - Aspect Ratio: 1:1.
          `;
      }
  }

  // Fallback prompt remains simple just in case complex prompt triggers safety filters heavily
  const safeFallbackPrompt = `
    A beautiful 3D greeting card composition for ${data.holiday}.
    Festive elements, elegant background.
    Bright and happy colors.
    No people, no text.
    High quality, cinematic lighting.
  `;

  try {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: finalPrompt }] },
      });
      return extractImageFromResponse(response);
    } catch (primaryError) {
      console.warn("Primary image generation failed (likely safety), trying fallback...", primaryError);
      
      // Retry with safe prompt
      const fallbackResponse: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: safeFallbackPrompt }] },
      });
      return extractImageFromResponse(fallbackResponse);
    }
  } catch (finalError) {
    console.error("All image generation attempts failed:", finalError);
    throw new Error("Не удалось создать изображение. Попробуйте снова.");
  }
};

const extractImageFromResponse = (response: GenerateContentResponse): string => {
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("No image data in response");
};