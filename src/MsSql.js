/**
 * @author David Menger
 */
'use strict';

const mssql = require('mssql');
const path = require('path');
const Migrate = require('./Migrate');


class MsSql {

    /**
     *
     * @param {object} config
     * @param {string} config.user
     * @param {string|Promise<string>} config.password;
     * @param {string} config.server
     * @param {number} config.port
     * @param {string} config.database
     * @param {object} config.options
     * @param {object} [config.mssql]
     * @param {Function} [config.pool]
     * @param {string} [config.wingbotMigrationsTable]
     * @param {string} [config.wingbotSkipMigrations]
     * @param {object} config.options
     * @param {boolean} config.options.encrypt
     * @param {string|null} migrationsDir
     * @param {console} log
     */
    constructor (config, migrationsDir = null, log = console) {
        this._config = config;
        this._migrationsDir = migrationsDir || path.resolve(__dirname, '..', 'migrations');
        this._migrationsTable = config.wingbotMigrationsTable || undefined;
        this._skipMigrations = config.wingbotSkipMigrations || false;
        this._log = log;

        this._mssql = config.mssql || mssql;

        this._pool = null;
    }

    async _createConnectionPool () {
        try {
            let { pool = null } = this._config;

            if (!pool) {
                let config;
                if (this._config.password instanceof Promise) {
                    const password = await this._config.password;
                    config = {
                        ...this._config,
                        password
                    };
                } else {
                    config = this._config;
                }

                // @ts-ignore
                const cp = new this._mssql.ConnectionPool(config);

                cp.on('error', (err) => {
                    this._log.error('MSSQL ERROR', err);
                });

                pool = cp.connect();
            }

            const connection = await pool;

            if (!this._skipMigrations) {
                const migrate = new Migrate(pool, this._migrationsDir, this._migrationsTable);
                await migrate.migrate();
            }

            return connection;
        } catch (e) {
            this._log.error('MSSQL ERROR', e);
            await new Promise((r) => setTimeout(r, 400));
            process.exit(1);
            throw e;
        }
    }

    /**
     * Get connection pool for storages
     *
     * @returns {Promise<mssql.ConnectionPool>}
     */
    connection () {
        if (!this._pool) {
            this._pool = this._createConnectionPool();
        }
        return this._pool;
    }

}

module.exports = MsSql;
