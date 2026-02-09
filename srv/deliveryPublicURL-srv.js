/**
 * Utility module to generate public URLs for delivery verification links
 * Handles HTTPS enforcement and cloud deployment configurations
 */

module.exports = {
  /**
   * Generate a public-accessible verification URL
   * @param {Object} req - CAP request object with headers
   * @param {String} token - Verification token
   * @returns {String} Complete verify URL (HTTPS enforced in production)
   * 
   * Environment variables:
   * - PUBLIC_BASE_URL: [Cloud] Full base URL (e.g., https://my-app.cfapps.sap.hana.ondemand.com)
   * - NODE_ENV: Set to 'production' to enforce HTTPS
   */
  generatePublicUrl: (req, token) => {
    // Prefer configured public base URL (set in Cloud manifest/environment)
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (publicBaseUrl) {
    return `${publicBaseUrl}/service/deliveryTokenVerify/verifyToken?token=${token}`;
    }

    // Fall back to forwarded headers from cloud gateway/load-balancer
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:4004';

    // Enforce HTTPS in production
    const finalProtocol = process.env.NODE_ENV === 'production' 
      ? 'https' 
      : protocol;

    // Warn if non-HTTPS in production
    if (process.env.NODE_ENV === 'production' && finalProtocol !== 'https') {
      console.warn('[SECURITY] Non-HTTPS URL generated in production. Set PUBLIC_BASE_URL env var.');
    }

    return `${finalProtocol}://${host}/service/deliveryTokenVerify/verifyToken?token=${token}`;
  }
};
