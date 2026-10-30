-- Executed once by the postgres image on an empty data directory.
-- Two roles:
--   cognitest      owner: runs migrations (DDL), bypasses RLS as table owner
--   cognitest_app  runtime role of PHP-FPM and workers: subject to RLS
-- Passwords come from the container environment via psql variables.

\set owner_password `echo "$COGNITEST_OWNER_PASSWORD"`
\set app_password `echo "$COGNITEST_APP_PASSWORD"`

CREATE ROLE cognitest LOGIN PASSWORD :'owner_password';
CREATE ROLE cognitest_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT cognitest_app TO cognitest;

CREATE DATABASE cognitest OWNER cognitest ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;

\connect cognitest
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO cognitest;
GRANT USAGE ON SCHEMA public TO cognitest_app;
-- Tables created later by migrations become usable by the runtime role.
ALTER DEFAULT PRIVILEGES FOR ROLE cognitest IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cognitest_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cognitest IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cognitest_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cognitest IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO cognitest_app;
