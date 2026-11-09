import type { NextRequest } from "next/server";
import { searchCompanies } from "@/lib/companies";

// Company suggestions for the search box: GET /api/companies?q=nvid
export const GET = async (request: NextRequest) => {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 50);
  const companies = await searchCompanies(query);
  return Response.json(
    companies.map(({ ticker, name }) => ({ ticker, name })),
    // The SEC's list changes rarely, so Vercel's CDN can answer repeat searches
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
};
