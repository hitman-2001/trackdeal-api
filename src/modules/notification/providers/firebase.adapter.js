'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let cachedAccessToken = null;
let cachedTokenExpiry = 0;

class FirebaseAdapter {
  constructor(config = {}) {
    this.projectId = config.projectId || process.env.FCM_PROJECT_ID || 'trackdeal-d0227';
    this.serviceAccountConfig =
      config.serviceAccount ||
      process.env.FCM_SERVICE_ACCOUNT_JSON ||
      process.env.FCM_SERVICE_ACCOUNT_PATH ||
      null;
    this._parsedServiceAccount = null;
  }

  _loadServiceAccount() {
    if (this._parsedServiceAccount) return this._parsedServiceAccount;

    // 1. Direct object passed in config
    if (typeof this.serviceAccountConfig === 'object' && this.serviceAccountConfig !== null) {
      this._parsedServiceAccount = this.serviceAccountConfig;
      return this._parsedServiceAccount;
    }

    // 2. Base64 candidate
    const base64Candidate =
      process.env.FCM_SERVICE_ACCOUNT_BASE64 ||
      (typeof this.serviceAccountConfig === 'string' &&
      !this.serviceAccountConfig.startsWith('{') &&
      !this.serviceAccountConfig.endsWith('.json') &&
      this.serviceAccountConfig.length > 500
        ? this.serviceAccountConfig
        : null);
    if (base64Candidate) {
      try {
        const decoded = Buffer.from(base64Candidate.trim(), 'base64').toString('utf8');
        this._parsedServiceAccount = JSON.parse(decoded);
        return this._parsedServiceAccount;
      } catch (err) {
        // Fall through
      }
    }

    // 3. Raw JSON string candidate
    if (typeof this.serviceAccountConfig === 'string' && this.serviceAccountConfig.trim().startsWith('{')) {
      try {
        this._parsedServiceAccount = JSON.parse(this.serviceAccountConfig);
        return this._parsedServiceAccount;
      } catch (err) {
        // Fall through
      }
    }

    // 4. File path resolution candidates
    const candidatePaths = [];
    if (typeof this.serviceAccountConfig === 'string' && this.serviceAccountConfig.trim()) {
      candidatePaths.push(
        path.resolve(this.serviceAccountConfig.trim()),
        path.resolve(process.cwd(), this.serviceAccountConfig.trim()),
        path.resolve(process.cwd(), 'trackdeal-api', this.serviceAccountConfig.trim()),
      );
    }

    const knownFileNames = [
      'firebase-service-account.json',
      'service-account.json',
      'trackdeal-service-account.json',
    ];

    for (const name of knownFileNames) {
      candidatePaths.push(
        path.resolve(process.cwd(), name),
        path.resolve(process.cwd(), 'trackdeal-api', name),
        path.resolve(__dirname, '../../../../', name),
      );
    }

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this._parsedServiceAccount = JSON.parse(content);
          return this._parsedServiceAccount;
        } catch (err) {
          // Continue to next candidate
        }
      }
    }

    return null;
  }

  _signJwtRs256(payload, privateKeyPem) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    signer.end();
    const signature = signer.sign(privateKeyPem).toString('base64url');
    return `${data}.${signature}`;
  }

  async _getAccessToken(serviceAccount) {
    const nowMs = Date.now();
    if (cachedAccessToken && nowMs < cachedTokenExpiry - 60000) {
      return cachedAccessToken;
    }

    const nowSec = Math.floor(nowMs / 1000);
    const tokenPayload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    };

    const privateKey = (serviceAccount.private_key || '').replace(/\\n/g, '\n');
    const signedJwt = this._signJwtRs256(tokenPayload, privateKey);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google OAuth2 token exchange failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    cachedTokenExpiry = nowMs + ((data.expires_in || 3600) * 1000);
    return cachedAccessToken;
  }

  mapPayload(notification) {
    if (notification.registration_ids && notification.notification) {
      return notification;
    }
    const tokens = notification.recipient?.deviceTokens || [];
    const imageUrl =
      notification.payload?.imageUrl ||
      notification.payload?.image ||
      notification.notification?.image ||
      null;

    return {
      registration_ids: tokens,
      notification: {
        title: notification.payload?.title || notification.payload?.subject || notification.title || 'TrackDeal Notification',
        body: notification.payload?.message || notification.payload?.plainText || notification.message || '',
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      data: {
        correlationId: notification.correlationId || '',
        notificationId: notification.notificationId || notification.id || '',
        actionUrl: notification.actionUrl || notification.payload?.actionUrl || '/',
        ...(imageUrl ? { imageUrl, image: imageUrl } : {}),
      },
    };
  }

  async send(mappedPayload) {
    const rawTokens = mappedPayload?.registration_ids || [];
    const tokens = (Array.isArray(rawTokens) ? rawTokens : [rawTokens]).filter(
      (t) => typeof t === 'string' && t.trim().length > 0
    );

    if (tokens.length === 0) {
      return {
        providerMessageId: 'skipped-empty-tokens',
        status: 'SKIPPED',
        metadata: { info: 'No registration tokens provided' },
      };
    }

    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return {
        providerMessageId: `msg-fcm-${Math.random().toString(36).substr(2, 9)}`,
        status: 'SUCCESS',
        metadata: { info: 'Mock Firebase Push delivery success' },
      };
    }

    const serviceAccount = this._loadServiceAccount();
    if (!serviceAccount || !serviceAccount.private_key || !serviceAccount.client_email) {
      return {
        providerMessageId: 'msg-fcm-mock',
        status: 'SKIPPED',
        metadata: { info: 'FCM Service Account not configured' },
      };
    }

    const projectId = serviceAccount.project_id || this.projectId || 'trackdeal-d0227';
    const accessToken = await this._getAccessToken(serviceAccount);

    // Sanitize data values so they are all strings per FCM HTTP v1 spec
    const sanitizedData = {};
    if (mappedPayload.data && typeof mappedPayload.data === 'object') {
      for (const [k, v] of Object.entries(mappedPayload.data)) {
        if (v !== undefined && v !== null) {
          sanitizedData[k] = String(v);
        }
      }
    }

    const title = mappedPayload.notification?.title || 'TrackDeal';
    const body = mappedPayload.notification?.body || '';

    let validImageUrl = null;
    const rawImageUrl = mappedPayload.notification?.image || mappedPayload.data?.imageUrl || null;
    if (typeof rawImageUrl === 'string' && (rawImageUrl.startsWith('https://') || rawImageUrl.startsWith('http://'))) {
      validImageUrl = rawImageUrl.trim();
    }

    if (validImageUrl) {
      sanitizedData.imageUrl = validImageUrl;
      sanitizedData.image = validImageUrl;
    }

    const results = await Promise.allSettled(
      tokens.map(async (token) => {
        const messagePayload = {
          message: {
            token,
            notification: {
              title,
              body,
              ...(validImageUrl ? { image: validImageUrl } : {}),
            },
            android: {
              priority: 'HIGH',
              notification: {
                icon: 'ic_stat_notification',
                color: '#7c3aed',
                channel_id:
                  sanitizedData.entityType?.includes('reminder') ||
                  sanitizedData.entityType === 'lead_followup' ||
                  sanitizedData.entityType === 'task_group'
                    ? 'trackdeal_reminders'
                    : 'trackdeal_default',
                sound: 'default',
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: 'PRIORITY_HIGH',
                ...(validImageUrl ? { image: validImageUrl } : {}),
              },
            },
            webpush: {
              notification: {
                title,
                body,
                icon: '/favicon.ico',
                ...(validImageUrl ? { image: validImageUrl } : {}),
              },
              fcm_options: {
                link: sanitizedData.actionUrl || '/',
              },
            },
            data: sanitizedData,
          },
        };

        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          const isInvalid =
            res.status === 404 ||
            res.status === 400 ||
            errorBody.includes('UNREGISTERED') ||
            errorBody.includes('INVALID_ARGUMENT');
          const err = new Error(`FCM dispatch error (${res.status}): ${errorBody}`);
          err.token = token;
          err.isInvalid = isInvalid;
          throw err;
        }

        const data = await res.json();
        return { token, messageId: data.name };
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value?.messageId || r.value);
    const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message);
    const invalidTokens = results
      .filter((r) => r.status === 'rejected' && r.reason?.isInvalid && r.reason?.token)
      .map((r) => r.reason.token);

    return {
      providerMessageId: successful[0] || `fcm-v1-${Date.now()}`,
      status: successful.length > 0 ? 'SUCCESS' : 'FAILED',
      metadata: {
        totalTokens: tokens.length,
        deliveredCount: successful.length,
        failedCount: failed.length,
        invalidTokens,
        messageIds: successful,
      },
    };
  }
}

module.exports = { FirebaseAdapter };

