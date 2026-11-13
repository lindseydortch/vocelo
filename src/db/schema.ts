import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const usageKind = pgEnum('usage_kind', [
  'tts_chars',
  'post_review',
  'llm_call',
])
export const sentiment = pgEnum('sentiment', [
  'positive',
  'neutral',
  'negative',
])
export const bufferStatus = pgEnum('buffer_status', [
  'draft',
  'scheduled',
  'sent',
])

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    bufferAccountId: text().notNull().unique('users_buffer_account_id_unique'),
    email: text(),
    bufferOrganizationId: text().notNull(),
    timezone: text(),
    plan: text().notNull().default('free'),
    stripeCustomerId: text(),
    stripeSubscriptionId: text(),
    subscriptionStatus: text(),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    periodAnchorAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    index('users_stripe_customer_idx').on(t.stripeCustomerId),
    index('users_stripe_subscription_idx').on(t.stripeSubscriptionId),
  ],
)

export const bufferConnections = pgTable('buffer_connections', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessTokenEnc: text().notNull(),
  refreshTokenEnc: text(),
  accessExpiresAt: timestamp({ withTimezone: true }),
  scopes: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const posts = pgTable(
  'posts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bufferOrganizationId: text().notNull(),
    channelId: text().notNull(),
    channelService: text().notNull(),
    channelName: text().notNull(),
    bufferPostId: text(),
    bufferStatus: bufferStatus(),
    dueAt: timestamp({ withTimezone: true }),
    text: text().notNull(),
    isSample: boolean().notNull().default(false),
    createdAt: createdAt(),
    lastEditedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('posts_user_buffer_post_unique').on(t.userId, t.bufferPostId),
    index('posts_user_last_edited_idx').on(t.userId, t.lastEditedAt),
  ],
)

export const versions = pgTable('versions', {
  id: uuid().primaryKey().defaultRandom(),
  postId: uuid()
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  text: text().notNull(),
  textHash: text().notNull(),
  createdAt: createdAt(),
})

export const personas = pgTable('personas', {
  id: uuid().primaryKey().defaultRandom(),
  // null = standard persona (inserted by a migration)
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  bio: text().notNull(),
  avatarKey: text().notNull(),
  elevenlabsVoiceId: text().notNull(),
  readerDescription: text().notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp({ withTimezone: true }),
})

export const reactions = pgTable(
  'reactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    personaId: uuid()
      .notNull()
      .references(() => personas.id),
    channelService: text().notNull(),
    textHash: text().notNull(),
    reaction: text().notNull(),
    sentiment: sentiment().notNull(),
    model: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('reactions_post_persona_channel_hash_unique').on(
      t.postId,
      t.personaId,
      t.channelService,
      t.textHash,
    ),
  ],
)

export const toneReads = pgTable(
  'tone_reads',
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    channelService: text().notNull(),
    textHash: text().notNull(),
    label: text().notNull(),
    sentiment: sentiment().notNull(),
    summary: text().notNull(),
    model: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('tone_reads_post_channel_hash_unique').on(
      t.postId,
      t.channelService,
      t.textHash,
    ),
  ],
)

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: usageKind().notNull(),
    amount: integer().notNull(),
    // Deleting a post never refunds usage: keep the row, drop the link.
    postId: uuid().references(() => posts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('usage_events_user_created_idx').on(t.userId, t.createdAt)],
)

export const stripeEvents = pgTable('stripe_events', {
  id: text().primaryKey(),
  type: text().notNull(),
  processedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
