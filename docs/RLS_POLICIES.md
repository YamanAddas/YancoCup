# YancoCup — Supabase RLS Policy Audit

> Audited: April 11, 2026
> Project: `vxmopqjpqqdlkfceufru` (shared YancoVerse)

---

## yc_predictions

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Users see own or post-kickoff predictions | `auth.uid() = user_id OR kickoff_time <= now() OR scored_at IS NOT NULL` |
| INSERT | Users can insert own predictions | `auth.uid() = user_id` |
| UPDATE | Users can update own predictions | `auth.uid() = user_id` |

**Notes:**
- **Fixed April 11, 2026.** Previously `SELECT` was `true` for all authenticated — any user could read all predictions before kickoff.
- New policy requires `kickoff_time` column (added same date). Frontend passes it on upsert.
- `scored_at IS NOT NULL` fallback ensures leaderboard/activity feed works for already-scored predictions even if `kickoff_time` is missing.

---

## yc_pools

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Authenticated users can read pools | `auth.role() = 'authenticated'` |
| INSERT | Authenticated users can create pools | `auth.uid() = created_by` |
| UPDATE | Pool creator can update pool | `auth.uid() = created_by` |

**Notes:**
- SELECT is open to all authenticated users. This is intentional — needed for the join-by-code flow (user must look up a pool before becoming a member).
- No DELETE policy exists (pools are permanent).

---

## yc_pool_members

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Authenticated users can read pool members | `auth.role() = 'authenticated'` |
| INSERT | Users can join pools | `auth.uid() = user_id` |
| DELETE | Users can leave pools | `auth.uid() = user_id` |
| DELETE | Pool creator can remove members | `EXISTS (SELECT 1 FROM yc_pools WHERE id = pool_id AND created_by = auth.uid())` |

**Notes:**
- SELECT is open to all authenticated users. Needed for pool leaderboards (must see who's in a pool to compute standings).

---

## yc_pool_messages

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Pool members can read messages | `EXISTS (SELECT 1 FROM yc_pool_members WHERE pool_id = ... AND user_id = auth.uid())` |
| INSERT | Pool members can send messages | `auth.uid() = user_id AND EXISTS (... member check ...)` |

**Status: Correct.** Both read and write are member-gated.

---

## yc_articles

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Articles are publicly readable | `true` |
| INSERT | Only service role can insert articles | `auth.role() = 'service_role'` |
| UPDATE | Only service role can update articles | `auth.role() = 'service_role'` |

**Status: Correct.** Public read, service-role write only.

---

## yc_badges

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Badges are public | `true` |

**Status: Correct.** Read-only catalog, no write policies for non-service-role.

---

## yc_user_badges

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | User badges are public | `true` |
| INSERT | Users can earn badges | `auth.uid() = user_id` |

**Notes:**
- INSERT allows client-side badge awarding. This is a consequence of the accepted client-side scoring architecture.
- FK constraint `yc_user_badges_badge_id_fkey` limits inserts to valid badge IDs from `yc_badges`.
- Risk: a user could self-award all 19 badges. Accepted at current scale.

---

## yc_streaks

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Anyone can read streaks | `true` |
| INSERT | Users can insert own streaks | `auth.uid() = user_id` |
| UPDATE | Users can update own streaks | `auth.uid() = user_id` |

**Notes:**
- Client-writable. Same accepted risk as client-side scoring.
- A motivated user could set `current_streak` and `best_streak` to arbitrary values.

---

## yc_reactions

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Authenticated users can read reactions | `true` (authenticated) |
| INSERT | Users can insert own reactions | `auth.uid() = user_id` |
| DELETE | Users can delete own reactions | `auth.uid() = user_id` |

**Status: Correct.**

---

## yc_competitions

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | Anyone can read competitions | `true` |

**Status: Correct.** Read-only catalog.

---

## yc_comments

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | anyone_can_read_comments | `true` |
| INSERT | auth_users_can_insert_comments | `auth.uid() = user_id` |
| UPDATE | users_can_update_own_comments | `auth.uid() = user_id` |
| DELETE | users_can_delete_own_comments | `auth.uid() = user_id` |

**Status: Correct.**

---

## yc_comment_votes

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | anyone_can_read_votes | `true` |
| INSERT | auth_users_can_vote | `auth.uid() = user_id` |
| DELETE | users_can_unvote | `auth.uid() = user_id` |

**Status: Correct.**

---

## yc_comment_reports

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| INSERT | auth_users_can_report | `auth.uid() = reporter_id` |

**Status: Correct.**

---

## profiles_public

| Operation | Policy Name | Expression |
|-----------|-------------|------------|
| SELECT | profiles_public_select_shared_room | `private.can_read_profile_handle(auth.uid(), id)` |

**Notes:**
- Uses a private helper function. This is from the shared YancoVerse project (rooms/lounge), not YancoCup-specific.
- YancoCup queries `profiles_public` for display names on leaderboard/rivals. If users are not in a shared room, their display names may not be visible.
- **Potential gap:** Leaderboard may show blank names for users not in a shared room. Worth monitoring.

---

## Accepted risks (documented)

1. **Client-side scoring** — `yc_predictions.points`, `yc_streaks`, `yc_user_badges` are all client-writable. A motivated user could manipulate scores. Accepted at friend-group scale.
2. **Pool visibility** — All authenticated users can see all pools and members. Needed for join flow and leaderboards.
3. **profiles_public function gate** — May restrict display name visibility in unexpected ways for YancoCup-specific views.
