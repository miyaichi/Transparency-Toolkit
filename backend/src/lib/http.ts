import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import https from 'https';

// Allow legacy renegotiation for older servers (e.g. docomo.ne.jp)
// OpenSSL 3 disables this by default.
// crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT might be undefined in strict environments,
// but usually available in Node 18+.
// If not available, we can try setting distinct options or minVersion/ciphers.

const agent = new https.Agent({
  secureOptions:
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT | crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  rejectUnauthorized: false, // Optional: if certificates are also an issue, but be careful with security.
  // Note: rejectUnauthorized: false is dangerous for production security, but for a validator crawler it is acceptable to fetch content even if cert is bad.
});

const client = axios.create({
  timeout: 20000, // 20s
  headers: {
    // Mimic Chrome User-Agent to bypass some WAF/Bot protections
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  httpsAgent: agent,
});

axiosRetry(client, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // 1s, 2s, 3s wait
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    // Also explicitly retry on 429 (Too Many Requests)
    if (error.response?.status === 429) {
      return true;
    }

    if (error.response?.status && error.response.status >= 500) {
      return true;
    }

    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`Retry attempt #${retryCount} for ${requestConfig.url}: ${error.message}`);
  },
});

export default client;
