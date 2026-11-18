# Security Specification — Luna Numérica Firestore Rules

## 1. Data Invariants
1. Default-deny catch-all (`match /{document=**} { allow read, write: if false; }`) at the top of `match /databases/{database}/documents`.
2. Users cannot read or list other users' PII (`/users/{userId}` `get` restricted to `isOwner || isAdmin`, `list` restricted to `isAdmin`).
3. Users cannot escalate privileges (`role: 'admin'`) or self-activate (`accessStatus: 'active'`) without either an admin write or an atomic `writeBatch` redeeming a verified `'unused'` code in `/accessCodes/{codeId}` validated with `get()` + `getAfter()`.
4. Financial workspaces (`/users/{userId}/businesses/{businessId}`) are strictly isolated to `ownerUid == userId == request.auth.uid` AND require `accessStatus == 'active'` (or `isAdmin()`), with strict payload key & size limits.
5. Admin collections (`/adminLogs`, `/admins`, `/appConfig` writes, `/faqs` writes, `/accessCodes` list/create) require `isAdmin()` verified server-side via `request.auth.token.email_verified == true` + bootstrapped email or `/admins/{uid}` document lookup.
6. Public FAQs list/get enforces `existing().published == true || isAdmin()` at rule level.
7. Timestamps (`createdAt`, `updatedAt`, `usedAt`) enforce `== request.time` on creation/update and immutability of `createdAt` and `ownerUid`/`uid`.
8. Support tickets (`/supportTickets/{ticketId}`) validate `ticketType in ['duda', 'sugerencia']`, force `status == 'nuevo'` without `adminReply` on creation, and restrict replies/resolutions/reads across users to `isAdmin()` (bootstrapped for verified `jose.growy@gmail.com`).

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: New user tries `create /users/{uid}` with `role: "admin"`, `accessStatus: "active"`.
2. **Self-Activation Bypass**: Pending user tries `update /users/{uid}` changing `accessStatus: "active"` without redeeming an unused code.
3. **Reuse Consumed Access Code**: User tries `writeBatch` redeeming an `/accessCodes/{codeId}` whose `status` is already `"used"` or `"revoked"`.
4. **Access Code Enumeration**: Non-admin user tries `list /accessCodes`.
5. **PII Scraping**: Non-admin user tries `list /users` or `get /users/{otherUid}`.
6. **Cross-Tenant Business Read/Write**: User A tries `get` or `create` on `/users/{userB}/businesses/{bizId}`.
7. **Shadow Field Injection**: User creates business or profile with extra unapproved key `isPremiumOverride: true`.
8. **Pending User Writing Financial Data**: User with `accessStatus: "pending"` tries to `create /users/{uid}/businesses/{bizId}`.
9. **Spoofed Unverified Email Admin**: Attacker with `email: "jose.growy@gmail.com"` and `email_verified: false` attempts `update /appConfig/public`.
10. **Unpublished FAQ Scraping**: Unauthenticated or standard user tries `list /faqs` without `where('published', '==', true)` or reads `published: false`.
11. **Oversized ID Poisoning**: Attacker targets `/faqs/{200-char-id}` or `/users/{uid}/businesses/{bad!id}`.
12. **Audit Log Tampering**: Even an admin tries `update` or `delete` on `/adminLogs/{logId}`.
