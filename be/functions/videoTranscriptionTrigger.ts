// import {
//   StartTranscriptionJobCommand,
//   TranscribeClient,
// } from "@aws-sdk/client-transcribe";
// import { S3Event } from "aws-lambda";
// import { getHomeByIdHandler } from "../services/home/get-home-by-id";
// import { upsertHomeHandler } from "../services/home/upsert-home";
// import { v4 as uuidv4 } from "uuid";
// import { HomeSchema } from "../models/Home/home.model";
// import { z } from "zod";

// const transcribe = new TranscribeClient({
//   region: process.env.CURRENT_AWS_REGION!,
// });

// export const handler = async (event: S3Event) => {
//   try {
//     const record = event.Records[0];
//     const s3ObjectKey = decodeURIComponent(record.s3.object.key);
//     const bucketName = record.s3.bucket.name;

//     console.log(`Received S3 event for key: `, s3ObjectKey);

//     const [homeId, moduleId, fileName] = s3ObjectKey.split("/");

//     if (s3ObjectKey.endsWith(".mp4")) {
//       console.info(`Received MP4 file: ${s3ObjectKey}`);

//       const jobName = `${Date.now()}-${fileName.replace(".mp4", "")}`;

//       const inputUri = `s3://${bucketName}/${s3ObjectKey}`;
//       const outputKey = `${s3ObjectKey.split("/")[0]}/${
//         s3ObjectKey.split("/")[1]
//       }/`;

//       await new Promise((resolve) => setTimeout(resolve, 10000)); // Waits for 10 seconds

//       const command = new StartTranscriptionJobCommand({
//         TranscriptionJobName: jobName,
//         LanguageCode: "en-US",
//         Media: { MediaFileUri: inputUri },
//         MediaFormat: "mp4",
//         OutputBucketName: bucketName,
//         OutputKey: outputKey,
//         Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 2 },
//         JobExecutionSettings: {
//           DataAccessRoleArn: process.env.TRANSCRIBE_SERVICE_ROLE_ARN!,
//         },
//       });

//       const response = await transcribe.send(command);

//       console.info(`Transcription started: `, response);

//       return;
//     }

//     if (s3ObjectKey.endsWith(".json")) {
//       console.info(`Received JSON file: ${s3ObjectKey}`);

//       console.info(`Extracted HomeId`, homeId);

//       const response = await getHomeByIdHandler(homeId);
//       const homeDetails: z.infer<typeof HomeSchema> = JSON.parse(
//         response.body
//       ).home;

//       console.info("Home details fetched: ", homeDetails);

//       const transcriptDocument = {
//         documentId: uuidv4(),
//         documentType: `.json` as const,
//         documentName: fileName,
//         documentUrl: `https://${bucketName}.s3.${process.env
//           .CURRENT_AWS_REGION!}.amazonaws.com/${s3ObjectKey}`,
//         documentCreatedAt: new Date().toISOString(),
//       };

//       const existingDocuments = homeDetails?.complianceTraining?.length
//         ? homeDetails.complianceTraining
//         : [];

//       const moduleIndex = existingDocuments.findIndex(
//         (record) => record.moduleId === moduleId
//       );

//       existingDocuments[moduleIndex].documents.push(transcriptDocument);
//       existingDocuments[moduleIndex].modifiedAt = new Date().toISOString();

//       const updatedHomeDetails = {
//         ...homeDetails,
//         complianceTraining: existingDocuments,
//       };

//       console.info(
//         `Updated complianceTraining Documents: `,
//         updatedHomeDetails
//       );

//       const homeUpdate = await upsertHomeHandler(updatedHomeDetails);

//       console.info(
//         `Home details updated successfully with HomeId ${homeId}: `,
//         homeUpdate
//       );

//       return;
//     }
//   } catch (error) {
//     console.error("Error in video transcription handler:", error);

//     throw new Error(`Error generating transcription ${error as Error}`);
//   }
// };
