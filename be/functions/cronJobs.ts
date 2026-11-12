import { ScheduledEvent } from 'aws-lambda';
import { ScanCommand, ScanCommandInput, ScanCommandOutput } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { dynamoClient } from '../utils/dynamo-client';
import { decryptUserData } from '../utils/crypto-util';
import { UsersDAL } from '../dal/users.dal';
import { UserTypes } from '../utils/constants';
import { publishNotificationEvent } from '../services/notifications/publish-notification-event';

/**
 * Shared AWS clients. Keep them outside handlers for reuse across cron jobs.
 */
const usersDAL = new UsersDAL();

type CronContext = {
  env: {
    usersTableName: string;
    homeTableName: string;
    notificationsQueueUrl: string;
    lookaheadDays: number;
  };
};

interface TemplateDocumentInfo {
  documentName?: string;
  documentExpiryDate?: string;
  homeName?: string;
}

interface ExpiringDocumentInfo extends TemplateDocumentInfo {
  userId: string;
  documentCategory?: string;
}

interface ExpiringHomeDocumentInfo extends TemplateDocumentInfo {
  homeId: string;
}

interface NotificationQueuePayload {
  notificationType: string;
  userId: string;
  homeId?: string;
  entityId?: string;
  data: {
    title: string;
    body: string;
    userId: string;
    documentName?: string;
    documentExpiryDate?: string;
    homeName?: string;
  };
}

const DEFAULT_LOOKAHEAD_DAYS = 7;
const NOTIFICATION_TYPE = 'userDocumentExpiring';
const NOTIFICATION_TITLE_TEMPLATE = '{documentName} expires soon';
const NOTIFICATION_BODY_TEMPLATE =
  '{documentName} expires on {documentExpiryDate}. Please update it before it lapses.';
const HOME_NOTIFICATION_TYPE = 'homeDocumentExpiring';
const HOME_NOTIFICATION_TITLE_TEMPLATE = '{homeName}: {documentName} expires soon';
const HOME_NOTIFICATION_BODY_TEMPLATE =
  '{documentName} for {homeName} expires on {documentExpiryDate}. Please update it before it lapses.';
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const runWithLogging = async (label: string, fn: () => Promise<void>): Promise<void> => {
  console.info(`[cronJobs] Starting ${label}`);
  try {
    await fn();
    console.info(`[cronJobs] Completed ${label}`);
  } catch (error) {
    console.error(`[cronJobs] Failed ${label}`, { error });
    throw error;
  }
};

export const handler = async (event: ScheduledEvent) => {
  console.info(
    `[cronJobs] Invocation received`,
    JSON.stringify({ time: event?.time ?? new Date().toISOString() })
  );

  const context = createCronContext();
  console.info(
    `[cronJobs] Loaded environment`,
    JSON.stringify({
      usersTable: context.env.usersTableName,
      homeTable: context.env.homeTableName,
      queueUrl: context.env.notificationsQueueUrl,
      lookaheadDays: context.env.lookaheadDays,
    })
  );

  await runWithLogging('runUserDocumentExpiryNotifier', () =>
    runUserDocumentExpiryNotifier(context)
  );
  await runWithLogging('runHomeDocumentExpiryNotifier', () =>
    runHomeDocumentExpiryNotifier(context)
  );
};

const createCronContext = (): CronContext => {
  const env = {
    usersTableName: process.env.USERS_TABLE_NAME!,
    homeTableName: process.env.HOME_TABLE_NAME!,
    notificationsQueueUrl: process.env.NOTIFICATIONS_QUEUE_URL!,
    lookaheadDays: DEFAULT_LOOKAHEAD_DAYS,
  };

  return { env };
};

/**
 * Document Expiry Cron Job
 */
const runUserDocumentExpiryNotifier = async (context: CronContext) => {
  const { lookaheadDays } = context.env;

  console.info(`[documentExpiryNotifier] Starting scan with lookahead ${lookaheadDays} days`);

  const expiringDocuments = await findExpiringDocuments(context);

  if (!expiringDocuments.length) {
    console.info('[documentExpiryNotifier] No expiring documents found');
    return;
  }

  console.info(`[documentExpiryNotifier] Found ${expiringDocuments.length} expiring documents`);

  for (const documentInfo of expiringDocuments) {
    await enqueueNotification(documentInfo, context);
  }
};

const findExpiringDocuments = async (context: CronContext): Promise<ExpiringDocumentInfo[]> => {
  const expiringDocuments: ExpiringDocumentInfo[] = [];
  let lastEvaluatedKey: ScanCommandInput['ExclusiveStartKey'] | undefined;

  const now = Date.now();
  let page = 0;

  do {
    page += 1;
    const scanInput: ScanCommandInput = {
      TableName: context.env.usersTableName,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const command = new ScanCommand(scanInput);
    const response: ScanCommandOutput = await dynamoClient.send(command);

    const items = response.Items ?? [];
    console.info(`[documentExpiryNotifier] Scanned users page ${page}, items=${items.length}`);

    items.forEach((item: Record<string, any>) => {
      const decryptedUser = decryptUserData(unmarshall(item));
      const documents = Array.isArray(decryptedUser.documents) ? decryptedUser.documents : [];

      if (!decryptedUser.userId || !documents.length) {
        return;
      }

      documents
        .filter((doc: any) =>
          isExpiringSoon(doc?.documentExpiryDate, now, context.env.lookaheadDays)
        )
        .forEach((doc: any) => {
          expiringDocuments.push({
            userId: decryptedUser.userId,
            documentName: doc?.documentName,
            documentCategory: doc?.documentCategory,
            documentExpiryDate: doc?.documentExpiryDate,
          });
        });
    });

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return expiringDocuments;
};

const isExpiringSoon = (expiryDate: string | undefined, nowMs: number, lookaheadDays: number) => {
  if (!expiryDate) {
    return false;
  }

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }

  const diffMs = expiry.getTime() - nowMs;
  const diffDays = diffMs / MS_IN_DAY;

  return diffDays <= lookaheadDays;
};

const enqueueNotification = async (documentInfo: ExpiringDocumentInfo, context: CronContext) => {
  const title = applyTemplate(NOTIFICATION_TITLE_TEMPLATE, documentInfo);
  const body = applyTemplate(NOTIFICATION_BODY_TEMPLATE, documentInfo);

  const payload: NotificationQueuePayload = {
    notificationType: NOTIFICATION_TYPE,
    userId: documentInfo.userId,
    data: {
      title,
      body,
      userId: documentInfo.userId,
      documentName: documentInfo.documentName ?? 'Document',
      documentExpiryDate: documentInfo.documentExpiryDate ?? '',
    },
  };

  await sendNotificationToQueue(payload);

  console.info(
    `[documentExpiryNotifier] Enqueued notification for user=${documentInfo.userId} document=${documentInfo.documentName}`
  );
};

const runHomeDocumentExpiryNotifier = async (context: CronContext) => {
  const { lookaheadDays } = context.env;

  console.info(`[homeDocumentExpiryNotifier] Starting scan with lookahead ${lookaheadDays} days`);

  const expiringDocuments = await findExpiringHomeDocuments(context);

  if (!expiringDocuments.length) {
    console.info('[homeDocumentExpiryNotifier] No expiring documents found');
    return;
  }

  console.info(`[homeDocumentExpiryNotifier] Found ${expiringDocuments.length} expiring documents`);

  const homePCHOMap = new Map<string, string[]>();

  for (const documentInfo of expiringDocuments) {
    const pchoUserIds = await getPCHOUserIdsForHome(documentInfo.homeId, homePCHOMap);

    if (!pchoUserIds.length) {
      console.info(
        `[homeDocumentExpiryNotifier] No PCHO users found for home=${documentInfo.homeId}`
      );
      continue;
    }

    for (const userId of pchoUserIds) {
      await enqueueHomeNotification(documentInfo, userId, context);
    }
  }
};

const findExpiringHomeDocuments = async (
  context: CronContext
): Promise<ExpiringHomeDocumentInfo[]> => {
  const expiringDocuments: ExpiringHomeDocumentInfo[] = [];
  let lastEvaluatedKey: ScanCommandInput['ExclusiveStartKey'] | undefined;

  const now = Date.now();
  let page = 0;

  do {
    page += 1;
    const scanInput: ScanCommandInput = {
      TableName: context.env.homeTableName,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const command = new ScanCommand(scanInput);
    const response: ScanCommandOutput = await dynamoClient.send(command);

    const items = response.Items ?? [];
    console.info(`[homeDocumentExpiryNotifier] Scanned homes page ${page}, items=${items.length}`);

    items.forEach((item: Record<string, any>) => {
      const decryptedHome = decryptUserData(unmarshall(item));
      const documents = Array.isArray(decryptedHome.documents) ? decryptedHome.documents : [];

      if (!decryptedHome.homeId || !documents.length) {
        return;
      }

      documents
        .filter((doc: any) =>
          isExpiringSoon(doc?.documentExpiryDate, now, context.env.lookaheadDays)
        )
        .forEach((doc: any) => {
          expiringDocuments.push({
            homeId: decryptedHome.homeId,
            homeName: decryptedHome.home ?? decryptedHome.homeName,
            documentName: doc?.documentName,
            documentExpiryDate: doc?.documentExpiryDate,
          });
        });
    });

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return expiringDocuments;
};

const getPCHOUserIdsForHome = async (
  homeId: string,
  cache: Map<string, string[]>
): Promise<string[]> => {
  if (!homeId) {
    return [];
  }

  if (cache.has(homeId)) {
    return cache.get(homeId)!;
  }

  const pchoUsers = await usersDAL.fetchAllUsersWithHomeId(UserTypes.PCHO, homeId);
  console.info(
    `[homeDocumentExpiryNotifier] fetched ${pchoUsers.length} PCHO users for home=${homeId}`
  );

  const userIds = pchoUsers
    .map((user) => user?.userId)
    .filter((userId): userId is string => Boolean(userId));

  cache.set(homeId, userIds);

  return userIds;
};

const enqueueHomeNotification = async (
  documentInfo: ExpiringHomeDocumentInfo,
  userId: string,
  context: CronContext
) => {
  const title = applyTemplate(HOME_NOTIFICATION_TITLE_TEMPLATE, documentInfo);
  const body = applyTemplate(HOME_NOTIFICATION_BODY_TEMPLATE, documentInfo);

  const payload: NotificationQueuePayload = {
    notificationType: HOME_NOTIFICATION_TYPE,
    userId,
    homeId: documentInfo.homeId,
    data: {
      title,
      body,
      userId: userId,
      documentName: documentInfo.documentName ?? 'Document',
      documentExpiryDate: documentInfo.documentExpiryDate ?? '',
      homeName: documentInfo.homeName ?? 'Home',
    },
  };

  await sendNotificationToQueue(payload);

  console.info(
    `[homeDocumentExpiryNotifier] Enqueued notification for home=${documentInfo.homeId} user=${userId} document=${documentInfo.documentName}`
  );
};

const sendNotificationToQueue = async (payload: NotificationQueuePayload) => {
  await publishNotificationEvent({
    type: 'cron',
    homeId: payload.homeId,
    entityId: payload.entityId,
    trigger: {
      service_name: payload.notificationType,
      action: 'expiring',
      new_data: payload.data,
      userId: payload.userId,
    },
    recipients: [{ user_id: payload.userId }],
    payload: {
      notificationType: payload.notificationType,
      title: payload.data.title,
      body: payload.data.body,
      data: payload.data,
    },
  });
};

const applyTemplate = (template: string, documentInfo: TemplateDocumentInfo) => {
  const documentName = documentInfo.documentName ?? 'Document';
  const documentExpiryDate = formatDate(documentInfo.documentExpiryDate);
  const homeName = documentInfo.homeName ?? 'Home';

  return template
    .replace(/{documentName}/g, documentName)
    .replace(/{documentExpiryDate}/g, documentExpiryDate)
    .replace(/{homeName}/g, homeName);
};

const formatDate = (date?: string) => {
  if (!date) {
    return 'soon';
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'soon';
  }

  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
