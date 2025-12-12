import { Axiom } from "@axiomhq/js";

if (!process.env.AXIOM_TOKEN) {
  throw new Error("AXIOM_TOKEN environment variable is required");
}

// Mask the token for logging (show first 8 chars and last 4 chars)
const maskToken = (token: string): string => {
  if (token.length <= 12) return "***";
  return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
};

const token = process.env.AXIOM_TOKEN;
const orgId = process.env.AXIOM_ORG_ID;
// Note: Edge URLs (us-east-1.aws.edge.axiom.co) are for ingestion only
// Queries must use the main API URL (api.axiom.co)
const url = process.env.AXIOM_QUERY_URL || "https://api.axiom.co";

console.log("Axiom Configuration:");
console.log(`  Token: ${maskToken(token)}`);
if (orgId) console.log(`  Org ID: ${orgId}`);
console.log(`  Query URL: ${url}`);
console.log("---");

export const axiom = new Axiom({
  token,
  ...(orgId && { orgId }),
  url,
});
