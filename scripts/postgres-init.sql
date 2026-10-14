-- psql variables are quoted as identifiers/literals; credentials come only from Docker env.
\getenv runtime_user APP_DB_USER
\getenv runtime_password APP_DB_PASSWORD
\getenv app_database POSTGRES_DB
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime_user') AS create_role \gset
\if :create_role
CREATE ROLE :"runtime_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'runtime_password';
\endif
ALTER ROLE :"runtime_user" NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER DATABASE :"app_database" OWNER TO :"runtime_user";
