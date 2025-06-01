import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";

import env from "../env";

// You can specify any property from the libsql connection options
const db = drizzle({
  connection: {
    url: env.TURSO_DATABASE_URL,
    authToken: env.NODE_ENV === "development" ? undefined : env.TURSO_AUTH_TOKEN,
  },
});

export default db;
