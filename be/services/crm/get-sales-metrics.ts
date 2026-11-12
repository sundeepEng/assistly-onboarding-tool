import { z } from 'zod';
import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { Milestones, UserTypes } from '../../utils/constants';
import { HomeDAL } from '../../dal/home.dal';

const usersDAL: UsersDAL = new UsersDAL();
const homesDAL: HomeDAL = new HomeDAL();

const SalesMetricsQuerySchema = z
  .object({
    userId: z.string().uuid({ message: 'userId must be a valid uuid' }),
    start_date: z.string().datetime({ message: 'start_date has an invalid datetime format' }),
    end_date: z.string().datetime({ message: 'end_date has an invalid datetime format' }),
    homeId: z.string().uuid({ message: 'homeId must be a valid uuid' }),
  })
  .strict();

type StageKey = 'initial_contact' | 'home_tour' | 'signed' | 'boarded' | 'lost';

const stageDefs: Array<{ key: StageKey; milestone: string }> = [
  { key: 'lost', milestone: Milestones.lost },
  { key: 'boarded', milestone: Milestones.onboarding },
  { key: 'signed', milestone: Milestones.contract },
  { key: 'home_tour', milestone: Milestones.tour },
  { key: 'initial_contact', milestone: Milestones.initialContact },
];

// Parse ISO datetime strings (query params, model timestamps). Returns null when invalid.
const parseIso = (v?: string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Checks if an ISO datetime string falls within an inclusive date range.
const withinRange = (iso: string | undefined, start: Date, end: Date) => {
  const d = parseIso(iso);
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
};

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
};

const uniqueStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0)));

// Filters Seniors/Leads to only those attributed to the allowed set.
// Attribution comes from `isReferredByUserId`, which may be a string or a string array.
const filterByReferredByUserIds = (users: any[], allowedUserIds: string[]) => {
  if (!Array.isArray(allowedUserIds) || allowedUserIds.length === 0) return users;

  return users.filter((u) => {
    const ref = u?.isReferredByUserId;
    if (!ref) return false;
    if (typeof ref === 'string') return allowedUserIds.includes(ref);
    if (Array.isArray(ref))
      return ref.some((id) => typeof id === 'string' && allowedUserIds.includes(id));
    return false;
  });
};

const computeStageCounts = (users: any[]) => {
  const counts: Record<StageKey, number> = {
    initial_contact: 0,
    home_tour: 0,
    signed: 0,
    boarded: 0,
    lost: 0,
  };

  for (const user of users) {
    const milestones: string[] = Array.isArray(user?.milestone) ? user.milestone : [];

    // Count user in every stage they've achieved (cumulative funnel)
    for (const stage of stageDefs) {
      if (milestones.includes(stage.milestone)) {
        counts[stage.key] += 1;
      }
    }
  }

  return counts;
};

// Computes stage counts with mutually exclusive logic (each user counted only in highest stage)
// Used for rep_performance table
const computeStageCountsExclusive = (users: any[]) => {
  const counts: Record<StageKey, number> = {
    initial_contact: 0,
    home_tour: 0,
    signed: 0,
    boarded: 0,
    lost: 0,
  };

  for (const user of users) {
    const milestones: string[] = Array.isArray(user?.milestone) ? user.milestone : [];

    const highestPriorityStage = stageDefs.find((stage) => milestones.includes(stage.milestone));

    if (highestPriorityStage) {
      counts[highestPriorityStage.key] += 1;
    }
  }

  return counts;
};

// Computes aggregate lost reasons for the given dataset (only users with milestone "lost").
const computeLostReasons = (users: any[]) => {
  const lostUsers = users.filter(
    (u) => Array.isArray(u?.milestone) && u.milestone.includes(Milestones.lost)
  );
  const byReason: Record<string, number> = {};
  for (const u of lostUsers) {
    const reason = u?.lostCategory || 'Other';
    byReason[reason] = (byReason[reason] || 0) + 1;
  }
  return byReason;
};

// Computes conversion percentage: % of leads that completed contract within the date range
const computeConversionPercentage = (users: any[]) => {
  if (users.length === 0) return 0;
  const converted = users.filter(
    (u) => Array.isArray(u?.milestone) && u.milestone.includes(Milestones.contract)
  );
  return Math.round((converted.length / users.length) * 100);
};

// Computes average age to contract: duration from createdAt to contractCompletedOn
// Only includes records with a valid contractCompletedOn.
// If contractCompletedOn is date-only (e.g. "2026-07-14"), it is treated as "2026-07-14T00:00:00.000Z".
// If contractCompletedOn is datetime, the original value is used.
// Returns { value, unit } where unit is 'hours' if < 24h, otherwise 'days'.
const computeAverageAge = (users: any[]) => {
  const converted = users.filter(
    (u) =>
      Array.isArray(u?.milestone) &&
      u.milestone.includes(Milestones.contract) &&
      u?.contractCompletedOn
  );
  if (converted.length === 0) return { value: 0, unit: 'days' };

  let totalMs = 0;
  let validCount = 0;
  for (const user of converted) {
    const created = parseIso(user.createdAt);
    const completed = parseIso(user.contractCompletedOn);
    if (created && completed) {
      const diffMs = completed.getTime() - created.getTime();
      totalMs += diffMs > 0 ? diffMs : 0;
      validCount++;
    }
  }

  if (validCount === 0) return { value: 0, unit: 'days' };

  const avgMs = totalMs / validCount;
  const avgHours = avgMs / (1000 * 60 * 60);

  if (avgHours < 24) {
    return { value: Math.round(avgHours), unit: 'hours' };
  }

  return { value: Math.round(avgHours / 24), unit: 'days' };
};

export const getSalesMetricsHandler = async (queryParams: any) => {
  // Query params are expected from the API Gateway GET /v1/crm/sales/metrics endpoint.
  // Required params:
  // - userId: viewer
  // - start_date/end_date: inclusive date range filter (uses `createdAt`)
  if (!queryParams) {
    return FormatResponse(400, {
      message: 'Failed to fetch sales metrics',
      error: 'No query params provided',
    });
  }

  try {
    // Validate and normalize request
    const validated = SalesMetricsQuerySchema.parse(queryParams);
    const viewer = await usersDAL.fetchUserById(validated.userId);
    const home = await homesDAL.getHomeById(validated.homeId);

    const startDate = parseIso(validated.start_date);
    const endDate = parseIso(validated.end_date);

    if (!startDate || !endDate) {
      return FormatResponse(400, {
        message: 'Request query validation failed',
        error: 'start_date and end_date are required and must be valid ISO datetimes',
      });
    }

    if (startDate.getTime() > endDate.getTime()) {
      return FormatResponse(400, {
        message: 'Request query validation failed',
        error: 'start_date must be less than or equal to end_date',
      });
    }

    if (!viewer || Object.keys(viewer).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to fetch sales metrics',
        error: `User with user id - ${validated.userId} does not exist`,
      });
    }

    if (!home || Object.keys(home).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to fetch sales metrics',
        error: `Home with home id - ${validated.homeId} does not exist`,
      });
    }

    const viewerRole = viewer?.role;

    const isSalesRep = viewerRole === UserTypes.SALESREPRESENTATIVE;
    const isSalesDirector = viewerRole === UserTypes.SALESDIRECTOR;
    const isPcho = viewerRole === UserTypes.PCHO;

    if (!isSalesRep && !isSalesDirector && !isPcho) {
      return FormatResponse(403, {
        message: 'Failed to fetch sales metrics',
        error: 'Provided role is not authorized to access this resource',
      });
    }

    let performerUsers: any[] = [];

    // Role scoping:
    // - Sales Rep: self
    // - Sales Director (Sales Manager): self + associated sales reps
    // - PCHO: all sales directors + sales reps across PCHO homes
    if (isSalesRep) {
      performerUsers = [viewer];
    } else if (isSalesDirector) {
      const repIds = Array.isArray(viewer?.associatedUserIds) ? viewer.associatedUserIds : [];
      const reps = repIds.length > 0 ? await usersDAL.batchFetchUsersByIds(repIds) : [];
      performerUsers = [viewer, ...reps];
    } else if (isPcho) {
      const repsByHome = await usersDAL.fetchAllUsersWithHomeId(
        UserTypes.SALESREPRESENTATIVE,
        validated?.homeId
      );
      const managersByHome = await usersDAL.fetchAllUsersWithHomeId(
        UserTypes.SALESDIRECTOR,
        validated?.homeId
      );
      performerUsers = [viewer, ...repsByHome.flat(), ...managersByHome.flat()];
    }

    console.info('performerUsers before filtering', performerUsers);

    performerUsers = performerUsers.filter(
      (u: any) =>
        (u?.role === UserTypes.SALESREPRESENTATIVE ||
          u?.role === UserTypes.SALESDIRECTOR ||
          u?.role === UserTypes.PCHO) &&
        u?.homeId &&
        u?.userId
    );

    console.info('performerUsers after filtering', performerUsers);

    // Allowed referral attribution set for the viewer scope.
    // Leads/Seniors are included only if `isReferredByUserId` matches one of these.
    const allowedReferredUserIds = uniqueStrings(performerUsers.map((u: any) => u.userId));

    // Data is always calculated per home. homeId is now mandatory in query params.
    // const scopeHomeIds = [validated.homeId];

    const allStart = startDate;
    const allEnd = endDate;

    // Rolling windows are computed relative to `endDate` (within the selected date range dataset).
    const endForRolling = endDate;
    const start7Rolling = new Date(endForRolling);
    start7Rolling.setDate(start7Rolling.getDate() - 7);
    const start30Rolling = new Date(endForRolling);
    start30Rolling.setDate(start30Rolling.getDate() - 30);

    // Load all Seniors + Leads for the scoped homes, then apply date range + attribution filters.
    let allLeadSenior: any[] = [];
    const leads = await usersDAL.fetchAllUsersWithHomeId(UserTypes.LEAD, validated.homeId);
    const seniors = await usersDAL.fetchAllUsersWithHomeId(UserTypes.SENIOR, validated.homeId);
    allLeadSenior = [...allLeadSenior, ...leads, ...seniors];

    // Date range filter is applied first.
    allLeadSenior = allLeadSenior.filter((u) => withinRange(u?.createdAt, allStart, allEnd));

    // Attribution filter (Sales Rep/Manager/PCHO scope) is applied next.
    if (allowedReferredUserIds.length > 0) {
      allLeadSenior = filterByReferredByUserIds(allLeadSenior, allowedReferredUserIds);
    }

    console.info('allLeadSenior after filtering', allLeadSenior);

    const totalLeads = allLeadSenior.length;
    const newLeads7 = allLeadSenior.filter((u) =>
      withinRange(u?.createdAt, start7Rolling, endForRolling)
    ).length;
    const newLeads30 = allLeadSenior.filter((u) =>
      withinRange(u?.createdAt, start30Rolling, endForRolling)
    ).length;

    const stageCounts = computeStageCounts(allLeadSenior);
    console.info('stageCounts', stageCounts);

    const residentsBoarded = stageCounts.boarded;

    const lostByReason = computeLostReasons(allLeadSenior);
    console.info('lostByReason', lostByReason);

    // Per-performer stage distribution (manager+rep+salesrep).
    // For Sales Rep logins, returns their own performance.
    const repPerformance = await Promise.all(
      performerUsers.map(async (performer) => {
        let repLeadSenior = [
          ...(await usersDAL.fetchAllUsersWithHomeId(UserTypes.LEAD, validated.homeId)),
          ...(await usersDAL.fetchAllUsersWithHomeId(UserTypes.SENIOR, validated.homeId)),
        ];
        repLeadSenior = repLeadSenior.filter((u) => withinRange(u?.createdAt, allStart, allEnd));
        repLeadSenior = filterByReferredByUserIds(repLeadSenior, [performer.userId]);
        const repStageCounts = computeStageCountsExclusive(repLeadSenior);
        const conversionPercentage = computeConversionPercentage(repLeadSenior);
        const averageAge = computeAverageAge(repLeadSenior);
        return {
          userId: performer.userId,
          name: performer.name,
          homeId: validated.homeId,
          role: performer.role,
          funnel: repStageCounts,
          newLeads7: repLeadSenior.filter((u) =>
            withinRange(u?.createdAt, start7Rolling, endForRolling)
          ).length,
          newLeads30: repLeadSenior.filter((u) =>
            withinRange(u?.createdAt, start30Rolling, endForRolling)
          ).length,
          conversionPercentage,
          averageAge,
        };
      })
    );

    console.info('repPerformance', repPerformance);
    // Per-performer lost reason distribution, used for charts like "Loss Reasons by Rep".
    // Included only for Sales Director and PCHO.
    const lossReasonsByRep = isSalesRep
      ? undefined
      : await Promise.all(
          performerUsers.map(async (performer) => {
            let repLeadSenior = [
              ...(await usersDAL.fetchAllUsersWithHomeId(UserTypes.LEAD, validated.homeId)),
              ...(await usersDAL.fetchAllUsersWithHomeId(UserTypes.SENIOR, validated.homeId)),
            ];
            repLeadSenior = repLeadSenior.filter((u) =>
              withinRange(u?.createdAt, allStart, allEnd)
            );
            repLeadSenior = filterByReferredByUserIds(repLeadSenior, [performer.userId]);
            const repLostReasons = computeLostReasons(repLeadSenior);
            return {
              userId: performer.userId,
              name: performer.name,
              homeId: validated.homeId,
              role: performer.role,
              lost_by_reason: repLostReasons,
            };
          })
        );

    console.info('lossReasonsByRep', lossReasonsByRep);

    const salesManagers = performerUsers
      .filter((u: any) => u?.role === UserTypes.SALESDIRECTOR)
      .map((u: any) => ({ userId: u.userId, name: u.name, homeId: u.homeId }));

    const salesReps = performerUsers
      .filter((u: any) => u?.role === UserTypes.SALESREPRESENTATIVE)
      .map((u: any) => ({ userId: u.userId, name: u.name, homeId: u.homeId }));

    // Response fields:
    // - cards: headline numbers for the selected range
    // - funnel: stage distribution
    // - lost_by_reason: overall lost distribution
    // - rep_performance: per performer funnel (Sales Director / PCHO)
    // - loss_reasons_by_rep: per performer lost distribution (Sales Director / PCHO)
    return FormatResponse(200, {
      viewerRole,
      sales_managers: isPcho ? salesManagers : undefined,
      sales_reps: isPcho ? salesReps : undefined,
      cards: {
        total_leads: { value: totalLeads },
        new_leads_7d: { value: newLeads7 },
        new_leads_30d: { value: newLeads30 },
        residents_boarded: { value: residentsBoarded },
      },
      funnel: stageCounts,
      lost_by_reason: lostByReason,
      rep_performance: repPerformance,
      loss_reasons_by_rep: isPcho || isSalesDirector ? lossReasonsByRep : undefined,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request query validation failed',
        error: error.errors,
      });
    }

    console.error(`{api: '/crm/sales/metrics', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to fetch sales metrics',
      error: error,
    });
  }
};
