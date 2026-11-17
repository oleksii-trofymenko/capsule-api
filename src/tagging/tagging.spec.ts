import { normaliseTags, photoTagsSchema } from './tagging.schemas.js';
import { buildTaggingMessages } from './tagging.service.js';
import { taggingPrompts } from './tagging.prompts.js';

const tags = {
  name: 'Navy wool blazer',
  category: 'outerwear' as const,
  colour: 'navy',
  formality: 'formal' as const,
  seasons: ['winter' as const, 'autumn' as const, 'winter' as const],
};

describe('photo tags', () => {
  it('keeps each season once, in calendar order', () => {
    expect(normaliseTags(tags).seasons).toEqual(['autumn', 'winter']);
  });

  it('rejects categories and formalities outside the wardrobe model', () => {
    expect(photoTagsSchema.safeParse(tags).success).toBe(true);
    expect(
      photoTagsSchema.safeParse({ ...tags, category: 'cape' }).success,
    ).toBe(false);
    expect(
      photoTagsSchema.safeParse({ ...tags, formality: 'black tie' }).success,
    ).toBe(false);
    expect(photoTagsSchema.safeParse({ ...tags, seasons: [] }).success).toBe(
      false,
    );
  });
});

describe('buildTaggingMessages', () => {
  it('sends the prompt, then the photo as a data URL of its own type', () => {
    const [system, human] = buildTaggingMessages(
      'en',
      'image/png',
      new Uint8Array([1, 2, 3]),
    );
    expect(system.text).toBe(taggingPrompts.en);
    expect(human.content).toEqual([
      { type: 'text', text: 'Catalogue this item.' },
      { type: 'image_url', image_url: 'data:image/png;base64,AQID' },
    ]);
  });
});
