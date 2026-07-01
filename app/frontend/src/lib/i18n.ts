export type Language = 'en' | 'is';

export const LANGUAGES: Language[] = ['en', 'is'];

export const en = {
  nav: {
    home: 'Home',
    calendar: 'Calendar',
    library: 'Library',
    stats: 'Stats',
    about: 'About',
    logout: 'Logout',
    settings: 'Settings',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  login: {
    appTitle: 'Orchestra Manager Application',
    logoAlt: 'Orchestra Manager logo',
    signIn: 'Sign in',
    username: 'Username',
    usernamePlaceholder: 'admin or musician',
    password: 'Password',
    failed: 'Login failed',
    devCreds: 'dev creds: admin/admin123 or musician/musician123',
  },
  footer: {
    tagline: 'Plan rehearsals, manage your music library, and keep your ensemble in sync.',
    navigate: 'Navigate',
    resources: 'Resources',
    help: 'Help & Support',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact',
    rights: '\u00A9 {year} Mrak Web Development. All rights reserved.',
  },
  dashboard: {
    latestNews: 'Latest News',
    todayEvents: "Today's Events",
    noToday: 'No events scheduled for today.',
    tomorrowEvents: "Tomorrow's Events",
    noTomorrow: 'No events scheduled for tomorrow.',
  },
  stats: {
    title: 'Stats',
    search: 'Search all fields...',
    columns: 'Columns:',
    allHidden: 'All columns are hidden. Enable at least one column to view data.',
    noMatching: 'No matching entries.',
    noData: 'No data available.',
    col: {
      dateTime: 'Date & time',
      title: 'Title',
      activity: 'Activity',
      venue: 'Venue',
      program: 'Program',
      conductor: 'Conductor',
      soloists: 'Soloist',
      otherParticipants: 'Other participants',
      ensemble: 'Ensemble',
      dress: 'Dress',
      other: 'Other',
    },
  },
  calendar: {
    viewLabel: 'Calendar view',
    month: 'Month',
    week: 'Week',
    addEvent: '+ Add Event',
    today: 'Today',
    prevWeek: 'Previous week',
    prevMonth: 'Previous month',
    nextWeek: 'Next week',
    nextMonth: 'Next month',
    weekHeader: 'Week {week} \u00B7 {start} \u2013 {end}',
    copiedBannerPrefix: 'Copied ',
    copiedBannerSuffix: ' \u2014 click a day to paste it.',
    eventFallback: 'event',
    cancel: 'Cancel',
    pasteHere: 'Paste copied event here',
    pasteFailed: 'Failed to paste event. Please try again.',
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  library: {
    title: 'Library',
    createFolder: 'New folder',
    createFolderAria: 'Create subfolder in {name}',
    createFolderRootAria: 'Create folder',
    folderName: 'Folder name',
    create: 'Create',
    cancel: 'Cancel',
    createFailed: 'Failed to create folder',
    rename: 'Rename',
    renameFolder: 'Rename folder',
    renameAria: 'Rename {name}',
    newName: 'New name',
    renameFailed: 'Rename failed. Please try again.',
    save: 'Save',
    upload: 'Upload',
    uploading: 'Uploading\u2026',
    uploadSuccess: 'Uploaded successfully',
    uploadFailed: 'Upload failed. Files up to 50MB are allowed.',
    deleteConfirm: 'Delete "{name}"? This cannot be undone.',
    deleteFailed: 'Delete failed. Please try again.',
    deleteAria: 'Delete {name}',
    libraryFallback: 'Library',
    noFolders: 'No folders found',
    filePathMissing: 'File path not found.',
    downloadFailed: 'Download failed.',
    downloadFailedRetry: 'Download failed. Please try again.',
    targetFolder: 'Target folder',
    dropzone: 'Drag & drop files here or click to select',
  },
  event: {
    create: 'Create Event',
    details: 'Event Details',
    fallbackTitle: 'Event',
    color: 'Color',
    title: 'Title',
    activity: 'Activity',
    venue: 'Venue',
    program: 'Program',
    conductor: 'Conductor',
    soloists: 'Soloists',
    otherParticipants: 'Other Participants',
    ensemble: 'Ensemble',
    dress: 'Dress',
    other: 'Other',
    dateTime: 'Date & Time',
    musicLibrary: 'Music Library',
    openFolder: 'Open Folder',
    noFolder: 'No folder detected',
    deleteEvent: 'Delete event',
    addToCalendar: 'Add to Calendar',
    copy: 'Copy',
    close: 'Close',
    createBtn: 'Create',
    save: 'Save',
    deleteConfirm: 'Delete "{title}"? This cannot be undone.',
    thisEvent: 'this event',
    deleteFailed: 'Failed to delete event. Please try again.',
  },
  news: {
    titlePlaceholder: 'Title',
    contentPlaceholder: 'Write an update...',
    post: 'Post',
    attachments: 'Attachments',
    delete: 'Delete',
    loadFileFailed: 'Failed to load file.',
    downloadFileFailed: 'Failed to download file.',
    loadPdfFailed: 'Failed to load PDF.',
  },
  pdf: {
    download: 'Download',
    close: 'Close',
    loading: 'Loading PDF\u2026',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your preferences for Orchestra Manager.',
    appearance: 'Appearance',
    darkMode: 'Dark mode',
    darkModeDesc: 'Switch between light and dark appearance.',
    darkModeToggle: 'Toggle dark mode',
    calendar: 'Calendar',
    compactEvents: 'Compact events',
    compactDesc: 'Show each calendar event as two lines of text instead of the larger layout.',
    compactToggle: 'Toggle compact calendar events',
    language: 'Language',
    languageDesc: 'Choose the language used across the app.',
    english: 'English',
    icelandic: 'Icelandic',
  },
  about: {
    title: 'About',
    intro:
      'Orchestra Manager helps you plan rehearsals, manage your music library, and keep your ensemble in sync.',
    help: {
      heading: 'Help & Support',
      p1: "Need a hand? We're here to help you get the most out of Orchestra Manager.",
      p2: "Browse common questions below, or reach out to our team and we'll get back to you as soon as we can.",
      items: [
        {
          label: 'Getting started:',
          text: 'Use the Calendar to schedule rehearsals and concerts, and the Music Library to organize your scores and parts.',
        },
        {
          label: 'Managing events:',
          text: 'Click any date to add or edit an event. Members can view upcoming activities from the dashboard.',
        },
        {
          label: 'Account & access:',
          text: 'Contact your administrator if you have trouble signing in or need updated permissions.',
        },
      ],
      contactPrefix: 'Still stuck? Email us at ',
      contactSuffix: " and we'll be happy to assist.",
    },
    privacy: {
      heading: 'Privacy Policy',
      intro:
        'Your privacy is important to us. This Privacy Policy explains how Orchestra Manager collects, uses, and protects your information when you use our service.',
      sections: [
        {
          label: 'Information we collect.',
          text: 'We collect information you provide directly, such as your name, email address, and any content you add to the platform (events, files, and notes). We also collect basic usage data to help us improve the service.',
        },
        {
          label: 'How we use information.',
          text: 'We use your information to operate and maintain the service, communicate with you, and improve your experience. We do not sell your personal information to third parties.',
        },
        {
          label: 'Data storage and security.',
          text: 'We take reasonable measures to protect your data against unauthorized access, alteration, or disclosure. However, no method of transmission or storage is completely secure.',
        },
        {
          label: 'Your rights.',
          text: 'You may request access to, correction of, or deletion of your personal information at any time by contacting us.',
        },
      ],
      contactPrefix: 'If you have any questions about this Privacy Policy, please contact us at ',
      contactSuffix: '.',
    },
    terms: {
      heading: 'Terms of Service',
      intro:
        'By accessing or using Orchestra Manager, you agree to be bound by these Terms of Service. Please read them carefully.',
      sections: [
        {
          label: 'Use of the service.',
          text: 'You agree to use the service only for lawful purposes and in accordance with these terms. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.',
        },
        {
          label: 'Content.',
          text: 'You retain ownership of the content you upload, but grant us the rights necessary to host and display it within the service. You are responsible for ensuring you have the rights to any content you share.',
        },
        {
          label: 'Availability.',
          text: 'We strive to keep the service available but do not guarantee uninterrupted access. We may modify, suspend, or discontinue features at any time.',
        },
        {
          label: 'Limitation of liability.',
          text: 'The service is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for any damages arising from your use of the service.',
        },
        {
          label: 'Changes to these terms.',
          text: 'We may update these Terms of Service from time to time. Continued use of the service after changes take effect constitutes acceptance of the revised terms.',
        },
      ],
    },
  },
};

export type Translations = typeof en;

export const is: Translations = {
  nav: {
    home: 'Heim',
    calendar: 'Dagatal',
    library: 'Safn',
    stats: 'T\u00F6lfr\u00E6\u00F0i',
    about: 'Um',
    logout: '\u00DAtskr\u00E1',
    settings: 'Stillingar',
    openMenu: 'Opna valmynd',
    closeMenu: 'Loka valmynd',
  },
  login: {
    appTitle: 'Orchestra Manager forrit',
    logoAlt: 'Orchestra Manager merki',
    signIn: 'Skr\u00E1 inn',
    username: 'Notandanafn',
    usernamePlaceholder: 'admin e\u00F0a musician',
    password: 'Lykilor\u00F0',
    failed: 'Innskr\u00E1ning mist\u00F3kst',
    devCreds: '\u00FEr\u00F3unara\u00F0gangur: admin/admin123 e\u00F0a musician/musician123',
  },
  footer: {
    tagline: 'Skipulegg\u00F0u \u00E6fingar, haltu utan um n\u00F3tnasafni\u00F0 og haltu h\u00F3pnum samstilltum.',
    navigate: 'Yfirlit',
    resources: 'Tilf\u00F6ng',
    help: 'Hj\u00E1lp og a\u00F0sto\u00F0',
    privacy: 'Pers\u00F3nuverndarstefna',
    terms: '\u00DEj\u00F3nustuskilm\u00E1lar',
    contact: 'Haf\u00F0u samband',
    rights: '\u00A9 {year} Mrak Web Development. Allur r\u00E9ttur \u00E1skilinn.',
  },
  dashboard: {
    latestNews: 'N\u00FDjustu fr\u00E9ttir',
    todayEvents: 'Vi\u00F0bur\u00F0ir dagsins',
    noToday: 'Engir vi\u00F0bur\u00F0ir \u00E1 dagskr\u00E1 \u00ED dag.',
    tomorrowEvents: 'Vi\u00F0bur\u00F0ir \u00E1 morgun',
    noTomorrow: 'Engir vi\u00F0bur\u00F0ir \u00E1 dagskr\u00E1 \u00E1 morgun.',
  },
  stats: {
    title: 'T\u00F6lfr\u00E6\u00F0i',
    search: 'Leita \u00ED \u00F6llum reitum\u2026',
    columns: 'D\u00E1lkar:',
    allHidden: 'Allir d\u00E1lkar eru faldir. Virkja\u00F0u a\u00F0 minnsta kosti einn d\u00E1lk til a\u00F0 sj\u00E1 g\u00F6gn.',
    noMatching: 'Engar samsvarandi f\u00E6rslur.',
    noData: 'Engin g\u00F6gn til\u00E6k.',
    col: {
      dateTime: 'Dagsetning og t\u00EDmi',
      title: 'Titill',
      activity: 'A\u00F0ger\u00F0',
      venue: 'Sta\u00F0setning',
      program: 'Efnisskr\u00E1',
      conductor: 'Hlj\u00F3msveitarstj\u00F3ri',
      soloists: 'Einleikari',
      otherParticipants: 'A\u00F0rir \u00FE\u00E1tttakendur',
      ensemble: 'Hlj\u00F3msveit',
      dress: 'Kl\u00E6\u00F0na\u00F0ur',
      other: 'Anna\u00F0',
    },
  },
  calendar: {
    viewLabel: 'Sko\u00F0un dagatals',
    month: 'M\u00E1nu\u00F0ur',
    week: 'Vika',
    addEvent: '+ B\u00E6ta vi\u00F0 vi\u00F0bur\u00F0i',
    today: '\u00CD dag',
    prevWeek: 'Fyrri vika',
    prevMonth: 'Fyrri m\u00E1nu\u00F0ur',
    nextWeek: 'N\u00E6sta vika',
    nextMonth: 'N\u00E6sti m\u00E1nu\u00F0ur',
    weekHeader: 'Vika {week} \u00B7 {start} \u2013 {end}',
    copiedBannerPrefix: 'Afrita\u00F0i ',
    copiedBannerSuffix: ' \u2014 smelltu \u00E1 dag til a\u00F0 l\u00EDma.',
    eventFallback: 'vi\u00F0bur\u00F0',
    cancel: 'H\u00E6tta vi\u00F0',
    pasteHere: 'L\u00EDma afrita\u00F0an vi\u00F0bur\u00F0 h\u00E9r',
    pasteFailed: 'Mist\u00F3kst a\u00F0 l\u00EDma vi\u00F0bur\u00F0. Reyndu aftur.',
    months: [
      'Jan\u00FAar', 'Febr\u00FAar', 'Mars', 'Apr\u00EDl', 'Ma\u00ED', 'J\u00FAn\u00ED',
      'J\u00FAl\u00ED', '\u00C1g\u00FAst', 'September', 'Okt\u00F3ber', 'N\u00F3vember', 'Desember',
    ],
    weekdays: ['M\u00E1n', '\u00DEri', 'Mi\u00F0', 'Fim', 'F\u00F6s', 'Lau', 'Sun'],
  },
  library: {
    title: 'Safn',
    createFolder: 'N\u00FD m\u00F6ppu',
    createFolderAria: 'Stofna undirm\u00F6ppu \u00ED {name}',
    createFolderRootAria: 'Stofna m\u00F6ppu',
    folderName: 'M\u00F6ppuheiti',
    create: 'Stofna',
    cancel: 'H\u00E6tta vi\u00F0',
    createFailed: 'Mist\u00F3kst a\u00F0 stofna m\u00F6ppu',
    rename: 'Endurnefna',
    renameFolder: 'Endurnefna m\u00F6ppu',
    renameAria: 'Endurnefna {name}',
    newName: 'N\u00FDtt heiti',
    renameFailed: 'Endurnefning mist\u00F3kst. Reyndu aftur.',
    save: 'Vista',
    upload: 'Hla\u00F0a upp',
    uploading: 'Hle\u00F0 upp\u2026',
    uploadSuccess: 'Upphle\u00F0sla t\u00F3kst',
    uploadFailed: 'Upphle\u00F0sla mist\u00F3kst. Skr\u00E1r allt a\u00F0 50MB eru leyf\u00F0ar.',
    deleteConfirm: 'Ey\u00F0a \u201E{name}\u201C? \u00DEetta er ekki h\u00E6gt a\u00F0 afturkalla.',
    deleteFailed: 'Ey\u00F0ing mist\u00F3kst. Reyndu aftur.',
    deleteAria: 'Ey\u00F0a {name}',
    libraryFallback: 'Safn',
    noFolders: 'Engar m\u00F6ppur fundust',
    filePathMissing: 'Sl\u00F3\u00F0 skr\u00E1ar fannst ekki.',
    downloadFailed: 'Ni\u00F0urhal mist\u00F3kst.',
    downloadFailedRetry: 'Ni\u00F0urhal mist\u00F3kst. Reyndu aftur.',
    targetFolder: 'Markmappa',
    dropzone: 'Drag\u00F0u og slepptu skr\u00E1m h\u00E9r e\u00F0a smelltu til a\u00F0 velja',
  },
  event: {
    create: 'Stofna vi\u00F0bur\u00F0',
    details: 'Uppl\u00Fdsingar um vi\u00F0bur\u00F0',
    fallbackTitle: 'Vi\u00F0bur\u00F0ur',
    color: 'Litur',
    title: 'Titill',
    activity: 'A\u00F0ger\u00F0',
    venue: 'Sta\u00F0setning',
    program: 'Efnisskr\u00E1',
    conductor: 'Hlj\u00F3msveitarstj\u00F3ri',
    soloists: 'Einleikarar',
    otherParticipants: 'A\u00F0rir \u00FE\u00E1tttakendur',
    ensemble: 'Hlj\u00F3msveit',
    dress: 'Kl\u00E6\u00F0na\u00F0ur',
    other: 'Anna\u00F0',
    dateTime: 'Dagsetning og t\u00EDmi',
    musicLibrary: 'N\u00F3tnasafn',
    openFolder: 'Opna m\u00F6ppu',
    noFolder: 'Engin mappa fannst',
    deleteEvent: 'Ey\u00F0a vi\u00F0bur\u00F0i',
    addToCalendar: 'B\u00E6ta \u00ED dagatal',
    copy: 'Afrita',
    close: 'Loka',
    createBtn: 'Stofna',
    save: 'Vista',
    deleteConfirm: 'Ey\u00F0a \u201E{title}\u201C? \u00DEetta er ekki h\u00E6gt a\u00F0 afturkalla.',
    thisEvent: '\u00FEennan vi\u00F0bur\u00F0',
    deleteFailed: 'Mist\u00F3kst a\u00F0 ey\u00F0a vi\u00F0bur\u00F0i. Reyndu aftur.',
  },
  news: {
    titlePlaceholder: 'Titill',
    contentPlaceholder: 'Skrifa\u00F0u uppf\u00E6rslu\u2026',
    post: 'Birta',
    attachments: 'Vi\u00F0hengi',
    delete: 'Ey\u00F0a',
    loadFileFailed: 'Mist\u00F3kst a\u00F0 hla\u00F0a skr\u00E1.',
    downloadFileFailed: 'Mist\u00F3kst a\u00F0 s\u00E6kja skr\u00E1.',
    loadPdfFailed: 'Mist\u00F3kst a\u00F0 hla\u00F0a PDF.',
  },
  pdf: {
    download: 'S\u00E6kja',
    close: 'Loka',
    loading: 'Hle\u00F0 PDF\u2026',
  },
  settings: {
    title: 'Stillingar',
    subtitle: 'Stj\u00F3rna\u00F0u stillingum \u00FE\u00EDnum fyrir Orchestra Manager.',
    appearance: '\u00DAtlit',
    darkMode: 'D\u00F6kkt \u00FEema',
    darkModeDesc: 'Skiptu \u00E1 milli lj\u00F3ss og d\u00F6kks \u00FAtlits.',
    darkModeToggle: 'V\u00EDxla d\u00F6kku \u00FEema',
    calendar: 'Dagatal',
    compactEvents: '\u00DE\u00E9ttir vi\u00F0bur\u00F0ir',
    compactDesc: 'S\u00FDna hvern vi\u00F0bur\u00F0 sem tv\u00E6r l\u00EDnur af texta \u00ED sta\u00F0 st\u00E6rri \u00FAtlits.',
    compactToggle: 'V\u00EDxla \u00FE\u00E9ttum vi\u00F0bur\u00F0um',
    language: 'Tungum\u00E1l',
    languageDesc: 'Veldu tungum\u00E1li\u00F0 sem nota\u00F0 er \u00ED forritinu.',
    english: 'Enska',
    icelandic: '\u00CDslenska',
  },
  about: {
    title: 'Um',
    intro:
      'Orchestra Manager hj\u00E1lpar \u00FE\u00E9r a\u00F0 skipuleggja \u00E6fingar, halda utan um n\u00F3tnasafni\u00F0 og halda h\u00F3pnum samstilltum.',
    help: {
      heading: 'Hj\u00E1lp og a\u00F0sto\u00F0',
      p1: 'Vantar \u00FEig a\u00F0sto\u00F0? Vi\u00F0 erum h\u00E9r til a\u00F0 hj\u00E1lpa \u00FE\u00E9r a\u00F0 n\u00FDta Orchestra Manager sem best.',
      p2: 'Sko\u00F0a\u00F0u algengar spurningar h\u00E9r a\u00F0 ne\u00F0an e\u00F0a haf\u00F0u samband vi\u00F0 teymi\u00F0 okkar og vi\u00F0 sv\u00F6rum eins flj\u00F3tt og vi\u00F0 getum.',
      items: [
        {
          label: 'Hvernig \u00E1 a\u00F0 byrja:',
          text: 'Nota\u00F0u dagatali\u00F0 til a\u00F0 skipuleggja \u00E6fingar og t\u00F3nleika, og n\u00F3tnasafni\u00F0 til a\u00F0 halda utan um n\u00F3tur og raddir.',
        },
        {
          label: 'Umsj\u00F3n vi\u00F0bur\u00F0a:',
          text: 'Smelltu \u00E1 hva\u00F0a dagsetningu sem er til a\u00F0 b\u00E6ta vi\u00F0 e\u00F0a breyta vi\u00F0bur\u00F0i. Me\u00F0limir geta s\u00E9\u00F0 komandi vi\u00F0bur\u00F0i \u00E1 fors\u00ED\u00F0unni.',
        },
        {
          label: 'A\u00F0gangur og heimildir:',
          text: 'Haf\u00F0u samband vi\u00F0 kerfisstj\u00F3ra ef \u00FE\u00FA \u00E1tt \u00ED vandr\u00E6\u00F0um me\u00F0 innskr\u00E1ningu e\u00F0a \u00FEarft uppf\u00E6r\u00F0ar heimildir.',
        },
      ],
      contactPrefix: 'Ertu enn \u00ED vandr\u00E6\u00F0um? Sendu okkur t\u00F6lvup\u00F3st \u00E1 ',
      contactSuffix: ' og vi\u00F0 a\u00F0sto\u00F0um \u00FEig me\u00F0 gl\u00F6\u00F0u ge\u00F0i.',
    },
    privacy: {
      heading: 'Pers\u00F3nuverndarstefna',
      intro:
        'Pers\u00F3nuvernd \u00FE\u00EDn skiptir okkur m\u00E1li. \u00DEessi pers\u00F3nuverndarstefna \u00FAtsk\u00FDrir hvernig Orchestra Manager safnar, notar og verndar uppl\u00FDsingar \u00FE\u00EDnar \u00FEegar \u00FE\u00FA notar \u00FEj\u00F3nustuna.',
      sections: [
        {
          label: 'Uppl\u00FDsingar sem vi\u00F0 s\u00F6fnum.',
          text: 'Vi\u00F0 s\u00F6fnum uppl\u00FDsingum sem \u00FE\u00FA gefur beint, svo sem nafni \u00FE\u00EDnu, netfangi og \u00F6llu efni sem \u00FE\u00FA b\u00E6tir vi\u00F0 kerfi\u00F0 (vi\u00F0bur\u00F0um, skr\u00E1m og gl\u00F3sum). Vi\u00F0 s\u00F6fnum einnig grunnnotkunarg\u00F6gnum til a\u00F0 b\u00E6ta \u00FEj\u00F3nustuna.',
        },
        {
          label: 'Hvernig vi\u00F0 notum uppl\u00FDsingar.',
          text: 'Vi\u00F0 notum uppl\u00FDsingar \u00FE\u00EDnar til a\u00F0 reka og vi\u00F0halda \u00FEj\u00F3nustunni, eiga samskipti vi\u00F0 \u00FEig og b\u00E6ta upplifun \u00FE\u00EDna. Vi\u00F0 seljum ekki pers\u00F3nuuppl\u00FDsingar \u00FE\u00EDnar til \u00FEri\u00F0ja a\u00F0ila.',
        },
        {
          label: 'Geymsla og \u00F6ryggi gagna.',
          text: 'Vi\u00F0 gerum e\u00F0lilegar r\u00E1\u00F0stafanir til a\u00F0 vernda g\u00F6gn \u00FE\u00EDn gegn \u00F3heimilum a\u00F0gangi, breytingum e\u00F0a birtingu. Hins vegar er engin a\u00F0fer\u00F0 vi\u00F0 sendingu e\u00F0a geymslu fullkomlega \u00F6rugg.',
        },
        {
          label: 'R\u00E9ttindi \u00FE\u00EDn.',
          text: '\u00DE\u00FA getur hven\u00E6r sem er \u00F3ska\u00F0 eftir a\u00F0gangi a\u00F0, lei\u00F0r\u00E9ttingu \u00E1 e\u00F0a ey\u00F0ingu \u00E1 pers\u00F3nuuppl\u00FDsingum \u00FE\u00EDnum me\u00F0 \u00FEv\u00ED a\u00F0 hafa samband vi\u00F0 okkur.',
        },
      ],
      contactPrefix: 'Ef \u00FE\u00FA hefur einhverjar spurningar um \u00FEessa pers\u00F3nuverndarstefnu, vinsamlegast haf\u00F0u samband vi\u00F0 okkur \u00E1 ',
      contactSuffix: '.',
    },
    terms: {
      heading: '\u00DEj\u00F3nustuskilm\u00E1lar',
      intro:
        'Me\u00F0 \u00FEv\u00ED a\u00F0 nota Orchestra Manager sam\u00FEykkir \u00FE\u00FA a\u00F0 vera bundin(n) af \u00FEessum \u00FEj\u00F3nustuskilm\u00E1lum. Vinsamlegast lestu \u00FE\u00E1 vandlega.',
      sections: [
        {
          label: 'Notkun \u00FEj\u00F3nustunnar.',
          text: '\u00DE\u00FA sam\u00FEykkir a\u00F0 nota \u00FEj\u00F3nustuna eing\u00F6ngu \u00ED l\u00F6gm\u00E6tum tilgangi og \u00ED samr\u00E6mi vi\u00F0 \u00FEessa skilm\u00E1la. \u00DE\u00FA ber\u00F0 \u00E1byrg\u00F0 \u00E1 a\u00F0 halda a\u00F0gangsuppl\u00FDsingum \u00FE\u00EDnum leyndum og \u00E1 allri virkni undir reikningnum \u00FE\u00EDnum.',
        },
        {
          label: 'Efni.',
          text: '\u00DE\u00FA heldur eignarr\u00E9tti \u00E1 efninu sem \u00FE\u00FA hle\u00F0ur upp, en veitir okkur nau\u00F0synleg r\u00E9ttindi til a\u00F0 h\u00FDsa \u00FEa\u00F0 og birta innan \u00FEj\u00F3nustunnar. \u00DE\u00FA ber\u00F0 \u00E1byrg\u00F0 \u00E1 a\u00F0 tryggja a\u00F0 \u00FE\u00FA hafir r\u00E9ttindi \u00E1 \u00F6llu efni sem \u00FE\u00FA deilir.',
        },
        {
          label: 'A\u00F0gengi.',
          text: 'Vi\u00F0 leggjum okkur fram um a\u00F0 halda \u00FEj\u00F3nustunni a\u00F0gengilegri en \u00E1byrgjumst ekki \u00F3trufla\u00F0an a\u00F0gang. Vi\u00F0 getum breytt, gert hl\u00E9 \u00E1 e\u00F0a h\u00E6tt eiginleikum hven\u00E6r sem er.',
        },
        {
          label: 'Takm\u00F6rkun \u00E1byrg\u00F0ar.',
          text: '\u00DEj\u00F3nustan er veitt \u201Eeins og h\u00FAn er\u201C \u00E1n nokkurra \u00E1byrg\u00F0a. A\u00F0 \u00FEv\u00ED marki sem l\u00F6g leyfa berum vi\u00F0 ekki \u00E1byrg\u00F0 \u00E1 neinu tj\u00F3ni sem hl\u00FDst af notkun \u00FEinni \u00E1 \u00FEj\u00F3nustunni.',
        },
        {
          label: 'Breytingar \u00E1 \u00FEessum skilm\u00E1lum.',
          text: 'Vi\u00F0 getum uppf\u00E6rt \u00FEessa \u00FEj\u00F3nustuskilm\u00E1la af og til. \u00C1framhaldandi notkun \u00FEj\u00F3nustunnar eftir a\u00F0 breytingar taka gildi telst sam\u00FEykki \u00E1 endursko\u00F0u\u00F0um skilm\u00E1lum.',
        },
      ],
    },
  },
};

export const translations: Record<Language, Translations> = { en, is };

export const LOCALES: Record<Language, string | undefined> = {
  en: undefined,
  is: 'is-IS',
};

function resolvePath(dict: Translations, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

export function translate(
  language: Language,
  key: string,
  params?: Record<string, string | number>
): string {
  const value = resolvePath(translations[language], key);
  let result = typeof value === 'string' ? value : key;
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
    }
  }
  return result;
}
