BEGIN;

-- DOZESTICKER Sprint 02 seed.
-- Seed only the initial collection and album. No stickers are inserted here.

WITH collection_upsert AS (
  INSERT INTO dozesticker.collections (
    slug,
    name,
    description,
    cover_image,
    year,
    status
  )
  VALUES (
    'copa-do-mundo',
    'Copa do Mundo',
    'Colecao base para albuns da Copa do Mundo.',
    NULL,
    2026,
    'active'
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    year = EXCLUDED.year,
    status = EXCLUDED.status
  RETURNING id
)
INSERT INTO dozesticker.albums (
  collection_id,
  slug,
  name,
  edition,
  country,
  language,
  total_stickers,
  release_date,
  status
)
SELECT
  id,
  'copa-do-mundo-2026',
  'Copa do Mundo 2026',
  '2026',
  NULL,
  'pt-BR',
  0,
  NULL,
  'active'
FROM collection_upsert
ON CONFLICT (slug) DO UPDATE
SET
  collection_id = EXCLUDED.collection_id,
  name = EXCLUDED.name,
  edition = EXCLUDED.edition,
  language = EXCLUDED.language,
  status = EXCLUDED.status;

COMMIT;
