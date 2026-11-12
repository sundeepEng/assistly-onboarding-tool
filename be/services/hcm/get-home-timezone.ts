import { HomeDAL } from '../../dal/home.dal';

const homeDAL = new HomeDAL();

/**
 * Fetches the timezone configured on a home.
 * Returns 'UTC' as the safe default when the home has no timezone set.
 */
export const getHomeTimezone = async (homeId: string): Promise<string> => {
  try {
    const home = await homeDAL.getHomeById(homeId);
    return home?.timezone && typeof home.timezone === 'string' ? home.timezone : 'UTC';
  } catch (error) {
    console.error(`[notifications] Failed to fetch home timezone for homeId=${homeId}:`, error);
    return 'UTC';
  }
};
