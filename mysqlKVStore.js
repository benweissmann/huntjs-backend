function errorIsDuplicateKeyError(err) {
  return err.code === 'ER_DUP_ENTRY';
}

module.exports = function createMysqlKVStore({ tableName, keyColumn, valueColumn }) {
  function get(mysqlPool, key, opts) {
    const defaultValue = opts ? opts.defaultValue : undefined;

    return new Promise((resolve, reject) => {
      mysqlPool.query(`SELECT data FROM ${tableName} WHERE ${keyColumn} = ?`, [key], (selectErr, results) => {
        if (selectErr) {
          reject(selectErr);
          return;
        }

        if (results.length > 0) {
          resolve(JSON.parse(results[0].data));
          return;
        }

        if (!defaultValue) {
          resolve();
          return;
        }

        // Try to save default values back to the DB
        mysqlPool.query(`INSERT INTO ${tableName} SET ?`, [
          { [keyColumn]: key, [valueColumn]: JSON.stringify(defaultValue) },
        ], (insertErr) => {
          if (insertErr) {
            if (errorIsDuplicateKeyError(insertErr)) {
              // someone else beat us to it! re-query for the applied default
              // values
              get(defaultValue).then(resolve, reject);
              return;
            }

            // it was some other error
            reject(insertErr);
            return;
          }

          // we inserted successfully
          resolve(defaultValue);
        });
      });
    });
  }

  function set(mysqlPool, key, newValue) {
    return new Promise((resolve, reject) => {
      mysqlPool.query(`UPDATE ${tableName} SET ? WHERE ${keyColumn} = ?`, [
        { data: JSON.stringify(newValue) },
        key,
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function initDB(mysqlPool) {
    mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`${keyColumn}\` varchar(128) COLLATE utf8mb4_bin NOT NULL,
        \`${valueColumn}\` text COLLATE utf8mb4_bin,
        PRIMARY KEY (\`${keyColumn}\`)
      ) ENGINE=InnoDB
  `, (err) => {
      if (err) {
        console.error(err, 'Error initializing database');
      }
    });
  }

  return { get, set, initDB };
};
