import { createPlaygroundTools } from './playground.tools.js';

const tools = createPlaygroundTools(() => new Date('2026-11-17T10:00:00Z'));
const call = async (name: string, args: object) =>
  JSON.parse(String(await tools.find((t) => t.name === name)!.invoke(args)));

describe('playground tools', () => {
  it('exposes exactly the three test tools', () => {
    expect(tools.map((t) => t.name)).toEqual([
      'get_today',
      'search_wardrobe',
      'get_dress_code',
    ]);
  });

  it('get_today reports date, weekday and season', async () => {
    expect(await call('get_today', {})).toEqual({
      date: '2026-11-17',
      weekday: 'Tuesday',
      season: 'autumn',
      hemisphere: 'northern',
    });
  });

  it('search_wardrobe lists everything when called with no arguments', async () => {
    expect((await call('search_wardrobe', {})).count).toBe(14);
  });

  it('search_wardrobe filters by category and by words', async () => {
    const shoes = await call('search_wardrobe', { category: 'shoes' });
    expect(shoes.items.map((i: { id: string }) => i.id)).toEqual([
      'w11',
      'w12',
      'w13',
    ]);

    const navy = await call('search_wardrobe', { query: 'Navy' });
    expect(navy.items.map((i: { id: string }) => i.id)).toEqual(['w02', 'w08']);

    const none = await call('search_wardrobe', {
      query: 'sequin',
      category: 'dress',
    });
    expect(none).toEqual({ count: 0, items: [] });
  });

  it('get_dress_code returns rules for a known occasion, ignoring case and spacing', async () => {
    const result = await call('get_dress_code', {
      occasion: '  Wedding Guest ',
    });
    expect(result).toMatchObject({ found: true, formality: 'formal' });
    expect(result.rules).toContain(
      'Do not wear white or ivory as the main colour',
    );
  });

  it('get_dress_code tells the model which occasions exist when it asks for an unknown one', async () => {
    const result = await call('get_dress_code', { occasion: 'moon landing' });
    expect(result.found).toBe(false);
    expect(result.known).toContain('job interview');
  });

  it('rejects arguments that do not match the schema', async () => {
    const search = tools.find((t) => t.name === 'search_wardrobe')!;
    await expect(search.invoke({ category: 'hats' })).rejects.toThrow();
  });
});
