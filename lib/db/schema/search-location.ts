import { z } from "zod";

export const SearchLocationQuery = z.object({
  q: z.string(),
});

export type SearchLocationSchema = z.infer<typeof SearchLocationQuery>;
