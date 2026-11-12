export const getFrontendUrl = () =>
  process.env.STAGE === 'main'
    ? 'https://www.assistly.live'
    : `https://${process.env.STAGE}.assistly.live`;
