export async function sqlServerConnection() {
  const windowsAuth = process.env.SQL_AUTH === 'windows';
  const sql = (await import(windowsAuth ? 'mssql/msnodesqlv8.js' : 'mssql')).default;
  const config = {
    server: process.env.SQL_SERVER || 'localhost',
    port: Number(process.env.SQL_PORT || 1433),
    database: process.env.SQL_DATABASE || 'teamup',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    connectionTimeout: 5000,
    options: {
      encrypt: process.env.SQL_ENCRYPT !== 'false',
      trustedConnection: windowsAuth,
      trustServerCertificate: process.env.SQL_TRUST_CERTIFICATE === 'true',
    },
  };
  if (windowsAuth) {
    config.driver = process.env.SQL_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';
    config.beforeConnect = connection => {
      connection.conn_str += `;TrustServerCertificate=${config.options.trustServerCertificate ? 'Yes' : 'No'};`;
    };
  }
  return { sql, config };
}
