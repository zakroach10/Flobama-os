#!/usr/bin/env node
/**
 * Offline helper notes for backfilling media_content_hashes.
 *
 * Full automated backfill needs SUPABASE_SERVICE_ROLE_KEY + Storage list/download,
 * which pulls egress. Prefer:
 * 1. Apply 20261013000040_media_content_hashes.sql
 * 2. Let new uploads populate hashes via Screens upload paths
 * 3. Run a controlled off-peak Storage walk only for assets still missing sha256
 *
 * This script prints the SQL/checklist rather than downloading media by default.
 */

const checklist = `
FloBama media hash backfill checklist
=====================================

1. Apply migration:
   supabase/migrations/20261013000040_media_content_hashes.sql

2. New uploads (vertical ads + LED media) now write sha256 when the browser can hash the file.

3. For existing objects, query gaps:
   select asset_kind, count(*) from media_content_hashes where sha256 is null group by 1;
   -- plus assets present in screen_ads / led_wall_scenes with no hash row

4. Off-peak: download each missing storage_path once, sha256, upsert media_content_hashes.
   Budget against the org cached-egress allowance (see docs/bandwidth-optimization-plan.md).

5. Do not point production OBS back at hosted /display/led while backfilling large libraries.
`;

process.stdout.write(checklist);
