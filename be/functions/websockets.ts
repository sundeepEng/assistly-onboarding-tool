import { FormatWebSocketResponse } from "../utils/response-formatter";
import { WSCONNECTIONSDAL } from "../dal/ws-connections.dal";
import { handlers } from "../services/route-handlers";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { UsersDAL } from "../dal/users.dal";
import { z } from "zod";

const wsEndpoint = process.env.WS_API_ENDPOINT!;

export const handler = async (event: any) => {
  const route = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;
  const wsConnectionsDAL: WSCONNECTIONSDAL = new WSCONNECTIONSDAL();
  const usersDAL: UsersDAL = new UsersDAL();

  switch (route) {
    case "$connect":
      const userId = event.queryStringParameters?.userId;

      if (!userId)
        return FormatWebSocketResponse(400, {
          message: "Connection failed",
          error: "Missing userId in query params",
        });

      try {
        // Check if userId is valid uuid
        z.string()
          .uuid({ message: "UserId has an invalid UUID format" })
          .parse(userId);

        //Check if the user exists
        const userDetails = await usersDAL.fetchUserById(userId);

        if (Object.keys(userDetails)?.length === 0) {
          return FormatWebSocketResponse(404, {
            message: "Connection Failed",
            error: `User with userId - ${userId} not found`,
          });
        }

        const connection = {
          connectionId: connectionId,
          userId: userId,
          connectedAt: new Date().toISOString(),
          ttl: (Math.floor(Date.now() / 1000) + 24 * 60 * 60).toString(),
        };

        await wsConnectionsDAL.insertConnection(connection);

        console.info(
          `Websocket connection success. Connection ID: ${connectionId}`
        );

        return FormatWebSocketResponse(200, {
          message: "Websocket connection success",
          connectionId: connectionId,
        });
      } catch (error) {
        console.error(
          "Error in creating a web socket connection for user",
          userId
        );

        if (error instanceof z.ZodError) {
          return FormatWebSocketResponse(400, {
            message: "Request payload validation failed",
            error: error.errors,
          });
        }

        return FormatWebSocketResponse(500, {
          message: "Error creating websocket connection",
          error: error as Error,
        });
      }

    case "$disconnect":
      try {
        await wsConnectionsDAL.deleteConnection(connectionId);

        console.info(
          `Disconnected from websocket server: Connection ID: ${connectionId}`
        );

        return FormatWebSocketResponse(200, {
          message: `Disconnected from websocket server: Connection ID: ${connectionId}`,
        });
      } catch (error) {
        console.error(
          "Error in creating a web socket connection for user",
          userId
        );

        return FormatWebSocketResponse(500, {
          message: "Error creating websocket connection",
          error: error as Error,
        });
      }

    case "sendMessage":
      try {
        const requestPayload = JSON.parse(event.body);

        // Persist the message in DB
        await handlers.upsertConversationMessagesHandler(requestPayload);

        // Fetch all active connections for recipient
        const connections = await wsConnectionsDAL.getUserConnections(
          requestPayload.receiver_user_id
        );

        console.info("WS Endpoint", wsEndpoint);

        // Initialize ApiGatewayManagementApi
        const apiGw = new ApiGatewayManagementApi({
          endpoint: wsEndpoint.replace(/^wss:\/\//, "https://"),
        });

        const message = {
          message_id: requestPayload.message_id,
          conversation_id: requestPayload.conversation_id,
          message: requestPayload.message,
          sender_user_id: requestPayload.sender_user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Broadcast message to all connections
        await Promise.all(
          connections.map(async (connection) => {
            try {
              console.info(
                `Sending message to connectionId: ${connection.connectionId}`
              );
              await apiGw.postToConnection({
                ConnectionId: connection.connectionId,
                Data: Buffer.from(JSON.stringify(message)),
              });
            } catch (err) {
              console.error(
                `Failed to send to connectionId: ${connection.connectionId}`,
                err
              );
              if ((err as any).statusCode === 410) {
                await wsConnectionsDAL.deleteConnection(
                  connection.connectionId
                );
              }
            }
          })
        );

        return FormatWebSocketResponse(200, {
          message: "Message sent successfully",
        });
      } catch (error) {
        console.error(
          "Error in sending message to websockets",
          JSON.stringify(error as Error)
        );

        return FormatWebSocketResponse(500, {
          message: "Message failed to sent",
          error: error as Error,
        });
      }

    case "$default":
      const body = JSON.parse(event.body);

      console.info("Received message:", body);

      return FormatWebSocketResponse(200, {
        message: "Message received by server",
      });

    default:
      return FormatWebSocketResponse(404, {
        message: "Websocket Error",
        error: "Unknown route",
      });
  }
};
