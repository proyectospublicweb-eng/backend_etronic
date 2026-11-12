-- =====================================================================
-- ETRONIC — Permisos completos sobre Tablas y Secuencias SERIAL (PostgreSQL cPanel)
-- Ejecutar en phpPgAdmin sobre la base de datos: finlexprimecom_etronic
-- Soluciona: "permission denied for sequence chat_conversaciones_idconversacion_seq"
-- =====================================================================

GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO PUBLIC;
