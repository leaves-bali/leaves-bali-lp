/**
 * Bali Hotel Needs Assessment 2026 — Google Forms generator
 *
 * What it does (one run, ~30 seconds):
 *   1. Creates a Drive folder "Bali Hotel Needs Assessment 2026"
 *   2. Creates the ENGLISH form (29 questions, 6 sections)
 *   3. Creates the JAPANESE form (identical structure, 日本語)
 *   4. Creates a linked response spreadsheet for each form
 *   5. Logs the responder URL + editor URL + spreadsheet URL for both
 *
 * How to run:
 *   script.google.com  ->  New project  ->  paste this file  ->  Save
 *   Select function "createAllForms"  ->  Run  ->  approve permissions
 *   View -> Logs (Ctrl+Enter) to get the links.
 *
 * Re-running creates a NEW set of forms. Delete the old folder first if
 * you are iterating on the wording.
 */

// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

function createAllForms() {
  var folder = getOrCreateFolder_(CONFIG.folderName);
  var out = [];
  out.push(buildForm_(SURVEY.en, folder));
  out.push(buildForm_(SURVEY.ja, folder));
  logSummary_(out, folder);
  return out;
}

function createEnglishFormOnly() {
  var folder = getOrCreateFolder_(CONFIG.folderName);
  var r = buildForm_(SURVEY.en, folder);
  logSummary_([r], folder);
  return r;
}

function createJapaneseFormOnly() {
  var folder = getOrCreateFolder_(CONFIG.folderName);
  var r = buildForm_(SURVEY.ja, folder);
  logSummary_([r], folder);
  return r;
}

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

var CONFIG = {
  folderName: 'Bali Hotel Needs Assessment 2026',
  showProgressBar: true,
  allowResponseEdits: true,
  collectEmailAddresses: false   // keep false: it forces Google login and kills response rate
};

// ---------------------------------------------------------------------------
// SURVEY CONTENT
// Each language block is a plain data structure, so editing wording never
// requires touching the builder logic below.
// item types: 'text' | 'choice' | 'checkbox' | 'scale' | 'section'
// ---------------------------------------------------------------------------

var SURVEY = {

  // =========================================================================
  // ENGLISH
  // =========================================================================
  en: {
    key: 'ENGLISH',
    title: 'Bali Hotel Needs Assessment 2026 - Quick Survey',
    description:
      'A 5-minute survey on how Bali hotels manage guests, staff and payroll today.\n' +
      'Your answers are confidential and used only to design better operational tools for Bali properties.\n' +
      'All questions marked * are required.',
    confirmation:
      'Thank you! Your input helps us build tools that actually fit how Bali hotels operate.\n' +
      'If you asked for follow-up, we will reach out within 3 business days.',
    responseSheetName: 'Form_Responses_ENGLISH',
    contactSectionTitle: 'Contact Information (Optional)',
    contactSectionHelp: 'Great! Can we follow up with you? Leave at least one contact method.',
    contactFields: [
      'Manager/Owner Name',
      'WhatsApp/Phone',
      'Email'
    ],
    // Q28 choices that route INTO the contact section (must match choice text below)
    contactTriggers: ['Yes, definitely', 'Maybe, want more info'],

    items: [
      { type: 'section', title: '1. Hotel Profile',
        help: '5 quick questions about your property.' },

      { type: 'text', title: 'Hotel Name', required: true },

      { type: 'text', title: 'Location/Area (e.g., Ubud, Seminyak, Canggu)', required: true },

      { type: 'choice', title: 'How many rooms do you have?', required: true,
        choices: ['Less than 20 rooms', '20-50 rooms', '51-100 rooms', '101-200 rooms', 'More than 200 rooms'] },

      { type: 'choice', title: 'What year was the hotel established?', required: true,
        choices: ['Before 2015', '2015-2017', '2018-2020', '2021-2023', '2024-2026'] },

      { type: 'text', title: "What's your current average occupancy rate (%)?", required: true,
        numberBetween: [0, 100],
        help: 'Enter a number between 0 and 100.',
        validationMessage: 'Please enter a number between 0 and 100.' },

      { type: 'section', title: '2. Guest & Customer Management',
        help: 'How you handle bookings, guest data and follow-up.' },

      { type: 'checkbox', title: 'Who are your primary guests?', required: true,
        help: 'Select all that apply.',
        choices: ['International tourists', 'Domestic tourists', 'Business travelers', 'Long-term/monthly guests', 'Expats/digital nomads'] },

      { type: 'choice', title: 'How do you currently manage guest inquiries and bookings?', required: true,
        choices: ['Email only', 'WhatsApp/messaging apps', 'Hotel website booking system',
                  'Third-party booking platform (Booking.com, Agoda, etc.)', 'Professional PMS (Property Management System)',
                  'Spreadsheet/manual', 'Multiple systems (combination)'] },

      { type: 'choice', title: 'Do you track repeat/returning guests and their preferences?', required: true,
        choices: ['Yes, in a system (database/app)', 'Yes, manually (notes/spreadsheet)',
                  'Partially (staff remember some)', "No, we don't track this"] },

      { type: 'checkbox', title: 'What information do you record about guests?', required: false,
        help: 'Select all that apply.',
        choices: ['Name & contact info', 'Room preferences', 'Dietary/special requests', 'Past visits & history',
                  'Payment/billing info', 'Special occasions (birthdays, anniversaries)', 'Language preferences',
                  'Allergies/health restrictions'] },

      { type: 'text', title: "What's your biggest challenge with guest/customer management RIGHT NOW?",
        required: true, paragraph: true },

      { type: 'choice', title: 'How do you currently follow up with guests after checkout?', required: true,
        other: true,
        choices: ['Email newsletter/survey', 'WhatsApp message', 'Phone call',
                  'Repeat guest discount codes', "We don't follow up"] },

      { type: 'section', title: '3. Staff Management & Operations',
        help: 'Shifts, attendance and payroll.' },

      { type: 'choice', title: 'How many staff members do you have in total?', required: true,
        choices: ['5-10 staff', '11-20 staff', '21-50 staff', '51-100 staff', 'More than 100 staff'] },

      { type: 'text', title: 'How many departments/teams do you have?', required: true,
        help: 'e.g., Front desk, Housekeeping, Kitchen, Admin, Security, Maintenance' },

      { type: 'choice', title: 'How do you currently assign work shifts to staff?', required: true,
        choices: ['Verbal/face-to-face', 'WhatsApp/messaging group', 'Notice board/paper schedule',
                  'Spreadsheet', 'Scheduling app', 'No formal system'] },

      { type: 'choice', title: 'How do you track staff work hours and attendance?', required: true,
        choices: ['Manual logbook/sign-in sheet', 'Digital time clock/app', 'Spreadsheet (manual entry)',
                  'No formal tracking', 'Staff honor system'] },

      { type: 'choice', title: 'How do you currently calculate and process payroll?', required: true,
        choices: ['Manually by manager', 'Spreadsheet formula', 'Accounting/payroll software',
                  'Bank transfer/HR system', 'Partially automated', 'No formal process'] },

      { type: 'choice', title: 'How often do you pay staff?', required: true,
        other: true,
        choices: ['Weekly', 'Bi-weekly', 'Monthly', 'As-needed/irregular'] },

      { type: 'text', title: "What's your biggest challenge with staff management RIGHT NOW?",
        required: true, paragraph: true },

      { type: 'section', title: '4. Current Tools & Systems',
        help: 'What you run the hotel on today, and what it costs.' },

      { type: 'checkbox', title: 'What software/systems are you currently using to run the hotel?',
        required: false, other: true,
        help: 'Select all that apply.',
        choices: ['PMS (e.g., Hotelogix, Softinn, etc.)', 'Booking.com/OTA integrations',
                  'Accounting software (QuickBooks, etc.)', 'HR/Payroll software', 'WhatsApp/Telegram',
                  'Google Workspace (Sheets/Docs/Forms)', 'No formal system (manual/spreadsheet)'] },

      { type: 'scale', title: 'How satisfied are you with your current systems overall?', required: true,
        lower: 1, upper: 5,
        lowerLabel: '1 = Very unsatisfied', upperLabel: '5 = Very satisfied' },

      { type: 'text', title: 'What works WELL with your current systems?', required: true, paragraph: true },

      { type: 'text', title: 'What FRUSTRATES you most about your current systems?', required: true, paragraph: true },

      { type: 'choice', title: 'How much do you currently spend per month on software/technology?',
        required: true,
        choices: ['Nothing/Free tools only', 'USD 1-100', 'USD 101-300', 'USD 301-500',
                  'USD 501-1,000', 'USD 1,000+', "Don't know"] },

      { type: 'section', title: '5. Pain Points & Solution Interest',
        help: 'The last 5 questions — this is the part that shapes what we build.' },

      { type: 'text', title: 'If you could INSTANTLY solve ONE operational problem today, what would it be?',
        required: true, paragraph: true },

      { type: 'choice', title: 'Would an INTEGRATED SYSTEM be useful for you?', required: true,
        help: 'It would combine:\n' +
              '• Guest booking & management\n' +
              '• Staff scheduling & shift assignment\n' +
              '• Time tracking & attendance\n' +
              '• Payroll calculation & processing\n' +
              '• Performance/KPI tracking',
        choices: ['Yes, very interested', 'Maybe/depends on price', 'Not sure', 'No, not interested'] },

      { type: 'choice', title: "What's your ideal monthly budget for such an integrated system?",
        required: true,
        choices: ['Under USD 100', 'USD 100-250', 'USD 251-500', 'USD 501-1,000',
                  'USD 1,000+', "Don't know"] },

      { type: 'choice', title: 'When would you ideally need this solution ready?', required: true,
        choices: ['Immediately/ASAP', 'Within 1-3 months', 'Within 3-6 months',
                  'Within 6-12 months', 'Not urgent/just exploring'] },

      // MUST be the last item before the contact section — page navigation only
      // takes effect on the final question of a section.
      { type: 'choice', title: 'Would you be interested in a FREE 30-day trial of such a system?',
        required: true, isContactGate: true,
        choices: ['Yes, definitely', 'Maybe, want more info', 'No, not interested'] }
    ]
  },

  // =========================================================================
  // 日本語
  // =========================================================================
  ja: {
    key: 'JAPANESE',
    title: 'バリホテル ニーズ調査 2026 - クイック版',
    description:
      'バリ島のホテルが現在どのようにゲスト・スタッフ・給与を管理しているかについての5分間のアンケートです。\n' +
      '回答は機密として扱い、バリ島の宿泊施設向けの運営ツール設計のためにのみ使用します。\n' +
      '「*」のある設問は必須です。',
    confirmation:
      'ご協力ありがとうございました。いただいた回答は、バリ島のホテル運営の実態に合ったツール開発に活用します。\n' +
      'フォローアップをご希望の場合は、3営業日以内にご連絡いたします。',
    responseSheetName: 'Form_Responses_JAPANESE',
    contactSectionTitle: '連絡先（任意）',
    contactSectionHelp: 'ありがとうございます。フォローアップのご連絡をしてもよろしいですか？いずれか1つ以上をご記入ください。',
    contactFields: [
      'マネージャー/オーナー名',
      'WhatsApp/電話',
      'メール'
    ],
    contactTriggers: ['はい、ぜひ', '検討中、詳細が欲しい'],

    items: [
      { type: 'section', title: '1. ホテル基本情報',
        help: 'まずは施設についての5問です。' },

      { type: 'text', title: 'ホテル名', required: true },

      { type: 'text', title: 'ロケーション/エリア（例：ウブド、セミニャック、チャングー）', required: true },

      { type: 'choice', title: '客室数は?', required: true,
        choices: ['20室未満', '20-50室', '51-100室', '101-200室', '200室以上'] },

      { type: 'choice', title: 'ホテルは何年に開業しましたか?', required: true,
        choices: ['2015年より前', '2015-2017年', '2018-2020年', '2021-2023年', '2024-2026年'] },

      { type: 'text', title: '現在の平均稼働率（%）は?', required: true,
        numberBetween: [0, 100],
        help: '0〜100の数値でご入力ください。',
        validationMessage: '0〜100の数値を入力してください。' },

      { type: 'section', title: '2. ゲスト・顧客管理',
        help: '予約、ゲスト情報、フォローアップについて。' },

      { type: 'checkbox', title: '主なゲスト層は?', required: true,
        help: '該当するものを全て選択してください。',
        choices: ['海外観光客', '国内観光客', 'ビジネス出張者', '長期/月泊ゲスト', '駐在員/デジタルノマド'] },

      { type: 'choice', title: 'ゲスト問い合わせ・予約をどう管理していますか?', required: true,
        choices: ['メールのみ', 'WhatsApp/メッセージアプリ', 'ホテルサイト予約システム',
                  'OTA（Booking.com、Agoda等）', 'プロフェッショナルなPMS',
                  'スプレッドシート/手作業', '複数システムの組み合わせ'] },

      { type: 'choice', title: 'リピーターゲストと好みを追跡していますか?', required: true,
        choices: ['はい、システムで管理している', 'はい、手作業で（メモ/スプレッドシート）',
                  '部分的に（スタッフが覚えている）', 'いいえ、追跡していない'] },

      { type: 'checkbox', title: 'ゲストについてどんな情報を記録していますか?', required: false,
        help: '該当するものを全て選択してください。',
        choices: ['名前・連絡先', '客室の好み', '食事制限・特別リクエスト', '過去の宿泊・履歴',
                  '支払い・請求情報', '特別な日（誕生日、記念日）', '言語設定', 'アレルギー・健康制限'] },

      { type: 'text', title: 'ゲスト/顧客管理での最大の課題は?', required: true, paragraph: true },

      { type: 'choice', title: 'チェックアウト後、ゲストにどう対応していますか?', required: true,
        other: true,
        choices: ['メールニュースレター/アンケート', 'WhatsAppメッセージ', '電話',
                  'リピーター割引コード', 'フォローアップしていない'] },

      { type: 'section', title: '3. スタッフ管理・オペレーション',
        help: 'シフト、勤怠、給与について。' },

      { type: 'choice', title: 'スタッフは合計何人ですか?', required: true,
        choices: ['5-10人', '11-20人', '21-50人', '51-100人', '100人以上'] },

      { type: 'text', title: '部門/チームは何個ありますか?', required: true,
        help: '例：フロント、ハウスキーピング、キッチン、事務、セキュリティ、メンテナンス' },

      { type: 'choice', title: 'スタッフのシフトをどう割り当てていますか?', required: true,
        choices: ['口頭/対面', 'WhatsApp/メッセージグループ', '掲示板/紙のスケジュール',
                  'スプレッドシート', 'シフト管理アプリ', '正式なシステムなし'] },

      { type: 'choice', title: 'スタッフの勤務時間・出勤をどう追跡していますか?', required: true,
        choices: ['手書きログ/署名シート', 'デジタルタイムクロック/アプリ', 'スプレッドシート（手作業入力）',
                  '正式な追跡なし', 'スタッフの信頼ベース'] },

      { type: 'choice', title: '給与計算・処理をどう行っていますか?', required: true,
        choices: ['マネージャーが手作業', 'スプレッドシート計算', '会計/給与計算ソフト',
                  '銀行送金/HRシステム', '部分的に自動化', '正式なプロセスなし'] },

      { type: 'choice', title: 'スタッフの給与支払い頻度は?', required: true,
        other: true,
        choices: ['週払い', '2週間ごと', '月払い', '随時/不定期'] },

      { type: 'text', title: 'スタッフ管理での最大の課題は?', required: true, paragraph: true },

      { type: 'section', title: '4. 現在のツール・システム',
        help: '現在のホテル運営に使っているツールとコストについて。' },

      { type: 'checkbox', title: 'ホテル運営に現在使っているソフト/システムは?',
        required: false, other: true,
        help: '該当するものを全て選択してください。',
        choices: ['PMS（Hotelogix、Softinn等）', 'Booking.com/OTA連携',
                  '会計ソフト（QuickBooks等）', 'HR/給与計算ソフト', 'WhatsApp/Telegram',
                  'Google Workspace（Sheets/Docs/Forms）', '正式なシステムなし（手作業/スプレッドシート）'] },

      { type: 'scale', title: '現在のシステム全体にどの程度満足していますか?', required: true,
        lower: 1, upper: 5,
        lowerLabel: '1 = 非常に不満', upperLabel: '5 = 非常に満足' },

      { type: 'text', title: '現在のシステムで、うまくいっていることは?', required: true, paragraph: true },

      { type: 'text', title: '現在のシステムで、最もストレスを感じることは?', required: true, paragraph: true },

      { type: 'choice', title: '現在、ソフトウェア/技術に月額いくら使っていますか?', required: true,
        choices: ['なし/無料ツールのみ', 'USD 1-100', 'USD 101-300', 'USD 301-500',
                  'USD 501-1,000', 'USD 1,000以上', 'わかりません'] },

      { type: 'section', title: '5. 課題とソリューションへの関心',
        help: '最後の5問です。ここが開発方針を決める最も重要な部分です。' },

      { type: 'text', title: '今日、1つの業務課題を即座に解決できるなら、何ですか?',
        required: true, paragraph: true },

      { type: 'choice', title: '統合システムは有用ですか?', required: true,
        help: '以下を含みます:\n' +
              '• ゲスト予約・管理\n' +
              '• スタッフシフト管理\n' +
              '• 勤務時間・出勤追跡\n' +
              '• 給与計算・処理\n' +
              '• パフォーマンス/KPI追跡',
        choices: ['はい、非常に関心がある', '検討中/価格次第', 'わかりません', 'いいえ、関心ない'] },

      { type: 'choice', title: 'そのような統合システムの理想的な月額予算は?', required: true,
        choices: ['USD 100未満', 'USD 100-250', 'USD 251-500', 'USD 501-1,000',
                  'USD 1,000以上', 'わかりません'] },

      { type: 'choice', title: 'このソリューションはいつ必要ですか?', required: true,
        choices: ['今すぐ/急いでいる', '1-3ヶ月以内', '3-6ヶ月以内',
                  '6-12ヶ月以内', '急ではない/検討段階'] },

      { type: 'choice', title: 'そのようなシステムの無料30日トライアルに関心がありますか?',
        required: true, isContactGate: true,
        choices: ['はい、ぜひ', '検討中、詳細が欲しい', 'いいえ、関心ない'] }
    ]
  }
};

// ---------------------------------------------------------------------------
// BUILDER
// ---------------------------------------------------------------------------

function buildForm_(spec, folder) {
  var form = FormApp.create(spec.title);
  form.setDescription(spec.description);
  form.setConfirmationMessage(spec.confirmation);
  form.setProgressBar(CONFIG.showProgressBar);
  form.setAllowResponseEdits(CONFIG.allowResponseEdits);
  form.setCollectEmail(CONFIG.collectEmailAddresses);
  form.setShuffleQuestions(false);

  var gateItem = null;   // Q28 — routes to the contact section
  var i;

  for (i = 0; i < spec.items.length; i++) {
    var def = spec.items[i];
    var built = addItem_(form, def);
    if (def.isContactGate) {
      gateItem = built;
    }
  }

  // --- Conditional contact section (shown only if the gate answer is positive)
  var contactPage = form.addPageBreakItem()
    .setTitle(spec.contactSectionTitle)
    .setHelpText(spec.contactSectionHelp);

  for (i = 0; i < spec.contactFields.length; i++) {
    form.addTextItem().setTitle(spec.contactFields[i]).setRequired(false);
  }

  if (gateItem) {
    var choices = [];
    var gateDef = findGateDef_(spec);
    for (i = 0; i < gateDef.choices.length; i++) {
      var label = gateDef.choices[i];
      var goesToContact = spec.contactTriggers.indexOf(label) !== -1;
      choices.push(
        goesToContact
          ? gateItem.createChoice(label, contactPage)
          : gateItem.createChoice(label, FormApp.PageNavigationType.SUBMIT)
      );
    }
    gateItem.setChoices(choices);
  }

  // --- Linked response spreadsheet
  var ss = SpreadsheetApp.create(spec.responseSheetName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // --- Tidy files into the project folder
  moveToFolder_(form.getId(), folder);
  moveToFolder_(ss.getId(), folder);

  return {
    key: spec.key,
    title: spec.title,
    responderUrl: form.getPublishedUrl(),
    shortUrl: form.shortenFormUrl(form.getPublishedUrl()),
    editUrl: form.getEditUrl(),
    sheetUrl: ss.getUrl(),
    questionCount: form.getItems().length
  };
}

function addItem_(form, def) {
  switch (def.type) {

    case 'section':
      var page = form.addPageBreakItem().setTitle(def.title);
      if (def.help) page.setHelpText(def.help);
      return page;

    case 'text':
      var t = def.paragraph ? form.addParagraphTextItem() : form.addTextItem();
      t.setTitle(def.title).setRequired(!!def.required);
      if (def.help) t.setHelpText(def.help);
      if (def.numberBetween && !def.paragraph) {
        t.setValidation(
          FormApp.createTextValidation()
            .setHelpText(def.validationMessage || 'Please enter a valid number.')
            .requireNumberBetween(def.numberBetween[0], def.numberBetween[1])
            .build()
        );
      }
      return t;

    case 'choice':
      var c = form.addMultipleChoiceItem()
        .setTitle(def.title)
        .setChoiceValues(def.choices)
        .setRequired(!!def.required);
      if (def.help) c.setHelpText(def.help);
      if (def.other) c.showOtherOption(true);
      return c;

    case 'checkbox':
      var cb = form.addCheckboxItem()
        .setTitle(def.title)
        .setChoiceValues(def.choices)
        .setRequired(!!def.required);
      if (def.help) cb.setHelpText(def.help);
      if (def.other) cb.showOtherOption(true);
      return cb;

    case 'scale':
      var s = form.addScaleItem()
        .setTitle(def.title)
        .setBounds(def.lower, def.upper)
        .setLabels(def.lowerLabel, def.upperLabel)
        .setRequired(!!def.required);
      if (def.help) s.setHelpText(def.help);
      return s;

    default:
      throw new Error('Unknown item type: ' + def.type);
  }
}

function findGateDef_(spec) {
  for (var i = 0; i < spec.items.length; i++) {
    if (spec.items[i].isContactGate) return spec.items[i];
  }
  throw new Error('No item flagged with isContactGate in ' + spec.key);
}

// ---------------------------------------------------------------------------
// DRIVE HELPERS
// ---------------------------------------------------------------------------

function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function moveToFolder_(fileId, folder) {
  try {
    DriveApp.getFileById(fileId).moveTo(folder);
  } catch (e) {
    // Fallback for older Drive service behaviour
    var file = DriveApp.getFileById(fileId);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }
}

// ---------------------------------------------------------------------------
// OUTPUT
// ---------------------------------------------------------------------------

function logSummary_(results, folder) {
  var lines = [];
  lines.push('');
  lines.push('==================================================');
  lines.push(' BALI HOTEL NEEDS ASSESSMENT 2026 — FORMS CREATED');
  lines.push('==================================================');
  lines.push('Drive folder: ' + folder.getUrl());
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    lines.push('');
    lines.push('--- ' + r.key + ' ---');
    lines.push('Title         : ' + r.title);
    lines.push('Items in form : ' + r.questionCount + ' (incl. section headers)');
    lines.push('SHARE THIS    : ' + r.shortUrl);
    lines.push('Full link     : ' + r.responderUrl);
    lines.push('Edit form     : ' + r.editUrl);
    lines.push('Responses     : ' + r.sheetUrl);
  }
  lines.push('');
  lines.push('Send the SHARE THIS links to hotels via WhatsApp / email.');
  lines.push('==================================================');
  Logger.log(lines.join('\n'));
}
