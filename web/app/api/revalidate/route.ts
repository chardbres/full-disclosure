import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { FILINGS_TAG } from "@/lib/data";

// Called by the GitHub Action after it saves analyses, so they appear right
// away instead of when the hour-long cache runs out. Needs the shared secret.
export const POST = async (request: NextRequest) => {
  const secret = process.env.REVALIDATE_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // Compared in constant time, so response timing doesn't leak the secret
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // expire: 0 means the next visitor gets fresh data, not the old page
  revalidateTag(FILINGS_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
};
