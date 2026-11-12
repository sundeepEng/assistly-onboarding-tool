export const getFrontendUrl = () =>
  process.env.NEXT_PUBLIC_STAGE === 'main'
    ? 'https://www.assistly.live'
    : `https://${process.env.NEXT_PUBLIC_STAGE}.assistly.live`;
