import { NextRequest, NextResponse } from "next/server";
import { oauthClient, saveGoogleAccount } from "@/lib/sources/google";
import { syncAll } from "@/lib/sync/engine";

function fail(origin: string, message: string): NextResponse {
  const res = NextResponse.redirect(`${origin}/settings?google_error=${encodeURIComponent(message)}`);
  res.cookies.delete("google_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  const origin = req.nextUrl.origin;

  if (error || !code) return fail(origin, error ?? "no code");
  // CSRF: the state we set in /start must come back unchanged.
  if (!state || !cookieState || state !== cookieState) {
    return fail(origin, "OAuth state mismatch — please try connecting again");
  }

  try {
    const client = oauthClient(`${origin}/api/oauth/google/callback`);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return fail(
        origin,
        "No refresh token returned — remove the app at myaccount.google.com/permissions and try again",
      );
    }

    // Pull the email out of the ID token for account identity/labeling.
    let email: string | null = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64").toString());
        email = payload.email ?? null;
      } catch {
        // non-fatal
      }
    }

    const accountId = await saveGoogleAccount({ refreshToken: tokens.refresh_token, email });
    syncAll({ accountId }).catch(() => {});
    const res = NextResponse.redirect(`${origin}/settings?google_connected=1`);
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (err) {
    // Log the detail server-side; don't reflect raw upstream errors to the client.
    console.error("[oauth] callback failed:", err);
    return fail(origin, "Could not connect the Google account — please try again");
  }
}
