import { z } from "zod";

import { resolveRealPlacePhoto, toPlacePhoto } from "~/lib/explore/place-media";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

// Photo-only sibling of place-intelligence: runs just the (slow) real-photo provider chain
// (Wikidata → Commons → Wikimapia → Mapillary → Google) so the popup can fetch it in parallel
// with the fast intelligence payload and fill the photo skeleton when it arrives.
const QuerySchema = z.object({
  name: z.string().trim().min(1).max(160),
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
});

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);

  const resolved = await resolveRealPlacePhoto({
    name: query.name,
    lat: query.lat,
    long: query.long,
  });

  return {
    photo: resolved.status === "photo" ? toPlacePhoto(resolved.photo, query.name) : null,
  };
});
