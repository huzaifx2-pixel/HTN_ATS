import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "better-auth.session_token";

/** Headers for Better Auth API calls, including cookies set earlier in this request. */
export async function sessionRequestHeaders(sessionToken?: string | null): Promise<Headers> {
  const incoming = await headers();
  const next = new Headers(incoming);
  const jar = new Map<string, string>();

  for (const cookie of (await cookies()).getAll()) {
    jar.set(cookie.name, cookie.value);
  }

  if (sessionToken) {
    const name =
      [...jar.keys()].find((key) => key.endsWith("session_token")) ?? SESSION_COOKIE;
    jar.set(name, sessionToken);
  }

  if (jar.size > 0) {
    next.set(
      "cookie",
      [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  }

  return next;
}
