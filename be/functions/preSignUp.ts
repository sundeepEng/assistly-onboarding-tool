exports.handler = async (event: any) => {
  // Automatically confirm the user
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
