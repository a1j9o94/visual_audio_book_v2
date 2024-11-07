import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

const tablePrefix = 'visual_audio_book_v2_';

// Core content tables
export const books = pgTable(`${tablePrefix}book`, {
  id: uuid("id").defaultRandom().primaryKey(),
  gutenbergId: text("gutenberg_id").unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  coverImageUrl: text("cover_image_url"),
  status: text("status").notNull().default('pending'),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const characters = pgTable(`${tablePrefix}character`, {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  attributes: jsonb("attributes"),
  firstAppearance: timestamp("first_appearance"),
  createdAt: timestamp("created_at").defaultNow()
});

export const sequences = pgTable(`${tablePrefix}sequence`, {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  content: text("content").notNull(),
  startPosition: integer("start_position").notNull(),
  endPosition: integer("end_position").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow()
});

export const sequenceMedia = pgTable(`${tablePrefix}sequence_media`, {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id").references(() => sequences.id, { onDelete: "cascade" }).unique(),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  audioDuration: integer("audio_duration"),
  imageMetadata: jsonb("image_metadata"),
  generatedAt: timestamp("generated_at").defaultNow()
});

export const sequenceMetadata = pgTable(`${tablePrefix}sequence_metadata`, {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id")
    .references(() => sequences.id, { onDelete: "cascade" })
    .unique(),
  sceneDescription: jsonb("scene_description"),
  cameraDirections: jsonb("camera_directions"),
  mood: jsonb("mood"),
  lighting: jsonb("lighting"),
  settings: jsonb("settings"),
  aiAnnotations: jsonb("ai_annotations")
});

export const sequenceCharacters = pgTable(`${tablePrefix}sequence_character`, {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id").references(() => sequences.id, { onDelete: "cascade" }),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "cascade" }),
  role: text("role"),
  context: jsonb("context")
});

export const users = pgTable(`${tablePrefix}user`, {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow()
});

export const userBookProgress = pgTable(`${tablePrefix}user_book_progress`, {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  lastSequenceNumber: integer("last_sequence_number").notNull().default(0),
  lastReadAt: timestamp("last_read_at").defaultNow(),
  totalTimeSpent: integer("total_time_spent").default(0),
  isComplete: boolean("is_complete").default(false),
  readingPreferences: jsonb("reading_preferences"),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const userBookmarks = pgTable(`${tablePrefix}user_bookmark`, {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow()
});

export const userSequenceHistory = pgTable(`${tablePrefix}user_sequence_history`, {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").references(() => sequences.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
  timeSpent: integer("time_spent").default(0),
  completed: boolean("completed").default(false),
  preferences: jsonb("preferences")
});

export const accounts = pgTable(`${tablePrefix}account`, {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccount["type"]>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state")
}, (account) => ({
  providerProviderAccountIdIndex: index("provider_provider_account_id_idx").on(
    account.provider,
    account.providerAccountId
  ),
  userIdIndex: index("user_id_idx").on(account.userId)
}));

export const sessions = pgTable(`${tablePrefix}session`, {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull()
});

export const verificationTokens = pgTable(`${tablePrefix}verification_token`, {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] })
}));

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
