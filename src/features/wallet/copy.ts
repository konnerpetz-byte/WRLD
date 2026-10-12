/**
 * User-facing text for connecting a points wallet.
 * Shown on the Wallet page before the "Connect" button, and again in the
 * confirmation dialog. Keep it short and plain.
 */

export const AWARDWALLET_DISCLOSURE = {
  title: 'Connect your points with AwardWallet',
  body: [
    'We use AwardWallet to bring in your points and miles automatically. You will need a free AwardWallet account.',
    'You sign in on AwardWallet’s site and choose which accounts to share. We never see your airline, hotel or bank passwords.',
    'We store only balances, status and expiration dates, and refresh them about twice a day. You can disconnect at any time, and we delete the connection right away.',
    'Some programs don’t allow outside access. If one of yours is missing, you can add it by hand.',
  ],
  learnMoreUrl: 'https://awardwallet.com',
  connectLabel: 'Continue to AwardWallet',
  noAccountLabel: 'Don’t have an account? AwardWallet is free to join.',
  disconnectConfirm:
    'Disconnect AwardWallet? Your synced balances will be removed from this app. Manually added accounts stay.',
} as const;
