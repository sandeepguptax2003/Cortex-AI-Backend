const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3_CONFIG } = require("../config/Constants");

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_CONFIG.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * S3 Service for file operations
 */
const S3Service = {
  /**
   * Upload a file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} key - S3 object key
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} - S3 URL
   */
  async uploadFile(fileBuffer, key, contentType) {
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
  },

  /**
   * Upload a profile picture
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} userId - User ID
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} - S3 URL
   */
  async uploadProfilePicture(fileBuffer, userId, contentType) {
    const extension = contentType.split("/")[1] || "jpg";
    const key = `${S3_CONFIG.profilePicturesPrefix}${userId}-${Date.now()}.${extension}`;
    return this.uploadFile(fileBuffer, key, contentType);
  },

  /**
   * Upload a transcript file
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<string>} - S3 URL
   */
  async uploadTranscript(fileBuffer, meetingId) {
    const key = `${S3_CONFIG.transcriptsPrefix}${meetingId}-${Date.now()}.txt`;
    return this.uploadFile(fileBuffer, key, "text/plain");
  },

  /**
   * Get a signed URL for downloading a file
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  },

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key
   */
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });

    await s3Client.send(command);
  },

  /**
   * Extract key from S3 URL
   * @param {string} url - S3 URL
   * @returns {string} - Object key
   */
  extractKeyFromUrl(url) {
    const match = url.match(/amazonaws\.com\/(.+)$/);
    return match ? match[1] : null;
  },
};

module.exports = {
  s3Client,
  S3Service,
};
