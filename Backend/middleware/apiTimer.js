/**
 * Middleware to measure API execution time.
 * Logs all API execution times and prints a warnings for endpoints slower than 50ms.
 */
const apiTimer = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = parseFloat((diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2));

    const logMsg = `${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Time: ${durationMs}ms`;
    
    if (durationMs > 50) {
      console.warn(`⚠️ [SLOW API WARNING] ${logMsg}`);
    } else {
      console.log(`⚡ [PERF] ${logMsg}`);
    }
  });

  next();
};

module.exports = apiTimer;
