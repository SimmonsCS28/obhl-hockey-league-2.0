# Member polls (#35)

The Huddle lives near the top of `/dashboard`, with a League Polls link in the dashboard navigation. Any active signed-in account can vote; no player registration or specific role is required. Polls are league-wide, independent of the season selector.

- Each account has one vote per poll and may change that choice while it is open.
- Results show aggregate counts, percentages, and the viewer's own choice. No voter identities are returned. The database retains account IDs to enforce the one-vote rule; these are not anonymous ballots.
- ADMIN accounts can publish polls with 2–8 distinct choices, an optional description, and an optional closing time. They can also close a poll early with an inline confirmation.
- Published questions/choices are immutable. Closed polls cannot be reopened or voted on and appear under Final results.
- Data refreshes every 30 seconds; vote and close responses update immediately. The list includes the latest 100 polls.

## Backend and migration

Apply `database/migrations/069_create_member_polls.sql` before starting the updated gateway. This creates three additive tables; there is no data backfill. The gateway owns `/api/v1/polls`:

| Method | Path | Access |
| --- | --- | --- |
| GET | `/polls` | Active authenticated account |
| POST | `/polls` | ADMIN; question, description, options, optional ISO closesAt |
| PUT | `/polls/{id}/vote` | Active authenticated account; optionId only |
| POST | `/polls/{id}/close` | ADMIN |

The authenticated username resolves to the database account; caller-supplied user IDs are ignored. A primary key on `(poll_id, user_id)` and PostgreSQL upsert prevent duplicate votes. A composite foreign key prevents choosing another poll's option. Vote and close transactions lock the same poll row, and voting checks both manual closure and the scheduled deadline after acquiring the lock.

## Local preview

The development preview uses port 5174 and a separate polling gateway on port 8004. The leaderboard preview on port 5173 remains independent. From `frontend` with Node 20.19+:

```sh
npm ci
OBHL_API_PROXY_TARGET=http://127.0.0.1:8004 npx vite --host 127.0.0.1 --port 5174 --strictPort
```

Sign in normally and open `/dashboard#polls`. Without the override, Vite continues to proxy to port 8000. Local demo accounts and passwords are not committed. Never seed demo accounts into a shared or production database.

## Checks

Run `./gradlew test` in `backend/api-gateway`; the polling tests cover HTTP authentication/role gates, trusted vote identity, inactive/deleted accounts, duplicate choices, and invalid input. Run `npx eslint src/components/user/polls/MemberPolls.jsx` and `npx vite build` in `frontend`.

For browser validation: sign out and open the dashboard; sign in as a member, vote, change the vote, and reload; verify the vote count does not grow on resubmission. As an admin, create a poll, check invalid choices, and close voting. The closed poll must show results without voting controls. Check a second account has an independent ballot.

Validated locally with 68 passing gateway tests (including 8 new polling tests), a successful frontend build, and targeted ESLint. Live PostgreSQL/API checks covered unauthenticated access, member/admin permissions, cross-poll options, authenticated vote identity, repeated and concurrent votes, independent member ballots, privacy of the response, manual closing, and scheduled cutoff. Desktop and mobile browser checks covered creating, voting, changing/reloading a vote, and closing a poll.
