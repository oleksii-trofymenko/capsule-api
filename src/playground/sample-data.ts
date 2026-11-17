/**
 * Fixed sample data for the test chat only. It exists so tool calling can be
 * exercised before the real wardrobe (T07) and occasion library (T10) exist.
 */
export interface SampleItem {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  colour: string;
  formality: 'casual' | 'smart' | 'formal';
  seasons: ('spring' | 'summer' | 'autumn' | 'winter')[];
}

export const sampleWardrobe: SampleItem[] = [
  {
    id: 'w01',
    name: 'White cotton shirt',
    category: 'top',
    colour: 'white',
    formality: 'smart',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
  },
  {
    id: 'w02',
    name: 'Navy merino crew-neck jumper',
    category: 'top',
    colour: 'navy',
    formality: 'smart',
    seasons: ['autumn', 'winter'],
  },
  {
    id: 'w03',
    name: 'Grey marl t-shirt',
    category: 'top',
    colour: 'grey',
    formality: 'casual',
    seasons: ['spring', 'summer'],
  },
  {
    id: 'w04',
    name: 'Striped linen shirt',
    category: 'top',
    colour: 'blue and white',
    formality: 'casual',
    seasons: ['spring', 'summer'],
  },
  {
    id: 'w05',
    name: 'Dark indigo straight jeans',
    category: 'bottom',
    colour: 'indigo',
    formality: 'casual',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
  },
  {
    id: 'w06',
    name: 'Charcoal wool trousers',
    category: 'bottom',
    colour: 'charcoal',
    formality: 'formal',
    seasons: ['autumn', 'winter'],
  },
  {
    id: 'w07',
    name: 'Beige chinos',
    category: 'bottom',
    colour: 'beige',
    formality: 'smart',
    seasons: ['spring', 'summer', 'autumn'],
  },
  {
    id: 'w08',
    name: 'Navy wool blazer',
    category: 'outerwear',
    colour: 'navy',
    formality: 'formal',
    seasons: ['spring', 'autumn', 'winter'],
  },
  {
    id: 'w09',
    name: 'Olive waxed jacket',
    category: 'outerwear',
    colour: 'olive',
    formality: 'casual',
    seasons: ['autumn', 'winter'],
  },
  {
    id: 'w10',
    name: 'Camel wool overcoat',
    category: 'outerwear',
    colour: 'camel',
    formality: 'smart',
    seasons: ['winter'],
  },
  {
    id: 'w11',
    name: 'White leather trainers',
    category: 'shoes',
    colour: 'white',
    formality: 'casual',
    seasons: ['spring', 'summer', 'autumn'],
  },
  {
    id: 'w12',
    name: 'Brown leather brogues',
    category: 'shoes',
    colour: 'brown',
    formality: 'smart',
    seasons: ['spring', 'autumn', 'winter'],
  },
  {
    id: 'w13',
    name: 'Black Chelsea boots',
    category: 'shoes',
    colour: 'black',
    formality: 'smart',
    seasons: ['autumn', 'winter'],
  },
  {
    id: 'w14',
    name: 'Burgundy knitted tie',
    category: 'accessory',
    colour: 'burgundy',
    formality: 'smart',
    seasons: ['autumn', 'winter'],
  },
];

export interface SampleOccasion {
  formality: 'casual' | 'smart' | 'formal';
  guidance: string;
  rules: string[];
}

export const sampleOccasions: Record<string, SampleOccasion> = {
  'wedding guest': {
    formality: 'formal',
    guidance:
      'Tailored and celebratory. A suit or blazer with smart trousers, or a dress.',
    rules: [
      'Do not wear white or ivory as the main colour',
      'No jeans or trainers',
    ],
  },
  'job interview': {
    formality: 'formal',
    guidance:
      'One step smarter than the workplace wears day to day. Muted colours.',
    rules: ['No trainers', 'Nothing creased or visibly worn'],
  },
  office: {
    formality: 'smart',
    guidance: 'Smart casual: a shirt or fine knit with trousers or chinos.',
    rules: ['No sportswear'],
  },
  'first date': {
    formality: 'smart',
    guidance:
      'Relaxed but considered. Something you are comfortable in for hours.',
    rules: [],
  },
  funeral: {
    formality: 'formal',
    guidance: 'Dark, plain and understated.',
    rules: ['Dark colours only', 'No bold patterns'],
  },
  weekend: {
    formality: 'casual',
    guidance: 'Comfortable layers suited to the weather.',
    rules: [],
  },
};
