export interface NetworkOption {
  id: string;
  name: string;
  color: string;
  textColor: string;
  borderColor: string;
  prefix: string;
}

export const SUPPORTED_NETWORKS: NetworkOption[] = [
  {
    id: 'mtn',
    name: 'MTN Nigeria',
    color: '#FFCC00',
    textColor: '#1A1A1A',
    borderColor: '#E6B800',
    prefix: '0803, 0806, 0703, 0706, 0813, 0816, 0810, 0814, 0903, 0906, 0913, 0916'
  },
  {
    id: 'airtel',
    name: 'Airtel NG',
    color: '#FF0000',
    textColor: '#FFFFFF',
    borderColor: '#CC0000',
    prefix: '0802, 0808, 0708, 0812, 0701, 0902, 0901, 0904, 0907, 0912'
  },
  {
    id: 'glo',
    name: 'Glo Mobile',
    color: '#008753',
    textColor: '#FFFFFF',
    borderColor: '#00663F',
    prefix: '0805, 0807, 0705, 0815, 0811, 0905, 0915'
  },
  {
    id: '9mobile',
    name: '9mobile',
    color: '#00693E',
    textColor: '#FFFFFF',
    borderColor: '#004D2C',
    prefix: '0809, 0817, 0818, 0909, 0908'
  }
];

export const GIVEAWAY_INFO = {
  title: 'MARION UNDEFEATED – STUDENT AIRTIME GIVEAWAY 2026',
  institution: 'Delta State Polytechnic, Otefe-Oghara',
  sponsor: 'IYAH MARION',
  brand: 'Marion Undefeated',
  slogan: "Let's make every penny count.",
  rewardAmount: 200,
  totalBudget: 10000,
  totalSlots: 50,
  currencySymbol: '₦',
  sessionYear: '2026',
  posterPath: '/assets/aistudio/IMG-20261103-WA0034_a3d08139.jpg',
  whatsappCommunityUrl: 'https://chat.whatsapp.com/FFF0LzGU0lwK87cMv9KUDB?s=cl&p=a&iam=2',
  adminWhatsAppNumber: '2348057231961',
  deployedAppUrl: 'https://ais-dev-nnhflti22ouag6junyuqix-911064966292.europe-west2.run.app'
};

export type ShareMethod = 'groups_3' | 'individuals_10';
export type ParticipationStatus = 'Registered – Share Pending' | 'Share Confirmed – Awaiting Review';
export type RewardStatus = 'pending_review' | 'approved' | 'credited' | 'declined';

export interface ParticipantRegistration {
  id: string;
  phoneNumber?: string;
  phoneMasked?: string;
  network: 'mtn' | 'airtel' | 'glo' | '9mobile';
  fullName?: string;
  department?: string;
  referralCode: string;
  referredBy?: string | null;
  registeredAt: string;
  shareConfirmed: boolean;
  shareMethod?: ShareMethod | null;
  shareConfirmedAt?: string | null;
  shareClicks?: number;
  notifyAdminClicks?: number;
  status: ParticipationStatus;
  rewardStatus: RewardStatus;
  airtimeAmount: number;
  adminNote?: string | null;
  adminNotified?: boolean;
  adminNotifiedAt?: string | null;
  notifyError?: string | null;
  updatedAt?: string;
}

export interface GiveawayStats {
  totalRegistered: number;
  sharesConfirmed: number;
  pendingReview: number;
  approvedEntries: number;
  airtimeCredited: number;
  rejectedEntries: number;
  totalSlots: number;
  remainingSlots: number;
  totalBudget: number;
  totalAirtimePaid: number;
  rewardAmount: number;
  totalReferralVisits?: number;
  networkCounts: {
    mtn: number;
    airtel: number;
    glo: number;
    '9mobile': number;
  };
}
