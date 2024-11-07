import { relations, sql } from "drizzle-orm";
import {
  index,
  int,
  sqliteTableCreator,
  text,
  blob,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * Multi-project schema prefix
 */
export const createTable = sqliteTableCreator((name) => `visual_audio_book_v2_${name}`);

// Core content tables
export const books = createTable("book", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gutenbergId: text("gutenberg_id").unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  coverImageUrl: text("cover_image_url"),
  status: text("status").notNull().default("pending"),
  metadata: blob("metadata", { mode: "json" }),
  createdAt: int("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const characters = createTable("character", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  attributes: blob("attributes", { mode: "json" }),
  firstAppearance: int("first_appearance", { mode: "timestamp" }),
  createdAt: int("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const sequences = createTable("sequence", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
  sequenceNumber: int("sequence_number").notNull(),
  content: text("content").notNull(),
  startPosition: int("start_position").notNull(),
  endPosition: int("end_position").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: int("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

// Media and metadata tables
export const sequenceMedia = createTable("sequence_media", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sequenceId: text("sequence_id").references(() => sequences.id, { onDelete: "cascade" }).unique(),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  audioDuration: int("audio_duration"),
  imageMetadata: blob("image_metadata", { mode: "json" }),
  generatedAt: int("generated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const sequenceMetadata = createTable("sequence_metadata", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sequenceId: text("sequence_id").references(() => sequences.id, { onDelete: "cascade" }),
  sceneDescription: blob("scene_description", { mode: "json" }),
  cameraDirections: blob("camera_directions", { mode: "json" }),
  mood: blob("mood", { mode: "json" }),
  lighting: blob("lighting", { mode: "json" }),
  settings: blob("settings", { mode: "json" }),
  aiAnnotations: blob("ai_annotations", { mode: "json" })
});

// Junction tables
export const sequenceCharacters = createTable("sequence_character", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sequenceId: text("sequence_id").references(() => sequences.id, { onDelete: "cascade" }),
  characterId: text("character_id").references(() => characters.id, { onDelete: "cascade" }),
  role: text("role"),
  context: blob("context", { mode: "json" })
});

// User-related tables
export const users = createTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: int("email_verified", { mode: "timestamp" }),
  image: text("image"),
  createdAt: int("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const userBookProgress = createTable("user_book_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
  lastSequenceNumber: int("last_sequence_number").notNull().default(0),
  lastReadAt: int("last_read_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
  totalTimeSpent: int("total_time_spent").default(0),
  isComplete: int("is_complete", { mode: "boolean" }).default(0),
  readingPreferences: blob("reading_preferences", { mode: "json" }),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const userBookmarks = createTable("user_bookmark", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
  sequenceNumber: int("sequence_number").notNull(),
  note: text("note"),
  createdAt: int("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
});

export const userSequenceHistory = createTable("user_sequence_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  sequenceId: text("sequence_id").references(() => sequences.id, { onDelete: "cascade" }),
  viewedAt: int("viewed_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
  timeSpent: int("time_spent").default(0),
  completed: int("completed", { mode: "boolean" }).default(0),
  preferences: blob("preferences", { mode: "json" })
});

// Auth-related tables (keeping existing auth tables)
export const accounts = createTable("account", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccount["type"]>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: int("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  providerProviderAccountIdIndex: index("provider_provider_account_id_idx").on(
    account.provider,
    account.providerAccountId,
  ),
  userIdIndex: index("user_id_idx").on(account.userId),
}));

// Add these tables after the accounts table...

export const sessions = createTable("session", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: int("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = createTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
)

// Relations
export const booksRelations = relations(books, ({ many }) => ({
  characters: many(characters),
  sequences: many(sequences),
  userProgress: many(userBookProgress),
  bookmarks: many(userBookmarks),
}));

export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  book: one(books, { fields: [sequences.bookId], references: [books.id] }),
  media: one(sequenceMedia, { fields: [sequences.id], references: [sequenceMedia.sequenceId] }),
  metadata: one(sequenceMetadata, { fields: [sequences.id], references: [sequenceMetadata.sequenceId] }),
  characters: many(sequenceCharacters),
  history: many(userSequenceHistory),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  bookProgress: many(userBookProgress),
  bookmarks: many(userBookmarks),
  sequenceHistory: many(userSequenceHistory),
}));

// Add these relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sequenceMediaRelations = relations(sequenceMedia, ({ one }) => ({
  sequence: one(sequences, { fields: [sequenceMedia.sequenceId], references: [sequences.id] }),
}));

export const sequenceMetadataRelations = relations(sequenceMetadata, ({ one }) => ({
  sequence: one(sequences, { fields: [sequenceMetadata.sequenceId], references: [sequences.id] }),
}));

export const sequenceCharactersRelations = relations(sequenceCharacters, ({ one }) => ({
  sequence: one(sequences, { fields: [sequenceCharacters.sequenceId], references: [sequences.id] }),
  character: one(characters, { fields: [sequenceCharacters.characterId], references: [characters.id] }),
}));

export const userBookProgressRelations = relations(userBookProgress, ({ one }) => ({
  user: one(users, { fields: [userBookProgress.userId], references: [users.id] }),
  book: one(books, { fields: [userBookProgress.bookId], references: [books.id] }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
  user: one(users, { fields: [userBookmarks.userId], references: [users.id] }),
  book: one(books, { fields: [userBookmarks.bookId], references: [books.id] }),
}));

export const userSequenceHistoryRelations = relations(userSequenceHistory, ({ one }) => ({
  user: one(users, { fields: [userSequenceHistory.userId], references: [users.id] }),
  sequence: one(sequences, { fields: [userSequenceHistory.sequenceId], references: [sequences.id] }),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  book: one(books, { fields: [characters.bookId], references: [books.id] }),
}));
