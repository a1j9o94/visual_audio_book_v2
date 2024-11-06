```mermaid
graph TB
    subgraph Client["Client Layer"]
        UI["Web UI (Next.js)"]
        BookList["Book Library View"]
        Player["TikTok-style Player"]
    end

    subgraph API["API Layer (Next.js API Routes)"]
        BookAPI["Book Management API"]
        ProcessingAPI["Content Processing API"]
        MediaAPI["Media Generation API"]
    end

    subgraph DB["Database Layer"]
        SQLite[(SQLite + Drizzle ORM)]
        Cache["Redis Cache"]
    end

    subgraph Queue["Job Queue"]
        Bull["Bull Queue"]
        Workers["Background Workers"]
    end

    subgraph External["External Services"]
        Gutenberg["Project Gutenberg API"]
        OpenAI["OpenAI TTS API"]
        StabilityAI["Stability AI Image API"]
        Claude["Anthropic Claude API"]
    end

    subgraph Storage["Storage"]
        Assets["Static Assets"]
        CDN["CDN/Media Storage"]
    end

    %% Client Layer Connections
    UI --> BookList
    UI --> Player
    BookList --> BookAPI
    Player --> MediaAPI

    %% API Layer Connections
    BookAPI --> SQLite
    BookAPI --> Cache
    ProcessingAPI --> Bull
    MediaAPI --> CDN

    %% Queue Connections
    Bull --> Workers
    Workers --> OpenAI
    Workers --> StabilityAI
    Workers --> Claude
    Workers --> CDN

    %% External Service Connections
    BookAPI --> Gutenberg
    ProcessingAPI --> OpenAI
    ProcessingAPI --> StabilityAI
    ProcessingAPI --> Claude

    %% Storage Connections
    CDN --> Assets
```
```mermaid
erDiagram
    erDiagram
    Books ||--o{ Sequences : contains
    Books ||--o{ Characters : has
    Books ||--o{ UserBookProgress : tracked_by
    Users ||--o{ UserBookProgress : tracks
    Users ||--o{ UserBookmarks : creates
    Books ||--o{ UserBookmarks : has
    Sequences ||--o{ SequenceCharacters : includes
    Characters ||--o{ SequenceCharacters : appears_in
    Sequences ||--|| SequenceMedia : has
    Sequences ||--|| SequenceMetadata : has
    Sequences ||--o{ UserSequenceHistory : tracked_by
    Users ||--o{ UserSequenceHistory : tracks

    Books {
        string id PK
        string gutenbergId UK
        string title
        string author
        string coverImageUrl
        string status
        json metadata
        timestamp createdAt
        timestamp updatedAt
    }

    Users {
        string id PK
        string email UK
        string name
        timestamp createdAt
    }

    UserBookProgress {
        string id PK
        string userId FK
        string bookId FK
        integer lastSequenceNumber
        timestamp lastReadAt
        integer totalTimeSpent
        boolean isComplete
        json readingPreferences
        timestamp updatedAt
    }

    UserBookmarks {
        string id PK
        string userId FK
        string bookId FK
        integer sequenceNumber
        string note
        timestamp createdAt
    }

    UserSequenceHistory {
        string id PK
        string userId FK
        string sequenceId FK
        timestamp viewedAt
        integer timeSpent
        boolean completed
        json preferences
    }

    Characters {
        string id PK
        string bookId FK
        string name
        text description
        json attributes
        timestamp firstAppearance
        timestamp createdAt
    }

    Sequences {
        string id PK
        string bookId FK
        integer sequenceNumber
        text content
        integer startPosition
        integer endPosition
        string status
        timestamp createdAt
    }

    SequenceCharacters {
        string id PK
        string sequenceId FK
        string characterId FK
        string role
        json context
    }

    SequenceMedia {
        string id PK
        string sequenceId FK
        string audioUrl
        string imageUrl
        integer audioDuration
        json imageMetadata
        timestamp generatedAt
    }

    SequenceMetadata {
        string id PK
        string sequenceId FK
        json sceneDescription
        json cameraDirections
        json mood
        json lighting
        json settings
        json aiAnnotations
    }
```
