import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '@tunarr/types/api';
import { z } from 'zod';

const BaseLineupItemSchema = z.object({
  durationMs: z.number().positive(), // Add a max
});

export const ContentLineupItemSchema = z
  .object({
    type: z.literal('content'),
    id: z.string().min(1),
    // If this lineup item was a part of a custom show
    // this is a pointer to that show.
    // TODO: If a custom show is deleted, we have to remove
    // references to these content items in the lineup
    customShowId: z.string().uuid().optional(),
  })
  .merge(BaseLineupItemSchema);

// This item has to be hydrated from the DB
export type ContentItem = z.infer<typeof ContentLineupItemSchema>;

export const OfflineLineupItemSchema = z
  .object({
    type: z.literal('offline'),
  })
  .merge(BaseLineupItemSchema);

export type OfflineItem = z.infer<typeof OfflineLineupItemSchema>;

export const RedirectLineupItemSchema = z
  .object({
    type: z.literal('redirect'),
    channel: z.string().uuid(),
  })
  .merge(BaseLineupItemSchema);
export type RedirectItem = z.infer<typeof RedirectLineupItemSchema>;

export const LineupItemSchema = z.discriminatedUnion('type', [
  ContentLineupItemSchema,
  OfflineLineupItemSchema,
  RedirectLineupItemSchema,
]);

export type LineupItem = z.infer<typeof LineupItemSchema>;

function isItemOfType<T extends LineupItem>(discrim: string) {
  return function (t: LineupItem | undefined): t is T {
    return t?.type === discrim;
  };
}

export const isContentItem = isItemOfType<ContentItem>('content');
export const isOfflineItem = isItemOfType<OfflineItem>('offline');
export const isRedirectItem = isItemOfType<RedirectItem>('redirect');

export const LineupSchema = z.object({
  // The current lineup of a single cycle of this channel
  items: LineupItemSchema.array(),

  // Defines rules for how to schedule content in the channel
  // Currently time-based and random-slot-based rulesets are
  // supported.
  // Unsure if we want this DB type to reference the
  // API type, but for now it will work.
  schedule: LineupScheduleSchema.optional(),

  // These are precalculated offsets in milliseconds. The
  // array is a list of the running 'total' duration sum
  // of each of the lineup items. It can be used to quickly
  // determine a start timestamp for a given program by
  // pulling the offset at a given index and adding it to
  // a "start" time timestamp.
  startTimeOffsets: z.array(z.number()).optional(),

  dynamicContentConfig: DynamicContentConfigSchema.optional(),
});

export type Lineup = z.infer<typeof LineupSchema>;
