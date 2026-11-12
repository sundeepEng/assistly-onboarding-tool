// If homeId exists in payload, check if homeId exists in DB, check for home name as well and then do update
// Else, call getByHomeName to check if home with name exists, if not, convert home to lower case, generate a homeId and call upsert
import { z, ZodError } from 'zod';
import { HomeSchema } from '../../models/Home/home.model';
import { FormatResponse } from '../../utils/response-formatter';
import { HomeDAL } from '../../dal/home.dal';
import { UsersDAL } from '../../dal/users.dal';
import { v4 as uuidv4 } from 'uuid';
import { getCoordinates } from '../../utils/geocoding';

export const upsertHomeHandler = async (requestPayload: z.infer<typeof HomeSchema>) => {
  const homeDAL: HomeDAL = new HomeDAL();
  const usersDAL: UsersDAL = new UsersDAL();

  try {
    //If homeId exists in the payload, perform update operation
    // else, perform insert operation
    if (requestPayload?.homeId) {
      const existingHome = await homeDAL.getHomeById(requestPayload.homeId);

      // If no home with provided homeId exists, throw error
      if (Object.keys(existingHome).length == 0) {
        return FormatResponse(400, {
          message: 'Failed to upsert home',
          error: `Home with provided homeId - ${requestPayload.homeId} not found`,
        });
      }

      let updatedHomeData = {
        ...requestPayload,
        createdAt: existingHome.createdAt,
        modifiedAt: new Date().toISOString(),
      };

      // Check if home name is being updated
      const isHomeNameUpdated = existingHome.homeName !== updatedHomeData.homeName.toLowerCase();

      if (updatedHomeData.homeAddress) {
        const { street, city, state, zipCode } = updatedHomeData.homeAddress;

        const { latitude, longitude } = await getCoordinates({
          street,
          city,
          state,
          zipCode,
        });

        updatedHomeData = {
          ...updatedHomeData,
          latitude: latitude,
          longitude: longitude,
        };
      }

      const validatedHomeData = HomeSchema.parse(updatedHomeData);

      console.info(`Validated Home data for upsert: ${validatedHomeData}`);

      // Update home data
      await homeDAL.upsertHome(updatedHomeData);

      // If home name was updated, update all users associated with this home
      if (isHomeNameUpdated) {
        try {
          console.info(
            `Home name updated from "${existingHome.homeName}" to "${updatedHomeData.homeName}". Updating associated users...`
          );

          // Fetch all users associated with this homeId across all roles in parallel
          const roles = [
            'PCHO',
            'PCGLead',
            'PCG',
            'Lead',
            'Senior',
            'Referral',
            'ComplianceGuest',
            'Nurse',
            'NurseLead',
          ];

          // Fetch all users in parallel
          const userArrays = await Promise.all(
            roles.map((role) => usersDAL.fetchAllUsersWithHomeId(role, requestPayload.homeId!))
          );

          // Flatten all user arrays
          const allUsers = userArrays.flat();

          if (allUsers.length > 0) {
            // Update all users in parallel
            await Promise.all(
              allUsers.map(async (user) => {
                const updatedUser = {
                  ...user,
                  home: updatedHomeData.homeName,
                  modifiedAt: new Date().toISOString(),
                };

                await usersDAL.updateUser(updatedUser);
                console.info(
                  `Updated home name for user ${user.userId} to "${updatedHomeData.homeName}"`
                );
              })
            );

            console.info(
              `Successfully updated home name for ${allUsers.length} users associated with homeId ${requestPayload.homeId}`
            );
          } else {
            console.info(`No users found associated with homeId ${requestPayload.homeId}`);
          }
        } catch (error) {
          console.error(`Error updating users with new home name:`, error);
          // Continue with the response even if user update fails
          // The home was already updated successfully
        }
      }

      return FormatResponse(200, {
        message: `Home with ID ${requestPayload.homeId} updated successfully`,
      });
    } else {
      const { homeName } = requestPayload;
      const existingHome = await homeDAL.getByHomeName(homeName);
      // If home with provided homeName already exists, throw error
      if (Object.keys(existingHome)?.length > 0) {
        return FormatResponse(400, {
          message: 'Failed to upsert home',
          error: `Home with name ${homeName} already exists`,
        });
      }
      // Create a new home, return success response
      let newHome = {
        ...requestPayload,
        homeId: uuidv4(),
        createdAt: new Date().toISOString(),
      };

      if (newHome.homeAddress) {
        const { street, city, state, zipCode } = newHome.homeAddress;

        const { latitude, longitude } = await getCoordinates({
          street,
          city,
          state,
          zipCode,
        });

        newHome = {
          ...newHome,
          latitude: latitude,
          longitude: longitude,
        };
      }

      const validatedHomeData = HomeSchema.parse(newHome);

      console.info(`Validated Home data for upsert: ${validatedHomeData}`);

      await homeDAL.upsertHome(newHome);
      return FormatResponse(200, {
        message: `Home with homeId - ${newHome.homeId} created successfully`,
        homeId: newHome.homeId,
      });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`Request payload validation failed at upsert-home handler: ${error.errors}`);
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: JSON.stringify(error.errors),
      });
    }
    return FormatResponse(500, {
      message: 'Failed to upsert home',
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        stack: error instanceof Error ? error.stack : 'No stack trace available',
      },
    });
  }
};
