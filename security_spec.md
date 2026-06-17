# Firestore Security Specification (Applet Dashboard)

## 1. Data Invariants
- An applet configuration document must always be associated with a valid Gmail/Google authenticated `uid` stored in `ownerId`.
- No user can read, list, delete, or update applet definitions that belong to another user's authenticated account (strict private isolation).
- Document paths must map precisely: `/applets/{appletId}` where `appletId` strictly matches the field `id` inside the resource.
- String fields must possess strict sizing boundaries to mitigate denial-of-wallet payload attacks (e.g., custom embedCode capped at 100KB, URL capped at 2083 characters).

---

## 2. The Dirty Dozen (Malicious Payloads)
The following payloads are explicitly designed to test boundaries and must be blocked with `PERMISSION_DENIED`.

1. **The Identity Hijack**: Creating an applet under another user's credentials.
   ```json
   { "id": "app123", "name": "Fake App", "category": "Util", "openMode": "iframe", "ownerId": "victim_uid" }
   ```
2. **The Anonymous Write**: Creating a record without being signed in (`request.auth == null`).
3. **The Size Exhaustion (Name)**: Injecting a 5MB string for the `name` field to inflate Firestore database storage.
4. **The Size Exhaustion (Description)**: Injecting a massive string in the description.
5. **The Unbounded Tag Flood**: Sending a list of 1,000 array elements under `tags`.
6. **The Shadow Field Injection**: Injecting administrative overrides (e.g. `isAdmin: true` or `isServerApproved: true`) that are outside the entity's blueprint.
7. **The ID Spoofing/Drift**: Setting the document ID path parameter as `app_abc` while the document body contains `id: "app_xyz"`.
8. **The Garbage ID Injection**: Attempting to poison paths with control/injectable characters (e.g., `/applets/../../../etc/passwd` or extremely long strings).
9. **The Arbitrary Mode Injection**: Passing an invalid enum string for `openMode` (e.g., `"openMode": "backdoor_shell"`).
10. **The Untyped Array Injector**: Injecting non-string types inside the tags list (e.g. `tags: [123, true, {}]`).
11. **The System Timestamp Hijack**: Bypassing server validation to forge custom historic creation dates via client payload manipulation.
12. **The Ghost Update**: Changing the `ownerId` of an existing applet post-creation to transfer/hijack ownership.

---

## 3. Security Hardening Blueprint
These constraints are tested and enforced in `firestore.rules`.
- Default deny: `match /{document=**} { allow read, write: if false; }`
- Rules Version: `2` (supporting list-isolation and set diffing).
- Explicit `get()` check validation when referencing relational data.
