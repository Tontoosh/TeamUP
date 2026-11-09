// Support the current package export and the older offline lab installation.
export async function readCsv(source, options) {
  let parse;
  try {
    ({ parse } = await import('csv-parse/sync'));
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED')
      throw error;
    const legacy = await import('csv-parse/lib/sync.js');
    parse = legacy.default;
  }
  return parse(source, options);
}
