import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(
  new URL(url).hostname,
  "127.0.0.1",
  "Integration tests are restricted to local Supabase.",
);
const mailbox = "http://127.0.0.1:54324";
const redirect = "http://localhost:8081/auth/callback";
const password = `Wardrobe-${randomUUID()}!`;
const ids = [];
const mailboxIds = [];
const clients = [];
const makeClient = (storage = new Map()) => {
  const client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => {
          storage.set(k, v);
        },
        removeItem: (k) => {
          storage.delete(k);
        },
      },
    },
  });
  clients.push(client);
  return client;
};
function success(result, operation) {
  assert.equal(result.error, null, `${operation}: ${result.error?.message}`);
  return result.data;
}
async function emailContent(email, subject) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${mailbox}/api/v1/messages?limit=100`);
    const inbox = await response.json();
    const match = inbox.messages.find(
      (message) =>
        message.To.some((to) => to.Address === email) &&
        message.Subject.toLowerCase().includes(subject) &&
        !mailboxIds.includes(message.ID),
    );
    if (match) {
      mailboxIds.push(match.ID);
      const message = await (
        await fetch(`${mailbox}/api/v1/message/${match.ID}`)
      ).json();
      const link = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/);
      assert.ok(link, "Actual email must contain an auth verification link");
      const code = message.HTML.match(/<strong>(\d{6})<\/strong>/)?.[1];
      return { link: link[1].replaceAll("&amp;", "&"), code };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Email did not arrive in the local inbox.");
}
async function followLink(link) {
  const response = await fetch(link, { redirect: "manual" });
  assert.equal(response.status, 303);
  const destination = new URL(response.headers.get("location"));
  assert.equal(destination.origin, "http://localhost:8081");
  assert.equal(destination.pathname, "/auth/callback");
  const code = destination.searchParams.get("code");
  assert.ok(code, "Email must redirect with a PKCE code");
  return code;
}
async function createAccount(client, label) {
  const email = `wardrobe-auth-test-${randomUUID()}@example.test`;
  const data = success(
    await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: label }, emailRedirectTo: redirect },
    }),
    "signup",
  );
  assert.equal(data.session, null, "Email confirmation must be required");
  ids.push(data.user.id);
  const blocked = await client.auth.signInWithPassword({ email, password });
  assert.equal(blocked.error?.code, "email_not_confirmed");
  const code = await followLink((await emailContent(email, "confirm")).link);
  const confirmed = success(
    await client.auth.exchangeCodeForSession(code),
    "confirmation exchange",
  );
  assert.equal(confirmed.user.id, data.user.id);
  return { email, id: data.user.id };
}
try {
  const disk = new Map();
  const alice = makeClient(disk);
  const a = await createAccount(alice, "Test Alice");
  const bob = makeClient();
  const b = await createAccount(bob, "Test Bob");
  console.log(
    "PASS: signup, email confirmation, and PKCE exchange for two real users",
  );

  const profile = success(
    await alice.from("profiles").select("*").single(),
    "own profile",
  );
  assert.equal(profile.id, a.id);
  assert.equal(profile.display_name, "Test Alice");
  assert.equal(profile.avatar_url, null);
  assert.ok(profile.created_at);
  assert.ok(profile.updated_at);
  const before = profile.updated_at;
  const updated = success(
    await alice
      .from("profiles")
      .update({ display_name: "Alice Updated" })
      .eq("id", a.id)
      .select()
      .single(),
    "own update",
  );
  assert.equal(updated.display_name, "Alice Updated");
  assert.notEqual(updated.updated_at, before);
  assert.equal(updated.created_at, profile.created_at);
  console.log(
    "PASS: automatic profile creation, own-profile update, server timestamps",
  );

  const anonymous = makeClient();
  assert.ok(
    (await anonymous.from("profiles").select("*")).error,
    "Anonymous profile reads must be denied",
  );
  assert.deepEqual(
    success(
      await alice.from("profiles").select("*").eq("id", b.id),
      "foreign select",
    ),
    [],
  );
  assert.deepEqual(
    success(
      await alice
        .from("profiles")
        .update({ display_name: "Attacker" })
        .eq("id", b.id)
        .select(),
      "foreign update",
    ),
    [],
  );
  assert.ok(
    (
      await alice
        .from("profiles")
        .insert({ id: b.id, display_name: "Attacker" })
    ).error,
  );
  assert.ok(
    (await alice.from("profiles").update({ id: b.id }).eq("id", a.id)).error,
  );
  assert.ok(
    (
      await alice
        .from("profiles")
        .update({ created_at: "2000-01-01" })
        .eq("id", a.id)
    ).error,
  );
  assert.ok((await alice.from("profiles").delete().eq("id", a.id)).error);
  assert.equal(
    success(await bob.from("profiles").select("*").single(), "bob unchanged")
      .display_name,
    "Test Bob",
  );
  console.log(
    "PASS: anonymous access, cross-user reads/writes, forged IDs, inserts/deletes, timestamp tampering denied",
  );

  const restarted = makeClient(disk);
  assert.equal(
    success(await restarted.auth.getSession(), "restore session").session.user
      .id,
    a.id,
  );
  const refreshed = success(
    await restarted.auth.refreshSession(),
    "refresh session",
  );
  assert.equal(refreshed.user.id, a.id);
  success(await restarted.auth.signOut({ scope: "local" }), "logout");
  assert.equal(
    success(await makeClient(disk).auth.getSession(), "restore after logout")
      .session,
    null,
  );
  assert.equal(
    (await restarted.auth.refreshSession()).error?.name,
    "AuthSessionMissingError",
  );
  assert.equal(
    (await restarted.from("profiles").select("*")).error?.code,
    "42501",
  );
  assert.equal(
    (
      await restarted.auth.signInWithPassword({
        email: a.email,
        password: "incorrect-password",
      })
    ).error?.code,
    "invalid_credentials",
  );
  success(
    await restarted.auth.signInWithPassword({ email: a.email, password }),
    "login",
  );
  console.log(
    "PASS: persisted-session restoration, refresh, logout persistence, bad credentials, login",
  );

  success(
    await restarted.auth.signOut({ scope: "local" }),
    "logout before reset",
  );
  success(
    await restarted.auth.resetPasswordForEmail(a.email, {
      redirectTo: `${redirect}?recovery=1`,
    }),
    "forgot password",
  );
  const resetCode = await followLink(
    (await emailContent(a.email, "reset")).link,
  );
  let recoveryEvent = false;
  const listener = restarted.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") recoveryEvent = true;
  });
  success(
    await restarted.auth.exchangeCodeForSession(resetCode),
    "recovery exchange",
  );
  assert.ok(
    recoveryEvent,
    "PASSWORD_RECOVERY must drive reset-only navigation",
  );
  const newPassword = `New-${randomUUID()}!`;
  success(
    await restarted.auth.updateUser({ password: newPassword }),
    "password update",
  );
  success(
    await restarted.auth.signOut({ scope: "local" }),
    "logout reset session",
  );
  assert.equal(
    (await restarted.auth.signInWithPassword({ email: a.email, password }))
      .error?.code,
    "invalid_credentials",
  );
  success(
    await restarted.auth.signInWithPassword({
      email: a.email,
      password: newPassword,
    }),
    "new password login",
  );
  assert.ok(
    (await makeClient().auth.exchangeCodeForSession(resetCode)).error,
    "Used/reset codes cannot be replayed on another client",
  );
  listener.data.subscription.unsubscribe();
  console.log(
    "PASS: actual reset email, recovery event, new password, old password rejected, link replay rejected",
  );
  const codeClient = makeClient();
  const codeEmail = `wardrobe-auth-test-${randomUUID()}@example.test`;
  const codeSignup = success(
    await codeClient.auth.signUp({
      email: codeEmail,
      password,
      options: {
        data: { display_name: "Code User" },
        emailRedirectTo: redirect,
      },
    }),
    "code signup",
  );
  ids.push(codeSignup.user.id);
  const confirmationMail = await emailContent(codeEmail, "confirm");
  assert.ok(confirmationMail.code, "Email must include a confirmation code");
  assert.ok(
    (
      await codeClient.auth.verifyOtp({
        email: codeEmail,
        token: "bad-code",
        type: "signup",
      })
    ).error,
  );
  success(
    await codeClient.auth.verifyOtp({
      email: codeEmail,
      token: confirmationMail.code,
      type: "signup",
    }),
    "signup code verification",
  );
  success(
    await codeClient.auth.signOut({ scope: "local" }),
    "code user logout",
  );
  success(
    await codeClient.auth.resetPasswordForEmail(codeEmail),
    "code reset request",
  );
  const recoveryMail = await emailContent(codeEmail, "reset");
  assert.ok(recoveryMail.code, "Email must include a recovery code");
  let codeRecoveryEvent = false;
  const codeListener = codeClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") codeRecoveryEvent = true;
  });
  success(
    await codeClient.auth.verifyOtp({
      email: codeEmail,
      token: recoveryMail.code,
      type: "recovery",
    }),
    "recovery code verification",
  );
  assert.ok(codeRecoveryEvent);
  success(
    await codeClient.auth.updateUser({ password: `Code-${randomUUID()}!` }),
    "code password change",
  );
  codeListener.data.subscription.unsubscribe();
  console.log(
    "PASS: signup and recovery email codes, wrong code rejection, recovery routing event",
  );
  console.log("All local authentication integration checks passed.");
} finally {
  for (const client of clients) client.auth.stopAutoRefresh();
  // Only delete UUIDs created by this run. No service-role key enters the app or this test.
  const safeIds = ids.filter((id) => /^[0-9a-f-]{36}$/.test(id));
  if (safeIds.length)
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_sarrahs-wardrobe-app",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `delete from auth.users where id in (${safeIds.map((id) => `'${id}'`).join(",")});`,
      ],
      { stdio: "pipe" },
    );
  for (const id of mailboxIds)
    await fetch(`${mailbox}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: [id] }),
    });
}
