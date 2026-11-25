# Security Specification: OPay Banking Firestore Rules

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`private`, `transactions`, `savingsGoals`, `cards`, `notifications`) MUST belong exclusively to the authenticated, email-verified user whose `request.auth.uid == userId` and `data.ownerId == request.auth.uid`.
2. **PII Isolation**: Sensitive fields (`fullName`, `phone`, `accountNumber`, `email`, `pin`, `bvnVerified`, `ninVerified`) live strictly under `/users/{userId}/private/{docId}` (`docId == 'info'`) and are readable/writable only by the verified owner.
3. **Immutable Audit Trail**: Transactions are append-only (`allow update, delete: if false;`) and terminal status cannot be tampered with once created.
4. **Master Gate**: Subcollection reads/writes require the parent `/users/{userId}` wallet document to exist (except during initial onboarding batch creation using `existsAfter`) and match `ownerId == request.auth.uid`.
5. **Server Timestamps & Bounded Fields**: Every `createdAt` / `updatedAt` field MUST equal `request.time`, and every string field enforces explicit `.size()` boundaries.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Wallet Read**: `get(/users/userA)` with `auth = null`.
2. **Unverified Email Write**: `create(/users/userA)` with `auth.uid = 'userA'` and `email_verified = false`.
3. **Cross-User PII Snooping**: `get(/users/userA/private/info)` with `auth.uid = 'userB'`.
4. **Identity Spoofing on Create**: `create(/users/userA/transactions/tx1)` with `ownerId = 'userB'` while signed in as `userA`.
5. **Shadow / Ghost Field Injection**: `create(/users/userA)` including unexpected field `isAdmin: true`.
6. **Privilege Escalation on Update**: `update(/users/userA)` changing `tier` or `ownerId` or `createdAt`.
7. **Transaction Tampering**: `update(/users/userA/transactions/tx1)` modifying `amount` from `1000` to `1`.
8. **Transaction Deletion**: `delete(/users/userA/transactions/tx1)`.
9. **ID Poisoning**: `create(/users/userA/cards/invalid$id#123)` with non-alphanumeric ID characters or >128 chars.
10. **String Resource Exhaustion**: `create(/users/userA/savingsGoals/g1)` with 50KB `title` string.
11. **Client Timestamp Forgery**: `create(/users/userA/transactions/tx1)` with client-supplied past timestamp instead of `request.time`.
12. **Blanket List Query**: `list(/users)` as any authenticated user.
