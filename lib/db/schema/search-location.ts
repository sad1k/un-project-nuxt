import { z } from "zod";

export const SearchLocationQuery = z.object({
  q: z.string().trim().min(2).max(120),
});

export type SearchLocationSchema = z.infer<typeof SearchLocationQuery>;
