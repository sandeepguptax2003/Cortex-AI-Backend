const requestLogger = (req, res, next) => {
  next();
};

const logger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
};

module.exports = {
  requestLogger,
  logger,
};
