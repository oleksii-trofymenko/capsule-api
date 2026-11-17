import type { Locale } from '../locale.js';

export interface StylistPrompts {
  /** Classifies the latest message; the occasion itself is found in code. */
  understand: string;
  /** Picks wardrobe items for an outfit; returns ids from the candidate list. */
  compose: string;
  /** Turns a chosen outfit into the reply, in the persona's voice. */
  write: string;
  /** Answers a question about clothes, the wardrobe or style. */
  answer: string;
  /** Asked when an outfit request gives nothing to go on. */
  clarify: string;
  /** Headings for the context blocks added to prompts. */
  labels: {
    today: string;
    occasion: string;
    noOccasion: string;
    rules: string;
    candidates: string;
    wardrobe: string;
    emptyWardrobe: string;
    profile: string;
    outfit: string;
    missing: string;
    removed: string;
    retry: string;
  };
}

/** Prompts for the stylist graph's model calls, keyed by locale. The persona is added to write and answer. */
export const stylistPrompts: Record<Locale, StylistPrompts> = {
  en: {
    understand: `You read the latest message to a personal stylist and classify it.
- intent: "outfit" if the person wants clothes put together (an outfit, a look, what to wear somewhere, something to wear instead of a piece). "question" for anything else: whether something works, what they own, buying or replacing a single piece, trends, sizes, or a remark.
- enoughToSuggest: for an outfit, true if the conversation gives anything to go on: where they are going, what they are doing, the weather, a style such as smart-casual, or items to build around or replace. False only if it gives nothing at all, as in "I'm going out" or "what should I wear today?".`,
    compose: `You put together one outfit from the candidate items listed, for the conversation below.
- Use only ids from the candidate list. Choose 2 to 5 items that work together: usually a top or dress, a bottom unless there is a dress, shoes, and outerwear if the weather or occasion calls for it.
- Follow the occasion's guidance and rules if one is given, the season, and anything the person said they want or dislike.
- If no candidate fits a part of the outfit, leave it out; the reply will name the gap.
- missing: a short plain description of anything the outfit lacks, or null.`,
    write: `Write your reply presenting this outfit. Name every item exactly as listed, then say in one sentence why it works. If something is missing, say so plainly and describe what would fill it, without naming brands or shops. If an item was removed for breaking a rule, say why in a few words.`,
    answer: `Answer the person's latest message using the wardrobe, profile and occasion details below. Name items exactly as listed. If they ask whether they own something, check the wardrobe list carefully before answering. If they share a preference or size, acknowledge it briefly and say how you will use it.`,
    clarify: `Happy to help. Where are you heading, roughly: work, dinner, drinks, or something dressier?`,
    labels: {
      today: 'Today',
      occasion: 'Occasion',
      noOccasion: 'No specific occasion; go by the conversation.',
      rules: 'Rules it must keep',
      candidates: 'Candidate items (id: description)',
      wardrobe: 'Everything the person owns',
      emptyWardrobe: 'The wardrobe is empty so far.',
      profile: 'What the person told us about themselves',
      outfit: 'The outfit',
      missing: 'Missing',
      removed: 'Removed for breaking a rule',
      retry: 'Your last pick broke these rules; pick again without those items',
    },
  },
};
