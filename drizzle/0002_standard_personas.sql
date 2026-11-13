-- Standard personas (user_id = NULL). Placeholder copy: swap text here or in a
-- later migration. Fixed UUIDs + ON CONFLICT DO NOTHING keep re-runs idempotent.
-- Voice IDs are the ElevenLabs stock voices picked in H2 (#2).
INSERT INTO "personas" ("id", "user_id", "name", "bio", "avatar_key", "elevenlabs_voice_id", "reader_description")
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    NULL,
    'The Skeptic',
    'A peer who spots humblebrags and vague claims.',
    'skeptic',
    'Myb1gsDenT3mlMlj7vib',
    'A sharp, slightly sarcastic peer in your industry. Quick to notice humblebrags, buzzwords, and claims with nothing behind them.'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    NULL,
    'The Scroller',
    'A busy reader who only gets your first line.',
    'scroller',
    'U9ZSDp7XmjKuLG6QS1Em',
    'A busy, friendly reader skimming a feed. Decides in the first line whether to keep reading and rarely makes it to the end.'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    NULL,
    'The Fan',
    'A warm supporter who tells you what works.',
    'fan',
    'w4DBBAtZhQtfCihqCw5b',
    'An upbeat, supportive follower who wants you to do well. Points out what lands and what they would share.'
  )
ON CONFLICT ("id") DO NOTHING;
