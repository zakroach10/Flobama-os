-- Guess the Player and Guess the Lyric tool kinds.
-- New enum values cannot be used in the same transaction that adds them,
-- so the submissions table and claim function live in the next migration.

alter type public.audience_tool_kind add value if not exists 'guess_player';
alter type public.audience_tool_kind add value if not exists 'guess_lyric';
