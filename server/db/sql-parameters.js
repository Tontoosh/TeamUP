// ODBC internally reserves @P1, @P2, ... for positional values. SQL Server
// identifiers are case-insensitive, so application parameters must avoid @pN.
export function bindSqlParameters(request, sql, params) {
  let index = 0;
  const prepared = sql.replace(/\?/g, () => `@teamup_arg_${index++}`);
  if (index !== params.length) throw new Error('SQL parameter count does not match values');
  params.forEach((value, i) => request.input(`teamup_arg_${i}`, value));
  return prepared;
}
