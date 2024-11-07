import { type Config } from "drizzle-kit";
import { env } from "~/env";

// Parse the connection string to get individual components
const connectionString = new URL(env.DATABASE_URL);

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: connectionString.hostname,
    user: connectionString.username,
    password: connectionString.password,
    database: connectionString.pathname.slice(1), // Remove leading slash
    port: Number(connectionString.port) || 5432,
    ssl: env.DATABASE_URL.includes('localhost') ? false : true,
  },
  out: "./drizzle",
} satisfies Config;
