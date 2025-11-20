const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');

/**
 * Utility functions for DocDex Catalyst backend
 */

class DocDexUtils {
    constructor() {
        this.app = null;
        this.datastore = null;
    }

    /**
     * Initialize Catalyst app instance
     */
    async initCatalyst(req) {
        if (!this.app) {
            this.app = catalyst.initialize(req);
            this.datastore = this.app.datastore();
        }
        return this.app;
    }

    /**
     * Get secret from Catalyst Secrets
     */
    async getSecret(secretName) {
        try {
            const secrets = this.app.secret();
            const secret = await secrets.getSecretValue(secretName);
            return secret.secret_value;
        } catch (error) {
            console.error(`Error fetching secret ${secretName}:`, error);
            throw new Error(`Failed to retrieve secret: ${secretName}`);
        }
    }

    /**
     * Validate Cliq user request
     */
    validateCliqUser(req) {
        const cliqUserId = req.headers['x-cliq-user-id'] || req.body.user?.id;
        const cliqOrgId = req.headers['x-cliq-org-id'] || req.body.org?.id;
        
        if (!cliqUserId || !cliqOrgId) {
            throw new Error('Invalid Cliq user context');
        }
        
        return { userId: cliqUserId, orgId: cliqOrgId };
    }

    /**
     * Generate secure token hash
     */
    generateTokenHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData, key) {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /**
     * Store user OAuth tokens securely
     */
    async storeUserTokens(userId, orgId, accessToken, refreshToken) {
        try {
            const table = this.datastore.table('user_tokens');
            const encryptionKey = await this.getSecret('TOKEN_ENCRYPTION_KEY');
            
            const tokenData = {
                user_id: userId,
                org_id: orgId,
                access_token: this.encrypt(accessToken, encryptionKey),
                refresh_token: this.encrypt(refreshToken, encryptionKey),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Check if user tokens already exist
            const existingTokens = await table.getRecords({
                where: [`user_id='${userId}' AND org_id='${orgId}'`]
            });

            if (existingTokens.length > 0) {
                // Update existing tokens
                const record = existingTokens[0];
                tokenData.updated_at = new Date().toISOString();
                await table.updateRecord(record.ROWID, tokenData);
                return record.ROWID;
            } else {
                // Insert new tokens
                const result = await table.insertRecord(tokenData);
                return result.ROWID;
            }
        } catch (error) {
            console.error('Error storing user tokens:', error);
            throw error;
        }
    }

    /**
     * Retrieve user OAuth tokens
     */
    async getUserTokens(userId, orgId) {
        try {
            const table = this.datastore.table('user_tokens');
            const encryptionKey = await this.getSecret('TOKEN_ENCRYPTION_KEY');
            
            const records = await table.getRecords({
                where: [`user_id='${userId}' AND org_id='${orgId}'`]
            });

            if (records.length === 0) {
                return null;
            }

            const record = records[0];
            return {
                accessToken: this.decrypt(record.access_token, encryptionKey),
                refreshToken: this.decrypt(record.refresh_token, encryptionKey),
                updatedAt: record.updated_at
            };
        } catch (error) {
            console.error('Error retrieving user tokens:', error);
            throw error;
        }
    }

    /**
     * Refresh OAuth token
     */
    async refreshOAuthToken(refreshToken) {
        try {
            const clientId = await this.getSecret('ZOHO_CLIENT_ID');
            const clientSecret = await this.getSecret('ZOHO_CLIENT_SECRET');
            
            const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`OAuth error: ${data.error}`);
            }

            return {
                accessToken: data.access_token,
                expiresIn: data.expires_in
            };
        } catch (error) {
            console.error('Error refreshing OAuth token:', error);
            throw error;
        }
    }

    /**
     * Make authenticated API request with token refresh
     */
    async makeAuthenticatedRequest(userId, orgId, url, options = {}) {
        let tokens = await this.getUserTokens(userId, orgId);
        
        if (!tokens) {
            throw new Error('User not authenticated. Please complete OAuth flow first.');
        }

        // Try request with current access token
        const requestOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                ...options.headers
            }
        };

        let response = await fetch(url, requestOptions);

        // If unauthorized, try to refresh token
        if (response.status === 401) {
            try {
                const refreshedTokens = await this.refreshOAuthToken(tokens.refreshToken);
                await this.storeUserTokens(userId, orgId, refreshedTokens.accessToken, tokens.refreshToken);
                
                // Retry request with new token
                requestOptions.headers['Authorization'] = `Bearer ${refreshedTokens.accessToken}`;
                response = await fetch(url, requestOptions);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                throw new Error('Authentication failed. Please re-authenticate.');
            }
        }

        return response;
    }

    /**
     * Extract text content from various file types
     */
    async extractTextFromFile(buffer, mimeType, filename) {
        try {
            switch (mimeType) {
                case 'application/pdf':
                    const pdfParse = require('pdf-parse');
                    const pdfData = await pdfParse(buffer);
                    return pdfData.text;

                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                case 'application/msword':
                    const mammoth = require('mammoth');
                    const docResult = await mammoth.extractRawText({ buffer });
                    return docResult.value;

                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                case 'application/vnd.ms-excel':
                    const XLSX = require('xlsx');
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    let text = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        text += XLSX.utils.sheet_to_txt(sheet) + '\n';
                    });
                    return text;

                case 'text/plain':
                    return buffer.toString('utf-8');

                case 'text/html':
                    const cheerio = require('cheerio');
                    const $ = cheerio.load(buffer.toString('utf-8'));
                    return $.text();

                default:
                    console.warn(`Unsupported file type: ${mimeType}`);
                    return '';
            }
        } catch (error) {
            console.error('Error extracting text from file:', error);
            return '';
        }
    }

    /**
     * Implement exponential backoff retry
     */
    async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Validate file size limits
     */
    validateFileSize(fileSize, maxSize = 50 * 1024 * 1024) { // 50MB default
        if (fileSize > maxSize) {
            throw new Error(`File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes`);
        }
    }

    /**
     * Sanitize and validate search query
     */
    sanitizeSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid search query');
        }
        
        // Remove potentially dangerous characters
        const sanitized = query.replace(/[<>\"'%;()&+]/g, '').trim();
        
        if (sanitized.length < 2) {
            throw new Error('Search query too short (minimum 2 characters)');
        }
        
        if (sanitized.length > 500) {
            throw new Error('Search query too long (maximum 500 characters)');
        }
        
        return sanitized;
    }

    /**
     * Generate response with consistent error handling
     */
    generateResponse(statusCode, data, message = null) {
        return {
            statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                success: statusCode >= 200 && statusCode < 300,
                data,
                message,
                timestamp: new Date().toISOString()
            })
        };
    }
}

module.exports = new DocDexUtils();