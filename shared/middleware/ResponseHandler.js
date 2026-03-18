/**
 * Response Helper Middleware
 * Adds utility methods to the response object for consistent API responses
 */
const responseHelper = (req, res, next) => {
  /**
   * Send a success response
   * @param {Object} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  res.success = (data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Send an error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   */
  res.error = (message = "An error occurred", code = "INTERNAL_ERROR", statusCode = 500, details = null) => {
    const response = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  };

  /**
   * Send a paginated response
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination info
   */
  res.paginated = (data, pagination) => {
    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      },
      timestamp: new Date().toISOString(),
    });
  };

  next();
};

module.exports = {
  responseHelper,
};
