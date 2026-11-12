import { HomeDAL } from '../../dal/home.dal';
import { FormatResponse } from '../../utils/response-formatter';

export const getHomeByIdHandler = async (homeId: string | undefined) => {
  const homeDAL = new HomeDAL();

  if (!homeId?.length) {
    return FormatResponse(400, {
      message: 'Home ID is required',
    });
  }

  try {
    // Fetch home by homeId
    const existingHome = await homeDAL.getHomeById(homeId);

    // If no home with provided homeId exists, throw error
    if (Object.keys(existingHome).length == 0) {
      return FormatResponse(404, {
        message: 'Failed to fetch details of the home',
        error: `Home with homeId - ${homeId} does not exist`,
      });
    }

    // Return success response with home data
    return FormatResponse(200, {
      message: 'Home fetched successfully',
      home: existingHome,
    });
  } catch (error) {
    console.error(`Error fetching home by ID: ${error}`);
    return FormatResponse(500, {
      message: 'Failed to fetch home',
      error: error,
    });
  }
};
