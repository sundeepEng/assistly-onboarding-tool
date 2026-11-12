import {
  NotificationDeviceRecord,
  NotificationDevicesDAL,
} from '../../dal/notification-devices.dal';
import { getMobileNotificationsSecret } from '../../utils/mobile-notifications-secret';
import jwt from 'jsonwebtoken';

const notificationDevicesDAL = new NotificationDevicesDAL();

const PERMANENT_FCM_ERRORS = [
  // Legacy FCM HTTP API error strings
  'NotRegistered',
  'InvalidRegistration',
  'MismatchSenderId',
  'InvalidApnsCredentials',
  // FCM v1 API token-specific permanent failures
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'SENDER_ID_MISMATCH',
];

const isPermanentTokenFailure = (errorText: string) => {
  return PERMANENT_FCM_ERRORS.some((code) => errorText.includes(code));
};

export interface NotificationMessagePayload {
  notificationType: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface MobileNotificationsSecret {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  apnsTopic?: string;
}

interface PushResult {
  deviceId: string;
  status: 'sent' | 'failed';
  error?: string;
}

const tokenCache: {
  accessToken?: string;
  expiresAt?: number;
} = {};

export const sendPushNotifications = async (
  devices: NotificationDeviceRecord[],
  message: NotificationMessagePayload
) => {
  if (!devices.length) {
    console.info(
      '[notifications] sendPushNotifications called with no devices',
      JSON.stringify({ notificationType: message.notificationType })
    );
    return [];
  }

  const secret = (await getMobileNotificationsSecret()) as MobileNotificationsSecret;

  validateSecret(secret);

  const accessToken = await getAccessToken(secret);

  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${secret.projectId}/messages:send`;

  console.info(
    `[notifications] Sending push notification`,
    JSON.stringify({
      projectId: secret.projectId,
      notificationType: message.notificationType,
      title: message.title,
      deviceCount: devices.length,
    })
  );

  const results: PushResult[] = await Promise.all(
    devices.map(async (device) => {
      try {
        if (!device.deviceToken) {
          console.warn('[notifications] Device missing token', {
            deviceId: device.deviceId,
          });
          throw new Error('Device token missing');
        }

        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: buildFcmMessage(device, message, secret.apnsTopic),
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();

          if (isPermanentTokenFailure(errorBody)) {
            console.info(
              `[notifications] Marking device ${device.deviceId} inactive due to permanent token failure`
            );
            await notificationDevicesDAL
              .markInactiveByToken(device.deviceToken)
              .catch((dalError) =>
                console.error('[notifications] Failed to mark device inactive', dalError)
              );
          }

          throw new Error(`FCM request failed with status ${response.status}: ${errorBody}`);
        }

        const responseBody = await response.json().catch(() => null);
        console.info('[notifications] FCM send success', {
          deviceId: device.deviceId,
          fcmMessageName: responseBody?.name,
        });

        return {
          deviceId: device.deviceId,
          status: 'sent' as const,
        };
      } catch (error) {
        console.error('[notifications] Failed to send push notification', {
          deviceId: device.deviceId,
          error,
        });

        return {
          deviceId: device.deviceId,
          status: 'failed' as const,
          error: (error as Error).message,
        };
      }
    })
  );

  console.info(
    '[notifications] Push results summary',
    JSON.stringify({
      notificationType: message.notificationType,
      sent: results.filter((result) => result.status === 'sent').length,
      failed: results.filter((result) => result.status === 'failed').length,
    })
  );

  return results;
};

const validateSecret = (secret: MobileNotificationsSecret) => {
  if (!secret.projectId || !secret.clientEmail || !secret.privateKey) {
    throw new Error(
      'Mobile notifications secret must include projectId, clientEmail, and privateKey'
    );
  }
};

const getAccessToken = async (secret: MobileNotificationsSecret) => {
  const now = Date.now();

  if (tokenCache.accessToken && tokenCache.expiresAt && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const jwtPayload = {
    iss: secret.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  };

  const assertion = jwt.sign(jwtPayload, secret.privateKey, {
    algorithm: 'RS256',
  });

  const formBody = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch FCM access token. Status ${response.status}: ${errorBody}`);
  }

  const tokenResponse = await response.json();
  tokenCache.accessToken = tokenResponse.access_token;
  tokenCache.expiresAt = now + tokenResponse.expires_in * 1000;

  return tokenCache.accessToken!;
};

const serializeDataPayload = (data?: Record<string, any>) => {
  if (!data) {
    return undefined;
  }

  return Object.entries(data).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (value !== undefined && value !== null) {
      accumulator[key] = String(value);
    }
    return accumulator;
  }, {});
};

const buildFcmMessage = (
  device: NotificationDeviceRecord,
  message: NotificationMessagePayload,
  apnsTopic?: string
) => {
  const base: any = {
    token: device.deviceToken,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: serializeDataPayload(message.data),
  };

  if (device.platform === 'ios') {
    return {
      ...base,
      apns: {
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': '10',
          ...(apnsTopic ? { 'apns-topic': apnsTopic } : {}),
        },
        payload: {
          aps: {
            alert: { title: message.title, body: message.body },
            sound: 'default',
          },
        },
      },
    };
  }

  return {
    ...base,
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
  };
};
