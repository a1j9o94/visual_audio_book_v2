# Visual Audio Books

Visual Audio Books is an innovative platform that transforms public domain books into immersive audiovisual experiences. It combines AI-generated audio narration with contextually relevant images to create a unique "visual audiobook" experience, similar to a TikTok-style feed for literature.

## Features

- 📚 Access to public domain books from Project Gutenberg
- 🎧 AI-powered text-to-speech narration
- 🖼️ AI-generated images that match the story context
- 📱 TikTok-style vertical scrolling interface
- 🔖 Bookmark and track reading progress
- 👥 Character tracking and scene analysis
- 📊 Reading statistics and preferences

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Backend**: tRPC, Node.js
- **Database**: PostgreSQL with Drizzle ORM
  - Storing audio and images directly may need to consider saving in a storage service like UploadThing or S3 later
- **Authentication**: NextAuth.js
- **AI Services**:
  - OpenAI API for text-to-speech
  - Stability AI for image generation
  - Anthropic Claude for scene analysis
- **Job Processing**: BullMQ + Redis

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis
- Project Gutenberg API access
- AI service API keys (OpenAI, Stability AI, Anthropic)

### Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/visual_audio_books"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
```

### TODO
- [ ] Implement character consistency with: https://qinghew.github.io/CharacterFactory/
- [ ] Add automatic sequence generation when a book is added to someones library for the first time
- [ ] Implement bookmarks
- [ ] Implement reading statistics