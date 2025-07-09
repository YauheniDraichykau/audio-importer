export const randomString = (l = 64) =>
  [...crypto.getRandomValues(new Uint8Array(l))]
    .map((b) => ("0" + (b & 255).toString(16)).slice(-2))
    .join("");

export async function pkcePair() {
  const verifier = randomString(64);
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge: b64 };
}
