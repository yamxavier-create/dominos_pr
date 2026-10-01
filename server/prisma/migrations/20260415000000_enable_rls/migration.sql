-- Enable Row Level Security on all public tables.
-- No policies are defined, so PostgREST (anon/authenticated roles) cannot read or write.
-- Prisma connects as the table owner / postgres role and bypasses RLS, so app behavior is unchanged.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordReset" ENABLE ROW LEVEL SECURITY;
