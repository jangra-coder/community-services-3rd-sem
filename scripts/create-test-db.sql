-- Runs once when the docker-compose PostgreSQL volume is first created.
-- Gives the test-suite its own empty database.
CREATE DATABASE eventpass_test OWNER eventpass;
