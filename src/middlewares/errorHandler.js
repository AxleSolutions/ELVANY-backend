export function errorHandler(err, req, res, next) {
  console.error('[Maison Backend Error]:', err);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal atelier server error.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
