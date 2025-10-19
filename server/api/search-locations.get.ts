import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const query = getQuery(event);
  console.log(query.q);
  console.log(query, "query");
});
