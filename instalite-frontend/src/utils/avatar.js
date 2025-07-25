// instalite‑frontend/src/utils/avatar.js
//
// Central helper that turns whatever we know about the user
// into a URL the <img/> tag can actually load.
//

/**
 * @param {string|null|undefined} profileImageUrl  value coming from the DB
 * @param {string}                handle           e.g. “@bluesky_foo”
 * @returns {string}  absolute URL that the browser can load
 */
export function resolveAvatar(profileImageUrl, handle) {
  /* 1) did we already store a real picture for this user? */
  if (profileImageUrl) {
    // absolute URL → leave as‑is
    if (/^https?:\/\//i.test(profileImageUrl)) return profileImageUrl;
    // relative path coming from the backend
    return `http://localhost:3030${profileImageUrl}`;
  }

  /* 2) otherwise pick a default based on the username prefix */
  if (handle.startsWith("@bluesky_"))   return "/bluesky.png";
  if (handle.startsWith("@federated_")) return "/federated.png";

  /* 3) plain placeholder */
  return "/placeholder_profile_picture.png";
}