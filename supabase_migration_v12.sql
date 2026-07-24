-- Migration v12: multi-select (até 2) em specific_weakness/focus_area/aim_difficulty
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- As colunas escalares existentes continuam recebendo a primeira escolha (retrocompat
-- total — admin stats e qualquer consulta legada não mudam). Estas 3 colunas novas
-- guardam o array completo (1 ou 2 valores) como texto JSON, ex: '["tracking","flick"]'.
-- Ver specs/SPEC-004-questionario-multiselect.md.

ALTER TABLE IF EXISTS questionnaire_results
  ADD COLUMN IF NOT EXISTS specific_weakness_multi TEXT,
  ADD COLUMN IF NOT EXISTS focus_area_multi        TEXT,
  ADD COLUMN IF NOT EXISTS aim_difficulty_multi    TEXT;
