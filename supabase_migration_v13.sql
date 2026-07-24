-- Migration v13: rastrear a última transição de nível do goal_levels (mata-mata)
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- goal_levels.updated_at já só é tocado quando o nível muda de verdade (ver
-- level_service.resolve_action_level) — o que falta é saber DE ONDE ele mudou,
-- pra derivar a direção (subiu/desceu) no card "Nível de mata-mata" do dashboard.
-- Sem essa coluna, o histórico "subiu/desceu por último quando" não é derivável.
-- Ver specs/SPEC-006-historico-e-dashboard.md.

ALTER TABLE IF EXISTS goal_levels
  ADD COLUMN IF NOT EXISTS previous_level INT
    CHECK (previous_level IS NULL OR previous_level BETWEEN 1 AND 5);
