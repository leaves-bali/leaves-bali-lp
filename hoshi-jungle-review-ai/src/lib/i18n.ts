import type { ReplyStatus, ReviewLanguage } from '@/lib/database.types';

/**
 * 画面の多言語化。
 *
 * 【なぜ必要か】
 * このシステムを操作するのは日本人・インドネシア人・アメリカ人のスタッフである。
 * クチコミの言語（5言語）とは別の話で、こちらは「画面の言語」。
 * 読めない画面は使われないため、運用が始まらない。
 *
 * 【なぜライブラリを使わないか】
 * next-intl や i18next は Next.js の App Router では設定が重く、
 * 画面数が 6 つしかない本システムには過剰。辞書 1 枚で足りる。
 * 言語を足すときは UI_LANGUAGES に追加して、この辞書を埋めるだけでよい。
 */

export const UI_LANGUAGES = ['ja', 'en', 'id'] as const;
export type UiLang = (typeof UI_LANGUAGES)[number];

export const DEFAULT_UI_LANG: UiLang = 'ja';

export const UI_LANG_LABELS: Record<UiLang, string> = {
  ja: '日本語',
  en: 'English',
  id: 'Indonesia',
};

export function isUiLang(value: unknown): value is UiLang {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Accept-Language ヘッダから最初に一致する対応言語を拾う。
 * 初回アクセス時、スタッフが何も設定していない状態でも母語で開けるようにする。
 */
export function pickFromAcceptLanguage(header: string | null): UiLang | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase();
    const base = tag.split('-')[0];
    if (isUiLang(base)) return base;
  }
  return null;
}

type Dict = {
  // 共通
  appName: string;
  owner: string;
  staff: string;
  logout: string;
  syncNow: string;
  syncing: string;
  passcodeAdmin: string;
  lastSync: string;
  neverSynced: string;
  autoHourly: string;
  networkError: string;
  loading: string;

  // ナビ
  navInbox: string;
  navAttention: string;
  navArchive: string;

  // 入口
  landingLead: string;
  forStaff: string;
  forStaffHint: string;
  enterWithPasscode: string;
  forOwner: string;
  forOwnerHint: string;
  signInWithGoogle: string;
  ownerAccountNote: string;

  // スタッフログイン
  staffLogin: string;
  passcode: string;
  showPasscode: string;
  hidePasscode: string;
  enter: string;
  checking: string;
  askAdmin: string;
  ownerLinkHere: string;

  // 一覧
  inboxTitle: string;
  inboxLead: string;
  attentionTitle: string;
  attentionLead: string;
  archiveTitle: string;
  archiveLead: string;
  emptyInbox: string;
  emptyAttention: string;
  emptyArchive: string;
  languageFilter: string;
  allLanguages: string;
  indonesianPriorityNote: string;

  // カード
  anonymous: string;
  noReviewText: string;
  needsCheck: string;
  replyDraft: string;
  replyEdited: string;
  replyPublished: string;
  publish: string;
  publishing: string;
  saveDraft: string;
  saving: string;
  regenerate: string;
  regenerating: string;
  skip: string;
  noReplyYet: string;
  saveFirst: string;
  savedNotice: string;
  publishedNotice: string;
  regeneratedNotice: string;
  skippedNotice: string;
  emptyReply: string;
  publishFailed: string;
  publishedAt: string;
  switchConfirm: string;
  edited: string;
  pickStyle: string;

  // 3択
  styleWarm: string;
  styleStandard: string;
  styleConcise: string;
  styleWarmHint: string;
  styleStandardHint: string;
  styleConciseHint: string;

  // 予算
  remainingThisMonth: string;
  budgetExhausted: string;

  // 要確認の理由
  reasonLowRating: string;
  reasonIndonesian: string;
  reasonUnsupportedLanguage: string;
  reasonLowConfidence: string;
  reasonAiFlagged: string;

  // ステータス
  status: Record<ReplyStatus, string>;
  // クチコミの言語
  reviewLang: Record<ReviewLanguage, string>;

  // 再認証・エラー
  reauthNeeded: string;
  reauthLink: string;
  syncErrorPrefix: string;

  // 初期設定ウィザード（オーナー）
  setupTitle: string;
  stepOf: (n: number, total: number) => string;
  stepGoogleLogin: string;
  stepGoogleHint: string;
  stepSelectLocation: string;
  loggedInAs: string;
  loadingLocations: string;
  noLocations: string;
  alreadyRegistered: string;
  completeSetup: string;
  fetchingReviews: string;
  firstSyncNote: string;
  syncProgress: (fetched: number, generated: number) => string;
  setupDone: string;
  statFetched: string;
  statNew: string;
  statGenerated: string;
  someErrors: string;
  afterSetupNote: string;
  toDashboard: string;
  wizardBudgetNote: string;
  locationLoadFailed: string;
  registerFailed: string;

  // パスコード管理（オーナー）
  passcodeTitle: string;
  passcodeLead: string;
  issueNew: string;
  issueNewHint: string;
  labelPlaceholder: string;
  issue: string;
  issuing: string;
  issuedTitle: string;
  rotatedTitle: string;
  onceOnly: string;
  staffUrlLabel: string;
  copyBoth: string;
  copied: string;
  closeNoted: string;
  rotate: string;
  pause: string;
  resume: string;
  activeLabel: string;
  inactiveLabel: string;
  lastUsed: string;
  unused: string;
  rotatedAt: string;
  noPasscodes: string;
  handoverTitle: string;
  handoverWarn: string;
  securityStatus: string;
  activePasscodes: string;
  failedLogins24h: string;
  bruteForceWarning: string;
  issueFailed: string;
  updateFailed: string;
  copyFailed: string;

  // API のエラー（利用者に見える分だけ）
  errLoginRequired: string;
  errOwnerOnly: string;
  errNotFound: string;
  errAlreadyPublished: string;
  errEmptyReply: string;
  errTooLong: (max: number, len: number) => string;
  errPasscodeWrong: string;
  errTooManyAttempts: (minutes: number) => string;
  errPublishedNoEdit: string;
};

const ja: Dict = {
  appName: 'Hoshi Jungle Review AI',
  owner: 'オーナー',
  staff: 'スタッフ',
  logout: 'ログアウト',
  syncNow: '今すぐ同期',
  syncing: '同期中…',
  passcodeAdmin: 'パスコード管理',
  lastSync: '最終同期',
  neverSynced: '未実行',
  autoHourly: '毎時自動で取得しています',
  networkError: 'ネットワークエラーが発生しました。',
  loading: '読み込んでいます…',

  navInbox: '未返信',
  navAttention: '要確認',
  navArchive: '履歴',

  landingLead:
    'Googleマップのクチコミに、届いた言語のまま返信案を作成します。公開はスタッフの確認後です。',
  forStaff: 'スタッフの方',
  forStaffHint: 'ホテルから配布されたパスコードで入室します。',
  enterWithPasscode: 'パスコードで入る',
  forOwner: 'オーナー・管理者の方',
  forOwnerHint: '初回のGoogle連携と、スタッフ用パスコードの発行を行います。',
  signInWithGoogle: 'Google アカウントでログイン',
  ownerAccountNote:
    'Hoshi Jungle の Google ビジネスプロフィールを管理している Google アカウントでログインしてください。',

  staffLogin: 'スタッフ用ログイン',
  passcode: 'パスコード',
  showPasscode: 'パスコードを表示',
  hidePasscode: 'パスコードを隠す',
  enter: '入室する',
  checking: '確認しています…',
  askAdmin: 'パスコードが分からない場合は、ホテルの管理者に確認してください。',
  ownerLinkHere: 'オーナー・管理者の方はこちら',

  inboxTitle: '未返信のクチコミ',
  inboxLead: 'AIが作成した返信案です。内容を確認・編集してから公開してください。',
  attentionTitle: '要確認リスト',
  attentionLead:
    '自動公開の対象外です。低評価・インドネシア語・AIが要確認と判定したクチコミが表示されます。',
  archiveTitle: '返信履歴',
  archiveLead: '公開済みの返信と、「返信しない」と判断したクチコミの一覧です。',
  emptyInbox: '未返信のクチコミはありません。',
  emptyAttention: '確認が必要なクチコミはありません。',
  emptyArchive: 'まだ履歴がありません。',
  languageFilter: '言語フィルター',
  allLanguages: 'すべて',
  indonesianPriorityNote:
    'Bahasa Indonesia は現地スタッフによる表現確認が必須です（オレンジ表示）。',

  anonymous: '匿名',
  noReviewText: '（本文なし・星評価のみ）',
  needsCheck: '要確認',
  replyDraft: 'AIが作成した返信案',
  replyEdited: '返信案（編集済み）',
  replyPublished: '公開した返信',
  publish: 'Googleに公開',
  publishing: '公開中…',
  saveDraft: '下書きを保存',
  saving: '保存中…',
  regenerate: 'AIで作り直す',
  regenerating: '生成中…',
  skip: '返信しない',
  noReplyYet: '返信案がまだありません。次回の同期で自動生成されます。',
  saveFirst: '先に「保存」を押してから公開してください。',
  savedNotice: '下書きを保存しました。',
  publishedNotice: 'Google に公開しました。',
  regeneratedNotice: '3つの返信案を作り直しました。',
  skippedNotice: 'このクチコミには返信しない設定にしました。',
  emptyReply: '返信が空です。文章を入れてください。',
  publishFailed: '前回の公開失敗',
  publishedAt: 'に公開済み',
  switchConfirm: '編集した内容が失われます。別の案に切り替えますか？',
  edited: '編集済み（どの案にも一致しません）',
  pickStyle: '返信案を選ぶ',

  styleWarm: '丁寧',
  styleStandard: '標準',
  styleConcise: '簡潔',
  styleWarmHint: '気持ちを込めた、いちばん厚い言い方',
  styleStandardHint: '丁寧さと簡潔さのバランス型',
  styleConciseHint: '短く要点だけ。忙しい日向け',

  remainingThisMonth: '今月の AI 返信案: 残りおよそ',
  budgetExhausted:
    '今月の AI 生成上限に達しました。クチコミの取得は続いていますが、新しい返信案は作成されません。返信は手動で書いていただくか、来月1日のリセットをお待ちください。',

  reasonLowRating: '低評価（1〜2つ星）のため、公開前に必ず内容を確認してください',
  reasonIndonesian: 'インドネシア語のため、現地スタッフによる表現確認が必要です',
  reasonUnsupportedLanguage: '対応言語以外の可能性があります',
  reasonLowConfidence: '言語の自動判定が低信頼です',
  reasonAiFlagged: 'AI が要確認と判定しました',

  status: {
    draft: 'AI生成（未確認）',
    edited: '編集済み（未公開）',
    published: '公開済み',
    failed: '失敗',
    skipped: '返信しない',
  },
  reviewLang: {
    ja: '日本語',
    en: 'English',
    id: 'Bahasa Indonesia',
    zh: '中文',
    ko: '한국어',
    other: 'その他',
  },

  reauthNeeded: 'Google のアクセス権が失効しています。クチコミの取得と公開ができません。',
  reauthLink: '再認証する',
  syncErrorPrefix: '直近の自動同期でエラーが発生しました:',

  setupTitle: '初期設定',
  stepOf: (n, total) => `ステップ ${n} / ${total}`,
  stepGoogleLogin: 'Google アカウントでログイン',
  stepGoogleHint:
    'Hoshi Jungle の Google ビジネスプロフィールを管理しているアカウントでログインしてください。',
  stepSelectLocation: '対象のロケーションを選択',
  loggedInAs: 'ログイン中',
  loadingLocations: 'Google からロケーションを読み込んでいます…',
  noLocations:
    'このアカウントで管理できるロケーションが見つかりませんでした。Google ビジネスプロフィールの管理者権限があるアカウントでログインし直してください。',
  alreadyRegistered: '登録済み',
  completeSetup: 'このロケーションで設定を完了する',
  fetchingReviews: 'クチコミを取得しています…',
  firstSyncNote: '初回はクチコミの取得と返信案の作成を行うため、1〜2 分かかることがあります。',
  syncProgress: (f, g) => `クチコミ ${f} 件を取得、返信案 ${g} 件を作成しました。続きを処理しています…`,
  setupDone: '設定が完了しました',
  statFetched: '取得したクチコミ',
  statNew: '新規',
  statGenerated: '返信案を作成',
  someErrors: '一部の処理でエラーが発生しました:',
  afterSetupNote:
    '以降は毎時自動でクチコミを取得し、返信案を作成します。返信案はドラフトとして保存され、公開はスタッフの確認後に行われます。',
  toDashboard: 'ダッシュボードへ',
  wizardBudgetNote:
    '今月の AI 生成上限に達したため、一部のクチコミは返信案が未作成です。来月 1 日にリセットされます。それまでは手動で返信できます。',
  locationLoadFailed: 'ロケーションの取得に失敗しました。',
  registerFailed: '登録に失敗しました。',

  passcodeTitle: 'スタッフ用パスコード',
  passcodeLead:
    'スタッフはここで発行したパスコードで入室します。Google アカウントは不要です。スタッフは Google の認証情報に一切触れず、クチコミの確認・編集・公開だけを行えます。',
  issueNew: '新しいパスコードを発行',
  issueNewHint:
    '用途ごとに分けて発行すると、片方だけを停止できます（例: 「フロント用」「マネージャー用」）。',
  labelPlaceholder: '用途の名前（例: フロントデスク用）',
  issue: '発行する',
  issuing: '発行中…',
  issuedTitle: 'パスコードを発行しました',
  rotatedTitle: 'パスコードを再発行しました',
  onceOnly: 'この画面を閉じると二度と表示できません。今すぐ控えてください。',
  staffUrlLabel: 'スタッフが開く URL',
  copyBoth: 'URL とパスコードをコピー',
  copied: 'コピーしました',
  closeNoted: '控えたので閉じる',
  rotate: '再発行',
  pause: '停止',
  resume: '再開',
  activeLabel: '有効',
  inactiveLabel: '停止中',
  lastUsed: '最終利用',
  unused: '未使用',
  rotatedAt: '再発行',
  noPasscodes: 'まだパスコードを発行していません。上のフォームから発行してください。',
  handoverTitle: 'Hoshi Jungle Review AI ログイン情報',
  handoverWarn: '※ このパスコードは他の人に共有しないでください。',
  securityStatus: 'セキュリティの状況',
  activePasscodes: '有効なパスコード',
  failedLogins24h: '直近24時間のログイン失敗',
  bruteForceWarning:
    'ログイン失敗が多く発生しています。総当たり攻撃の可能性があるため、パスコードの再発行を検討してください（同一IPからは15分あたり10回で自動的に遮断されます）。',
  issueFailed: 'パスコードの発行に失敗しました。',
  updateFailed: '更新に失敗しました。',
  copyFailed: 'コピーできませんでした。手動で控えてください。',

  errLoginRequired: 'ログインが必要です。',
  errOwnerOnly: 'この操作はオーナーアカウントでのみ実行できます。',
  errNotFound: '見つかりません。',
  errAlreadyPublished: 'この返信は既に公開されています。',
  errEmptyReply: '返信本文が空です。編集してから公開してください。',
  errTooLong: (max, len) =>
    `返信本文が Google の上限 ${max} 文字を超えています（現在 ${len} 文字）。`,
  errPasscodeWrong: 'パスコードが違います。',
  errTooManyAttempts: (m) => `試行回数が多すぎます。${m} 分ほど待ってからもう一度お試しください。`,
  errPublishedNoEdit: '公開済みの返信は編集できません。',
};

const en: Dict = {
  appName: 'Hoshi Jungle Review AI',
  owner: 'Owner',
  staff: 'Staff',
  logout: 'Sign out',
  syncNow: 'Sync now',
  syncing: 'Syncing…',
  passcodeAdmin: 'Passcodes',
  lastSync: 'Last sync',
  neverSynced: 'never',
  autoHourly: 'Syncs automatically every hour',
  networkError: 'A network error occurred.',
  loading: 'Loading…',

  navInbox: 'To reply',
  navAttention: 'Needs check',
  navArchive: 'History',

  landingLead:
    'Draft replies for your Google reviews, written in the language the guest used. Nothing is published until your staff approve it.',
  forStaff: 'For staff',
  forStaffHint: 'Sign in with the passcode the hotel gave you.',
  enterWithPasscode: 'Enter with passcode',
  forOwner: 'For owners and administrators',
  forOwnerHint: 'Connect Google once, then issue passcodes for your staff.',
  signInWithGoogle: 'Sign in with Google',
  ownerAccountNote:
    'Use the Google account that manages the Hoshi Jungle Business Profile.',

  staffLogin: 'Staff sign-in',
  passcode: 'Passcode',
  showPasscode: 'Show passcode',
  hidePasscode: 'Hide passcode',
  enter: 'Enter',
  checking: 'Checking…',
  askAdmin: "If you don't know the passcode, ask your hotel administrator.",
  ownerLinkHere: 'Owners and administrators, sign in here',

  inboxTitle: 'Reviews to reply to',
  inboxLead: 'These drafts were written by AI. Read, edit if needed, then publish.',
  attentionTitle: 'Needs a closer look',
  attentionLead:
    'Never published automatically. Low ratings, Indonesian reviews, and anything the AI flagged appear here.',
  archiveTitle: 'History',
  archiveLead: 'Replies you published, and reviews you decided not to answer.',
  emptyInbox: 'Nothing waiting for a reply.',
  emptyAttention: 'Nothing needs checking right now.',
  emptyArchive: 'No history yet.',
  languageFilter: 'Filter by language',
  allLanguages: 'All',
  indonesianPriorityNote:
    'Indonesian replies must be checked by local staff (shown in orange).',

  anonymous: 'Anonymous',
  noReviewText: '(rating only — no text)',
  needsCheck: 'Needs check',
  replyDraft: 'AI draft reply',
  replyEdited: 'Reply (edited)',
  replyPublished: 'Published reply',
  publish: 'Publish to Google',
  publishing: 'Publishing…',
  saveDraft: 'Save draft',
  saving: 'Saving…',
  regenerate: 'Rewrite with AI',
  regenerating: 'Writing…',
  skip: "Don't reply",
  noReplyYet: 'No draft yet. One will be written at the next sync.',
  saveFirst: 'Save your changes before publishing.',
  savedNotice: 'Draft saved.',
  publishedNotice: 'Published to Google.',
  regeneratedNotice: 'Three new drafts written.',
  skippedNotice: 'Marked as no reply needed.',
  emptyReply: 'The reply is empty. Please write something.',
  publishFailed: 'Last publish failed',
  publishedAt: 'Published',
  switchConfirm: 'Your edits will be lost. Switch to another draft?',
  edited: 'Edited — no longer matches any draft',
  pickStyle: 'Choose a draft',

  styleWarm: 'Warm',
  styleStandard: 'Standard',
  styleConcise: 'Short',
  styleWarmHint: 'The fullest, most personal wording',
  styleStandardHint: 'Balanced — polite but not long',
  styleConciseHint: 'Short and to the point, for busy days',

  remainingThisMonth: 'AI drafts left this month: about',
  budgetExhausted:
    "This month's AI limit has been reached. Reviews still arrive, but no new drafts are written. Write replies by hand, or wait for the reset on the 1st.",

  reasonLowRating: 'Low rating (1–2 stars) — please read carefully before publishing',
  reasonIndonesian: 'Indonesian — please have local staff check the wording',
  reasonUnsupportedLanguage: 'May be a language we do not support yet',
  reasonLowConfidence: 'Language detection was uncertain',
  reasonAiFlagged: 'Flagged by the AI for review',

  status: {
    draft: 'AI draft',
    edited: 'Edited (not published)',
    published: 'Published',
    failed: 'Failed',
    skipped: 'No reply',
  },
  reviewLang: {
    ja: '日本語',
    en: 'English',
    id: 'Bahasa Indonesia',
    zh: '中文',
    ko: '한국어',
    other: 'Other',
  },

  reauthNeeded:
    'Google access has expired. Reviews cannot be fetched and replies cannot be published.',
  reauthLink: 'Reconnect',
  syncErrorPrefix: 'The last automatic sync failed:',

  setupTitle: 'Setup',
  stepOf: (n, total) => `Step ${n} of ${total}`,
  stepGoogleLogin: 'Sign in with Google',
  stepGoogleHint:
    'Sign in with the Google account that manages the Hoshi Jungle Business Profile.',
  stepSelectLocation: 'Choose your location',
  loggedInAs: 'Signed in as',
  loadingLocations: 'Loading your locations from Google…',
  noLocations:
    'No locations found for this account. Sign in with an account that has owner or manager access to the Business Profile.',
  alreadyRegistered: 'Already added',
  completeSetup: 'Finish setup with this location',
  fetchingReviews: 'Fetching reviews…',
  firstSyncNote: 'The first sync fetches reviews and writes drafts — this can take a minute or two.',
  syncProgress: (f, g) => `${f} reviews fetched, ${g} drafts written. Continuing…`,
  setupDone: 'Setup complete',
  statFetched: 'Reviews fetched',
  statNew: 'New',
  statGenerated: 'Drafts written',
  someErrors: 'Some steps reported errors:',
  afterSetupNote:
    'From now on, reviews are fetched every hour and drafts are written automatically. Drafts are saved as drafts — nothing is published until your staff approve it.',
  toDashboard: 'Go to dashboard',
  wizardBudgetNote:
    "This month's AI limit was reached, so some reviews have no draft yet. The limit resets on the 1st. Until then you can write replies by hand.",
  locationLoadFailed: 'Could not load your locations.',
  registerFailed: 'Could not save the location.',

  passcodeTitle: 'Staff passcodes',
  passcodeLead:
    'Your staff sign in with a passcode issued here — no Google account needed. They never touch your Google credentials; they can only read, edit and publish replies.',
  issueNew: 'Issue a new passcode',
  issueNewHint:
    'Issue separate passcodes per use so you can revoke one without affecting the other (e.g. "Front desk", "Managers").',
  labelPlaceholder: 'What is it for? (e.g. Front desk)',
  issue: 'Issue',
  issuing: 'Issuing…',
  issuedTitle: 'Passcode issued',
  rotatedTitle: 'New passcode issued',
  onceOnly: 'This is the only time it will be shown. Write it down now.',
  staffUrlLabel: 'URL for staff',
  copyBoth: 'Copy URL and passcode',
  copied: 'Copied',
  closeNoted: "I've written it down",
  rotate: 'Reissue',
  pause: 'Disable',
  resume: 'Enable',
  activeLabel: 'Active',
  inactiveLabel: 'Disabled',
  lastUsed: 'Last used',
  unused: 'never used',
  rotatedAt: 'Reissued',
  noPasscodes: 'No passcodes yet. Issue one using the form above.',
  handoverTitle: 'Hoshi Jungle Review AI — sign-in details',
  handoverWarn: 'Please do not share this passcode with anyone else.',
  securityStatus: 'Security',
  activePasscodes: 'Active passcodes',
  failedLogins24h: 'Failed sign-ins (last 24h)',
  bruteForceWarning:
    'There have been a lot of failed sign-ins. This may be a brute-force attempt — consider reissuing the passcode. (A single IP is blocked after 10 failures in 15 minutes.)',
  issueFailed: 'Could not issue the passcode.',
  updateFailed: 'Could not save the change.',
  copyFailed: 'Could not copy. Please write it down manually.',

  errLoginRequired: 'Please sign in.',
  errOwnerOnly: 'Only the owner account can do this.',
  errNotFound: 'Not found.',
  errAlreadyPublished: 'This reply has already been published.',
  errEmptyReply: 'The reply is empty. Please write something before publishing.',
  errTooLong: (max, len) =>
    `The reply is over Google's ${max}-character limit (currently ${len}).`,
  errPasscodeWrong: 'That passcode is not correct.',
  errTooManyAttempts: (m) => `Too many attempts. Please wait about ${m} minutes and try again.`,
  errPublishedNoEdit: 'Published replies cannot be edited.',
};

const id: Dict = {
  appName: 'Hoshi Jungle Review AI',
  owner: 'Pemilik',
  staff: 'Staf',
  logout: 'Keluar',
  syncNow: 'Sinkronkan sekarang',
  syncing: 'Menyinkronkan…',
  passcodeAdmin: 'Kode akses',
  lastSync: 'Sinkronisasi terakhir',
  neverSynced: 'belum pernah',
  autoHourly: 'Diperbarui otomatis setiap jam',
  networkError: 'Terjadi gangguan jaringan.',
  loading: 'Memuat…',

  navInbox: 'Belum dibalas',
  navAttention: 'Perlu dicek',
  navArchive: 'Riwayat',

  landingLead:
    'Draf balasan untuk ulasan Google Anda, ditulis dalam bahasa yang dipakai tamu. Tidak ada yang terbit sebelum staf menyetujuinya.',
  forStaff: 'Untuk staf',
  forStaffHint: 'Masuk dengan kode akses yang diberikan hotel.',
  enterWithPasscode: 'Masuk dengan kode akses',
  forOwner: 'Untuk pemilik dan admin',
  forOwnerHint: 'Hubungkan Google sekali, lalu buat kode akses untuk staf.',
  signInWithGoogle: 'Masuk dengan Google',
  ownerAccountNote:
    'Gunakan akun Google yang mengelola Profil Bisnis Hoshi Jungle.',

  staffLogin: 'Masuk sebagai staf',
  passcode: 'Kode akses',
  showPasscode: 'Tampilkan kode',
  hidePasscode: 'Sembunyikan kode',
  enter: 'Masuk',
  checking: 'Memeriksa…',
  askAdmin: 'Jika tidak tahu kode aksesnya, tanyakan kepada admin hotel.',
  ownerLinkHere: 'Pemilik dan admin masuk di sini',

  inboxTitle: 'Ulasan yang belum dibalas',
  inboxLead: 'Draf ini ditulis oleh AI. Baca, sunting bila perlu, lalu terbitkan.',
  attentionTitle: 'Perlu dicek lebih teliti',
  attentionLead:
    'Tidak pernah terbit otomatis. Ulasan bintang rendah, berbahasa Indonesia, dan yang ditandai AI muncul di sini.',
  archiveTitle: 'Riwayat',
  archiveLead: 'Balasan yang sudah terbit, dan ulasan yang diputuskan tidak dibalas.',
  emptyInbox: 'Tidak ada ulasan yang menunggu balasan.',
  emptyAttention: 'Tidak ada yang perlu dicek saat ini.',
  emptyArchive: 'Belum ada riwayat.',
  languageFilter: 'Saring menurut bahasa',
  allLanguages: 'Semua',
  indonesianPriorityNote:
    'Balasan berbahasa Indonesia wajib dicek staf lokal (ditandai oranye).',

  anonymous: 'Anonim',
  noReviewText: '(hanya bintang — tanpa teks)',
  needsCheck: 'Perlu dicek',
  replyDraft: 'Draf balasan dari AI',
  replyEdited: 'Balasan (sudah disunting)',
  replyPublished: 'Balasan yang terbit',
  publish: 'Terbitkan ke Google',
  publishing: 'Menerbitkan…',
  saveDraft: 'Simpan draf',
  saving: 'Menyimpan…',
  regenerate: 'Tulis ulang dengan AI',
  regenerating: 'Menulis…',
  skip: 'Tidak dibalas',
  noReplyYet: 'Belum ada draf. Akan dibuat pada sinkronisasi berikutnya.',
  saveFirst: 'Simpan dulu perubahan Anda sebelum menerbitkan.',
  savedNotice: 'Draf tersimpan.',
  publishedNotice: 'Terbit di Google.',
  regeneratedNotice: 'Tiga draf baru telah ditulis.',
  skippedNotice: 'Ditandai tidak perlu dibalas.',
  emptyReply: 'Balasan masih kosong. Silakan tulis isinya.',
  publishFailed: 'Penerbitan terakhir gagal',
  publishedAt: 'Terbit',
  switchConfirm: 'Suntingan Anda akan hilang. Ganti ke draf lain?',
  edited: 'Sudah disunting — tidak cocok dengan draf mana pun',
  pickStyle: 'Pilih draf',

  styleWarm: 'Hangat',
  styleStandard: 'Standar',
  styleConcise: 'Singkat',
  styleWarmHint: 'Paling lengkap dan personal',
  styleStandardHint: 'Seimbang — sopan tapi tidak panjang',
  styleConciseHint: 'Singkat dan langsung, untuk hari sibuk',

  remainingThisMonth: 'Sisa draf AI bulan ini: sekitar',
  budgetExhausted:
    'Batas AI bulan ini sudah tercapai. Ulasan tetap masuk, tetapi draf baru tidak dibuat. Silakan tulis balasan secara manual, atau tunggu reset tanggal 1.',

  reasonLowRating: 'Bintang rendah (1–2) — mohon baca teliti sebelum menerbitkan',
  reasonIndonesian: 'Bahasa Indonesia — mohon staf lokal memeriksa pilihan katanya',
  reasonUnsupportedLanguage: 'Kemungkinan bahasa yang belum kami dukung',
  reasonLowConfidence: 'Deteksi bahasa kurang meyakinkan',
  reasonAiFlagged: 'Ditandai AI untuk diperiksa',

  status: {
    draft: 'Draf AI',
    edited: 'Disunting (belum terbit)',
    published: 'Terbit',
    failed: 'Gagal',
    skipped: 'Tidak dibalas',
  },
  reviewLang: {
    ja: '日本語',
    en: 'English',
    id: 'Bahasa Indonesia',
    zh: '中文',
    ko: '한국어',
    other: 'Lainnya',
  },

  reauthNeeded:
    'Akses Google sudah kedaluwarsa. Ulasan tidak bisa diambil dan balasan tidak bisa diterbitkan.',
  reauthLink: 'Hubungkan ulang',
  syncErrorPrefix: 'Sinkronisasi otomatis terakhir gagal:',

  setupTitle: 'Pengaturan awal',
  stepOf: (n, total) => `Langkah ${n} dari ${total}`,
  stepGoogleLogin: 'Masuk dengan Google',
  stepGoogleHint:
    'Masuk dengan akun Google yang mengelola Profil Bisnis Hoshi Jungle.',
  stepSelectLocation: 'Pilih lokasi',
  loggedInAs: 'Masuk sebagai',
  loadingLocations: 'Memuat lokasi dari Google…',
  noLocations:
    'Tidak ada lokasi untuk akun ini. Masuklah dengan akun yang punya akses pemilik atau pengelola pada Profil Bisnis.',
  alreadyRegistered: 'Sudah terdaftar',
  completeSetup: 'Selesaikan pengaturan dengan lokasi ini',
  fetchingReviews: 'Mengambil ulasan…',
  firstSyncNote:
    'Sinkronisasi pertama mengambil ulasan dan menulis draf — bisa memakan waktu satu hingga dua menit.',
  syncProgress: (f, g) => `${f} ulasan diambil, ${g} draf dibuat. Melanjutkan…`,
  setupDone: 'Pengaturan selesai',
  statFetched: 'Ulasan diambil',
  statNew: 'Baru',
  statGenerated: 'Draf dibuat',
  someErrors: 'Beberapa langkah melaporkan kesalahan:',
  afterSetupNote:
    'Mulai sekarang ulasan diambil setiap jam dan draf dibuat otomatis. Draf disimpan sebagai draf — tidak ada yang terbit sebelum staf menyetujuinya.',
  toDashboard: 'Ke dasbor',
  wizardBudgetNote:
    'Batas AI bulan ini sudah tercapai, jadi sebagian ulasan belum punya draf. Batas direset tanggal 1. Sampai saat itu balasan bisa ditulis manual.',
  locationLoadFailed: 'Gagal memuat daftar lokasi.',
  registerFailed: 'Gagal menyimpan lokasi.',

  passcodeTitle: 'Kode akses staf',
  passcodeLead:
    'Staf masuk dengan kode akses yang dibuat di sini — tanpa akun Google. Mereka tidak menyentuh kredensial Google Anda; hanya membaca, menyunting, dan menerbitkan balasan.',
  issueNew: 'Buat kode akses baru',
  issueNewHint:
    'Buat kode terpisah per kebutuhan agar satu bisa dinonaktifkan tanpa mengganggu yang lain (misalnya "Resepsionis", "Manajer").',
  labelPlaceholder: 'Untuk apa? (misalnya Resepsionis)',
  issue: 'Buat',
  issuing: 'Membuat…',
  issuedTitle: 'Kode akses dibuat',
  rotatedTitle: 'Kode akses baru dibuat',
  onceOnly: 'Kode ini hanya ditampilkan sekali. Catat sekarang.',
  staffUrlLabel: 'URL untuk staf',
  copyBoth: 'Salin URL dan kode akses',
  copied: 'Tersalin',
  closeNoted: 'Sudah saya catat',
  rotate: 'Buat ulang',
  pause: 'Nonaktifkan',
  resume: 'Aktifkan',
  activeLabel: 'Aktif',
  inactiveLabel: 'Nonaktif',
  lastUsed: 'Terakhir dipakai',
  unused: 'belum pernah',
  rotatedAt: 'Dibuat ulang',
  noPasscodes: 'Belum ada kode akses. Buat satu lewat formulir di atas.',
  handoverTitle: 'Hoshi Jungle Review AI — informasi masuk',
  handoverWarn: 'Mohon jangan bagikan kode akses ini kepada orang lain.',
  securityStatus: 'Keamanan',
  activePasscodes: 'Kode akses aktif',
  failedLogins24h: 'Gagal masuk (24 jam terakhir)',
  bruteForceWarning:
    'Banyak percobaan masuk yang gagal. Ini bisa jadi serangan tebak-tebakan — pertimbangkan membuat ulang kode akses. (Satu IP diblokir setelah 10 kegagalan dalam 15 menit.)',
  issueFailed: 'Gagal membuat kode akses.',
  updateFailed: 'Gagal menyimpan perubahan.',
  copyFailed: 'Gagal menyalin. Mohon catat secara manual.',

  errLoginRequired: 'Silakan masuk terlebih dahulu.',
  errOwnerOnly: 'Hanya akun pemilik yang dapat melakukan ini.',
  errNotFound: 'Tidak ditemukan.',
  errAlreadyPublished: 'Balasan ini sudah diterbitkan.',
  errEmptyReply: 'Balasan masih kosong. Tulis isinya sebelum menerbitkan.',
  errTooLong: (max, len) =>
    `Balasan melebihi batas ${max} karakter dari Google (saat ini ${len}).`,
  errPasscodeWrong: 'Kode akses salah.',
  errTooManyAttempts: (m) => `Terlalu banyak percobaan. Tunggu sekitar ${m} menit lalu coba lagi.`,
  errPublishedNoEdit: 'Balasan yang sudah terbit tidak bisa disunting.',
};

const DICTS: Record<UiLang, Dict> = { ja, en, id };

export function t(lang: UiLang): Dict {
  return DICTS[lang] ?? DICTS[DEFAULT_UI_LANG];
}

/** 要確認の理由コード。文言は表示時に翻訳する（DBには言語非依存のコードを保存する）。 */
export const ATTENTION_CODES = [
  'low_rating',
  'indonesian',
  'unsupported_language',
  'low_confidence',
  'ai_flagged',
] as const;
export type AttentionCode = (typeof ATTENTION_CODES)[number];

export function attentionText(lang: UiLang, code: string): string {
  const d = t(lang);
  switch (code) {
    case 'low_rating':
      return d.reasonLowRating;
    case 'indonesian':
      return d.reasonIndonesian;
    case 'unsupported_language':
      return d.reasonUnsupportedLanguage;
    case 'low_confidence':
      return d.reasonLowConfidence;
    case 'ai_flagged':
      return d.reasonAiFlagged;
    default:
      return code;
  }
}
