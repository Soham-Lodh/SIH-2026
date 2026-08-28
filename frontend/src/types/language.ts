export interface Language {
  code: string; // ISO code (e.g., 'bn', 'hi', 'en')
  name: string; // English name (e.g., 'Bengali')
  nativeName: string; // Native script name (e.g., 'বাংলা')
  speechLocale: string; // BCP-47 locale (e.g., 'bn-IN')
  script: string;
}

export const INDIAN_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechLocale: 'en-IN', script: 'Latin' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechLocale: 'hi-IN', script: 'Devanagari' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speechLocale: 'bn-IN', script: 'Bengali' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechLocale: 'te-IN', script: 'Telugu' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speechLocale: 'mr-IN', script: 'Devanagari' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechLocale: 'ta-IN', script: 'Tamil' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', speechLocale: 'ur-IN', script: 'Arabic' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speechLocale: 'gu-IN', script: 'Gujarati' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechLocale: 'kn-IN', script: 'Kannada' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechLocale: 'or-IN', script: 'Odia' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechLocale: 'ml-IN', script: 'Malayalam' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechLocale: 'pa-IN', script: 'Gurmukhi' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', speechLocale: 'as-IN', script: 'Bengali-Assamese' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', speechLocale: 'hi-IN', script: 'Devanagari' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ / संथाली', speechLocale: 'hi-IN', script: 'Ol Chiki' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर / کٲشُر', speechLocale: 'ur-IN', script: 'Perso-Arabic' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', speechLocale: 'ne-NP', script: 'Devanagari' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', speechLocale: 'mr-IN', script: 'Devanagari' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي / सिन्धी', speechLocale: 'ur-IN', script: 'Arabic' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', speechLocale: 'hi-IN', script: 'Devanagari' },
  { code: 'mni', name: 'Manipuri (Meitei)', nativeName: 'মৈতৈলোন্', speechLocale: 'bn-IN', script: 'Meetei Mayek' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', speechLocale: 'hi-IN', script: 'Devanagari' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', speechLocale: 'hi-IN', script: 'Devanagari' },
];

export interface TranslationDictionary {
  appTitle: string;
  appSubtitle: string;
  presentTab: string;
  pastTab: string;
  liveStatus: string;
  staleStatus: string;
  activeAlerts: string;
  alertTypes: string;
  useMyLocation: string;
  checkAnotherLocation: string;
  searchLocationPlaceholder: string;
  nearMeMode: string;
  indiaMode: string;
  officialInstructionTitle: string;
  plainSummaryTitle: string;
  viewDetails: string;
  dismiss: string;
  share: string;
  copySummary: string;
  searchDisastersPlaceholder: string;
  historicalResearchTitle: string;
  compareEvents: string;
  aiAssistant: string;
  originalReports: string;
  timelineTitle: string;
  whatHappenedTitle: string;
  impactTitle: string;
  responseTitle: string;
  sourceAssessmentTitle: string;
  conflictingReportsTitle: string;
  noAlertsNearby: string;
  noActiveAlerts: string;
  currentNewsTitle: string;
  voiceAssistantTitle: string;
  voiceListening: string;
  voiceSpeakPrompt: string;
  searchLanguagePlaceholder: string;
  indiaMapTitle?: string;
  askAIAssistant?: string;
  pastDisastersTitle?: string;
  searchDisasterPlaceholder?: string;
  compareNow?: string;
}

export const TRANSLATIONS: Record<string, TranslationDictionary> = {
  en: {
    appTitle: "Disaster Intelligence Platform",
    appSubtitle: "Official Alerts • Geospatial Context • Grounded Research",
    presentTab: "PRESENT (Live Situation)",
    pastTab: "PAST (Historical Research)",
    liveStatus: "OFFICIAL FEED LIVE",
    staleStatus: "CACHED SNAPSHOT",
    activeAlerts: "Active Official Alerts",
    alertTypes: "Alert Categories",
    useMyLocation: "Use My Location",
    checkAnotherLocation: "Check Another Location",
    searchLocationPlaceholder: "Search Indian city, district or village...",
    nearMeMode: "NEAR ME",
    indiaMode: "ALL INDIA",
    officialInstructionTitle: "Official Instructions",
    plainSummaryTitle: "Situation Summary",
    viewDetails: "View Details",
    dismiss: "Dismiss",
    share: "Share Warning",
    copySummary: "Copy Summary",
    searchDisastersPlaceholder: "Search historical disasters, events or locations (e.g., Cyclone Fani, Kerala Floods)...",
    historicalResearchTitle: "Historical Disaster Research",
    compareEvents: "Compare Events",
    aiAssistant: "AI Research Assistant",
    originalReports: "Original Reports & Media",
    timelineTitle: "Chronological Timeline",
    whatHappenedTitle: "What Happened",
    impactTitle: "Human & Infrastructure Impact",
    responseTitle: "Government & Rescue Response",
    sourceAssessmentTitle: "Source Assessment",
    conflictingReportsTitle: "Conflicting Reports",
    noAlertsNearby: "No active alerts detected near your location.",
    noActiveAlerts: "No active official alerts currently in feed.",
    currentNewsTitle: "Verified Current News (72h Gate)",
    voiceAssistantTitle: "Multilingual Voice Assistant",
    voiceListening: "Listening in your language...",
    voiceSpeakPrompt: "Speak or ask anything in any Indian language",
    searchLanguagePlaceholder: "Search language (English or script)...",
    indiaMapTitle: "All India Disaster Live Map",
  },
  hi: {
    appTitle: "आपदा सूचना एवं अनुसंधान मंच",
    appSubtitle: "आधिकारिक अलर्ट • भू-स्थानिक संदर्भ • प्रामाणिक शोध",
    presentTab: "वर्तमान (सक्रिय आपदाएं)",
    pastTab: "अतीत (ऐतिहासिक शोध)",
    liveStatus: "लाइव आधिकारिक अलर्ट",
    staleStatus: "कैश डेटा (सत्यापित)",
    activeAlerts: "सक्रिय आधिकारिक अलर्ट",
    alertTypes: "आपदा श्रेणियां",
    useMyLocation: "मेरा स्थान उपयोग करें",
    checkAnotherLocation: "अन्य स्थान की जांच करें",
    searchLocationPlaceholder: "शहर, जिला या गांव खोजें...",
    nearMeMode: "मेरे निकट",
    indiaMode: "अखिल भारतीय",
    officialInstructionTitle: "आधिकारिक निर्देश",
    plainSummaryTitle: "स्थिति सारांश",
    viewDetails: "विवरण देखें",
    dismiss: "हटाएं",
    share: "चेतावनी साझा करें",
    copySummary: "सारांश कॉपी करें",
    searchDisastersPlaceholder: "ऐतिहासिक आपदाएं या घटनाएं खोजें (उदा. फानी चक्रवात, केरल बाढ़)...",
    historicalResearchTitle: "ऐतिहासिक आपदा अनुसंधान",
    compareEvents: "घटनाओं की तुलना करें",
    aiAssistant: "एआई शोध सहायक",
    originalReports: "मूल समाचार और रिपोर्ट",
    timelineTitle: "घटनाक्रम (टाइमलाइन)",
    whatHappenedTitle: "क्या हुआ था",
    impactTitle: "मानवीय एवं ढांचागत प्रभाव",
    responseTitle: "सरकारी एवं राहत प्रतिक्रिया",
    sourceAssessmentTitle: "स्रोत विश्वसनीयता",
    conflictingReportsTitle: "विरोधाभासी रिपोर्टें",
    noAlertsNearby: "आपके स्थान के पास कोई सक्रिय अलर्ट नहीं है।",
    noActiveAlerts: "वर्तमान में कोई सक्रिय चेतावनी नहीं है।",
    currentNewsTitle: "सत्यापित हालिया समाचार (72 घंटे)",
    voiceAssistantTitle: "बहुभाषी वॉइस सहायक",
    voiceListening: "आपकी भाषा में सुन रहे हैं...",
    voiceSpeakPrompt: "किसी भी भारतीय भाषा में बोलें या पूछें",
    searchLanguagePlaceholder: "भाषा खोजें (अंग्रेजी या लिपि)...",
  },
  bn: {
    appTitle: "দুর্যোগ তথ্য ও গবেষণা প্ল্যাটফর্ম",
    appSubtitle: "সরকারি সতর্কতা • ভূ-স্থানিক বুদ্ধিমত্তা • তথ্যভিত্তিক গবেষণা",
    presentTab: "বর্তমান (লাইভ পরিস্থিতি)",
    pastTab: "অতীত (ঐতিহাসিক গবেষণা)",
    liveStatus: "লাইভ সরকারি তথ্য",
    staleStatus: "ক্যাশ ডেটা",
    activeAlerts: "সক্রিয় সরকারি সতর্কতা",
    alertTypes: "দুর্যোগের ধরন",
    useMyLocation: "আমার অবস্থান ব্যবহার করুন",
    checkAnotherLocation: "অন্য স্থান পরীক্ষা করুন",
    searchLocationPlaceholder: "শহর, জেলা বা স্থান অনুসন্ধান করুন...",
    nearMeMode: "আমার কাছে",
    indiaMode: "সমগ্র ভারত",
    officialInstructionTitle: "সরকারি নির্দেশাবলী",
    plainSummaryTitle: "পরিস্থিতি সারসংক্ষেপ",
    viewDetails: "বিস্তারিত দেখুন",
    dismiss: "বাতিল করুন",
    share: "সতর্কতা শেয়ার করুন",
    copySummary: "সারসংক্ষেপ কপি করুন",
    searchDisastersPlaceholder: "ঐতিহাসিক দুর্যোগ খুঁজুন (যেমন: ঘূর্ণিঝড় ফণী, কেরালা বন্যা)...",
    historicalResearchTitle: "ঐতিহাসিক দুর্যোগ গবেষণা",
    compareEvents: "ঘটনা তুলনা করুন",
    aiAssistant: "এআই গবেষণা সহকারী",
    originalReports: "মূল প্রতিবেদন ও সংবাদ",
    timelineTitle: "ঘটনাপঞ্জি (টাইমলাইন)",
    whatHappenedTitle: "কী ঘটেছিল",
    impactTitle: "মানবিক ও অবকাঠামোগত ক্ষয়ক্ষতি",
    responseTitle: "সরকারি ত্রাণ ও উদ্ধার কাজ",
    sourceAssessmentTitle: "উৎস নির্ভরযোগ্যতা",
    conflictingReportsTitle: "পরস্পরবিরোধী রিপোর্ট",
    noAlertsNearby: "আপনার এলাকার কাছে কোনো সক্রিয় সতর্কতা নেই।",
    noActiveAlerts: "বর্তমানে কোনো সক্রিয় সতর্কতা নেই।",
    currentNewsTitle: "যাচাইকৃত সাম্প্রতিক সংবাদ (৭২ ঘণ্টা)",
    voiceAssistantTitle: "বহুভাষিক ভয়েস সহকারী",
    voiceListening: "আপনার ভাষায় শুনছি...",
    voiceSpeakPrompt: "যেকোনো ভারতীয় ভাষায় কথা বলুন বা জিজ্ঞাসা করুন",
    searchLanguagePlaceholder: "ভাষা খুঁজুন (ইংরেজি বা বাংলা লিপিতে)...",
  },
  ta: {
    appTitle: "பேரிடர் தகவல் தளம்",
    appSubtitle: "அதிகாரப்பூர்வ எச்சரிக்கைகள் • புவிசார் சூழல் • ஆதார அடிப்படையிலான ஆய்வு",
    presentTab: "தற்போதைய நிலை (நேரலை)",
    pastTab: "கடந்த கால ஆய்வு (வரலாறு)",
    liveStatus: "நேரலை எச்சரிக்கை",
    staleStatus: "சேமிக்கப்பட்ட தகவல்",
    activeAlerts: "செயலில் உள்ள எச்சரிக்கைகள்",
    alertTypes: "பேரிடர் வகைகள்",
    useMyLocation: "எனது இருப்பிடத்தைப் பயன்படுத்து",
    checkAnotherLocation: "வேறு இடத்தை சரிபார்க்கவும்",
    searchLocationPlaceholder: "நகரம், மாவட்டம் அல்லது கிராமத்தை தேடுங்கள்...",
    nearMeMode: "என் அருகில்",
    indiaMode: "இந்தியா முழுவதும்",
    officialInstructionTitle: "அதிகாரப்பூர்வ வழிகாட்டுதல்கள்",
    plainSummaryTitle: "நிலைமை சுருக்கம்",
    viewDetails: "விவரங்களைக் காண்க",
    dismiss: "விலக்கு",
    share: "பகிரவும்",
    copySummary: "சுருக்கத்தை நகலெடு",
    searchDisastersPlaceholder: "வரலாற்றுப் பேரிடர்களைத் தேடுங்கள் (எ.கா. ஃபானி புயல்)...",
    historicalResearchTitle: "வரலாற்றுப் பேரிடர் ஆராய்ச்சி",
    compareEvents: "ஒப்பிடுக",
    aiAssistant: "AI ஆராய்ச்சி உதவியாளர்",
    originalReports: "அசல் அறிக்கைகள்",
    timelineTitle: "காலவரிசை",
    whatHappenedTitle: "என்ன நடந்தது",
    impactTitle: "பாதிப்புகள்",
    responseTitle: "அரசு நிவாரணப் பணிகள்",
    sourceAssessmentTitle: "ஆதார மதிப்பீடு",
    conflictingReportsTitle: "முரண்பட்ட அறிக்கைகள்",
    noAlertsNearby: "உங்கள் பகுதிக்கு அருகில் எச்சரிக்கைகள் இல்லை.",
    noActiveAlerts: "செயலில் உள்ள எச்சரிக்கைகள் எதுவும் இல்லை.",
    currentNewsTitle: "சரிபார்க்கப்பட்ட சமீபத்திய செய்திகள்",
    voiceAssistantTitle: "குரல் உதவியாளர்",
    voiceListening: "கேட்கிறது...",
    voiceSpeakPrompt: "எந்த இந்திய மொழியிலும் பேசுங்கள்",
    searchLanguagePlaceholder: "மொழியைத் தேடுங்கள்...",
  },
  te: {
    appTitle: "విపత్తు సమాచార వేదిక",
    appSubtitle: "అధికారిక హెచ్చరికలు • భౌగోళిక సమాచారం • పరిశోధన",
    presentTab: "ప్రస్తుత స్థితి (లైవ్)",
    pastTab: "గత చరిత్ర (పరిశోధన)",
    liveStatus: "ప్రత్యక్ష సమాచారం",
    staleStatus: "కాష్ సమాచారం",
    activeAlerts: "యాక్టివ్ హెచ్చరికలు",
    alertTypes: "విపత్తు రకాలు",
    useMyLocation: "నా లొకేషన్ ఉపయోగించండి",
    checkAnotherLocation: "మరో ప్రాంతాన్ని తనిఖీ చేయండి",
    searchLocationPlaceholder: "నగరం లేదా జిల్లాను శోధించండి...",
    nearMeMode: "నా దగ్గర",
    indiaMode: "భారతదేశం అంతటా",
    officialInstructionTitle: "అధికారిక సూచనలు",
    plainSummaryTitle: "పరిస్థితి సారాంశం",
    viewDetails: "వివరాలు చూడండి",
    dismiss: "రద్దు చేయి",
    share: "హెచ్చరికను పంచుకోండి",
    copySummary: "సారాంశాన్ని కాపీ చేయండి",
    searchDisastersPlaceholder: "చారిత్రక విపత్తులను శోధించండి...",
    historicalResearchTitle: "చారిత్రక విపత్తు పరిశోధన",
    compareEvents: "ఈవెంట్లను సరిపోల్చండి",
    aiAssistant: "AI సహాయకుడు",
    originalReports: "అసలు నివేదికలు",
    timelineTitle: "టైమ్‌లైన్",
    whatHappenedTitle: "ఏమి జరిగింది",
    impactTitle: "ప్రభావం మరియు నష్టం",
    responseTitle: "ప్రభుత్వ ప్రతిస్పందన",
    sourceAssessmentTitle: "మూలాల ధృవీకరణ",
    conflictingReportsTitle: "విరుద్ధ నివేదికలు",
    noAlertsNearby: "మీ ప్రాంతంలో హెచ్చరికలు లేవు.",
    noActiveAlerts: "యాక్టివ్ హెచ్చరికలు ఏవీ లేవు.",
    currentNewsTitle: "తాజా వార్తలు",
    voiceAssistantTitle: "వాయిస్ అసిస్టెంట్",
    voiceListening: "వింటోంది...",
    voiceSpeakPrompt: "భారతీయ భాషలో మాట్లాడండి",
    searchLanguagePlaceholder: "భాషను శోధించండి...",
  },
  mr: {
    appTitle: "आपत्ती माहिती व संशोधन व्यासपीठ",
    appSubtitle: "अधिकृत इशारे • भौगोलिक संदर्भ • पुरावा-आधारित संशोधन",
    presentTab: "सध्याची स्थिती (लाईव्ह)",
    pastTab: "भूतकाळ (ऐतिहासिक संशोधन)",
    liveStatus: "लाईव्ह अधिकृत डेटा",
    staleStatus: "कॅश डेटा",
    activeAlerts: "सक्रिय अधिकृत इशारे",
    alertTypes: "आपत्ती प्रकार",
    useMyLocation: "माझे स्थान वापरा",
    checkAnotherLocation: "इतर स्थान तपासा",
    searchLocationPlaceholder: "शहर, जिल्हा किंवा गाव शोधा...",
    nearMeMode: "माझ्या जवळ",
    indiaMode: "संपूर्ण भारत",
    officialInstructionTitle: "अधिकृत सूचना",
    plainSummaryTitle: "परिस्थितीचा सारांश",
    viewDetails: "तपशील पहा",
    dismiss: "बंद करा",
    share: "इशारा शेअर करा",
    copySummary: "सारांश कॉपी करा",
    searchDisastersPlaceholder: "ऐतिहासिक आपत्ती शोधा...",
    historicalResearchTitle: "ऐतिहासिक आपत्ती संशोधन",
    compareEvents: "तुलना करा",
    aiAssistant: "एआय संशोधन सहाय्यक",
    originalReports: "मूळ बातम्या व अहवाल",
    timelineTitle: "घटनाक्रम (टाइमलाइन)",
    whatHappenedTitle: "काय घडले होते",
    impactTitle: "मानवी व पायाभूत नुकसान",
    responseTitle: "शासकीय मदत व बचाव कार्य",
    sourceAssessmentTitle: "स्रोत विश्वसनीयता",
    conflictingReportsTitle: "परस्परविरोधी अहवाल",
    noAlertsNearby: "तुमच्या परिसरात कोणताही इशारा नाही.",
    noActiveAlerts: "सध्या कोणताही सक्रिय इशारा नाही.",
    currentNewsTitle: "सत्यापित ताज्या बातम्या",
    voiceAssistantTitle: "व्हॉइस सहाय्यक",
    voiceListening: "ऐकत आहे...",
    voiceSpeakPrompt: "कोणत्याही भारतीय भाषेत बोला",
    searchLanguagePlaceholder: "भाषा शोधा...",
  },
  or: {
    appTitle: "ବିପର୍ଯ୍ୟୟ ସୂଚନା ଓ ଅନୁସନ୍ଧାନ ମଞ୍ଚ",
    appSubtitle: "ସରକାରୀ ସତର୍କତା • ଭୌଗୋଳିକ ସୂଚନା • ତଥ୍ୟଭିତ୍ତିକ ଗବେଷଣା",
    presentTab: "ବର୍ତ୍ତମାନ (ଲାଇଭ ସ୍ଥିତି)",
    pastTab: "ଅତୀତ (ଐତିହାସିକ ଗବେଷଣା)",
    liveStatus: "ଲାଇଭ ସରକାରୀ ସୂଚନା",
    staleStatus: "କ୍ୟାସ୍ ତଥ୍ୟ",
    activeAlerts: "ସକ୍ରିୟ ସରକାରୀ ସତର୍କତା",
    alertTypes: "ବିପର୍ଯ୍ୟୟ ବର୍ଗ",
    useMyLocation: "ମୋର ସ୍ଥାନ ବ୍ୟବହାର କରନ୍ତୁ",
    checkAnotherLocation: "ଅନ୍ୟ ସ୍ଥାନ ଯାଞ୍ଚ କରନ୍ତୁ",
    searchLocationPlaceholder: "ସହର, ଜିଲ୍ଲା ବା ଗ୍ରାମ ଖୋଜନ୍ତୁ...",
    nearMeMode: "ମୋ ନିକଟରେ",
    indiaMode: "ସମଗ୍ର ଭାରତ",
    officialInstructionTitle: "ସରକାରୀ ନିର୍ଦ୍ଦେଶାବଳୀ",
    plainSummaryTitle: "ସ୍ଥିତି ସାରାଂଶ",
    viewDetails: "ବିବରଣୀ ଦେଖନ୍ତୁ",
    dismiss: "ଅଣଦେଖା କରନ୍ତୁ",
    share: "ସତର୍କତା ସେୟାର କରନ୍ତୁ",
    copySummary: "ସାରାଂଶ କପି କରନ୍ତୁ",
    searchDisastersPlaceholder: "ଐତିହାସିକ ବିପର୍ଯ୍ୟୟ ଖୋଜନ୍ତୁ (ଯଥା: ଫନି ବାତ୍ୟା)...",
    historicalResearchTitle: "ଐତିହାସିକ ବିପର୍ଯ୍ୟୟ ଗବେଷଣା",
    compareEvents: "ତୁଳନା କରନ୍ତୁ",
    aiAssistant: "AI ଗବେଷଣା ସହାୟକ",
    originalReports: "ମୂଳ ଖବର ଓ ରିପୋର୍ଟ",
    timelineTitle: "ଘଟଣାକ୍ରମ (ଟାଇମଲାଇନ୍)",
    whatHappenedTitle: "କଣ ଘଟିଥିଲା",
    impactTitle: "ମାନବୀୟ ଓ ଭିତ୍ତିଭୂମି କ୍ଷୟକ୍ଷତି",
    responseTitle: "ସରକାରୀ ଓ ରିଲିଫ ପ୍ରତିକ୍ରିୟା",
    sourceAssessmentTitle: "ଉତ୍ସ ବିଶ୍ୱସନୀୟତା",
    conflictingReportsTitle: "ପରସ୍ପର ବିରୋଧୀ ରିପୋର୍ଟ",
    noAlertsNearby: "ଆପଣଙ୍କ ଅଞ୍ଚଳ ନିକଟରେ କୌଣସି ସକ୍ରିୟ ସତର୍କତା ନାହିଁ।",
    noActiveAlerts: "ବର୍ତ୍ତମାନ କୌଣସି ସକ୍ରିୟ ସତର୍କତା ନାହିଁ।",
    currentNewsTitle: "ସତ୍ୟାପିତ ସାମ୍ପ୍ରତିକ ଖବର (୭୨ ଘଣ୍ଟା)",
    voiceAssistantTitle: "ବହୁଭାଷୀ ଭଏସ୍ ସହାୟକ",
    voiceListening: "ଶୁଣୁଛି...",
    voiceSpeakPrompt: "ଓଡ଼ିଆ କିମ୍ବା ଅନ୍ୟ ଭାରତୀୟ ଭାଷାରେ କୁହନ୍ତୁ",
    searchLanguagePlaceholder: "ଭାଷା ଖୋଜନ୍ତୁ...",
  },
};

export function getTranslation(langCode: string): TranslationDictionary {
  const base = TRANSLATIONS[langCode] || TRANSLATIONS.en;
  return {
    ...TRANSLATIONS.en,
    ...base,
    indiaMapTitle: base.indiaMapTitle || 'All India Disaster Live Map',
    askAIAssistant: base.askAIAssistant || base.aiAssistant || 'Ask AI Assistant',
    pastDisastersTitle: base.pastDisastersTitle || base.historicalResearchTitle || 'Historical Disaster Research',
    searchDisasterPlaceholder: base.searchDisasterPlaceholder || base.searchDisastersPlaceholder || 'Search historical disasters, events or locations (e.g., Cyclone Fani, Kerala Floods)...',
    compareNow: base.compareNow || base.compareEvents || 'Compare Events Now',
  };
}

/**
 * Application-owned copy only. Alert/evidence data keeps its source wording and
 * must never be used as a translation key.
 */
const UI_COPY = {
  en: {
    'HOME': 'Home',
    'FUTURE': 'Future',
    'PRESENT': 'Present',
    'PAST': 'Past',
    'TEAM': 'Team',
    'present.mapTitle': 'All India disaster live map',
    'nav.liveMap': 'Live Map & Alerts', 'nav.historical': 'Historical Research', 'nav.changeLanguage': 'Change application language', 'nav.openAssistant': 'Open multilingual assistant', 'nav.refresh': 'Refresh official alerts', 'nav.noLanguage': 'No matching language found',
    'common.close': 'Close', 'common.cancel': 'Cancel', 'common.retry': 'Retry', 'common.loading': 'Loading…', 'common.error': 'Something went wrong.', 'common.sources': 'Sources', 'common.copy': 'Copy', 'common.copied': 'Copied!', 'common.share': 'Share', 'common.listen': 'Listen', 'common.stop': 'Stop',
    'present.activeHazards': '{count} active hazard{plural}', 'present.allHazards': 'All hazards ({count})', 'present.nearMe': 'Near my location ({count})', 'present.locationOptional': 'Location access is optional. Browse the India map and alert details without GPS; proximity guidance activates after you share a location.', 'present.legend': 'Active alert legend', 'present.highPriority': 'High-priority hazard marker', 'present.moderatePriority': 'Moderate hazard marker', 'present.boundary': 'Official hazard boundary', 'present.yourLocation': 'Your location', 'present.mapOffline': 'Map tiles are offline — text alert fallback is active', 'present.retryMap': 'Retry map layer', 'present.centerLocation': 'Center on my location', 'present.liveGps': 'Live GPS point', 'present.monitoredLocation': 'Monitored location', 'present.indiaOverview': 'India overview with {count} hazards',
    'alerts.shareAlert': 'Share alert', 'alerts.closeDrawer': 'Close alert details', 'alerts.overview': 'Overview & CAP info', 'alerts.protectiveMeasures': 'Protective measures', 'alerts.helplines': 'Helplines', 'alerts.liveAdvisory': 'Live advisory feed', 'alerts.issuingAuthority': 'Issuing authority', 'alerts.bulletinReference': 'Bulletin reference', 'alerts.copyAdvisory': 'Copy advisory', 'alerts.severityUrgency': 'Severity / urgency', 'alerts.certainty': 'Certainty', 'alerts.affectedArea': 'Affected area', 'alerts.effectiveTime': 'Effective time', 'alerts.expiryTime': 'Expiry time', 'alerts.coordinates': '{count} vector coordinates defined', 'alerts.evacuationProtocol': 'Standard evacuation protocol', 'alerts.protectiveActions': 'Actionable protective measures', 'alerts.dos': 'Do’s', 'alerts.donts': 'Don’ts', 'alerts.noGeometry': 'This alert has no precise center or polygon. Showing verified official instructions and supporting coverage only.', 'alerts.controlRooms': 'Emergency control rooms & helplines', 'alerts.tapToCall': 'Tap to call', 'alerts.officialPortal': 'Official portal', 'alerts.portalUnavailable': 'Official portal unavailable', 'alerts.forward': 'Forward alert', 'alerts.translationNotice': 'Official source wording',
    'history.searchPlaceholder': 'Search a disaster event, district, or state to build a live dossier…', 'history.search': 'Search evidence', 'history.download': 'Download report', 'history.allStates': 'All states', 'history.sourcesCount': '{count} source{plural}', 'history.casualties': 'Reported casualties', 'history.damage': 'Estimated damage / loss', 'history.addCompare': 'Add to compare', 'history.inCompare': 'In compare', 'history.askAi': 'Ask AI', 'history.liveDossier': 'Live dossier', 'history.copySummary': 'Copy evidence summary', 'history.noResults': 'No matching sources were found. Try a broader disaster name, district, or state.', 'history.maxCompare': 'You can compare a maximum of 4 disaster events.',
    'assistant.grounded': 'Grounded AI with multilingual speech recognition', 'assistant.listening': 'Listening in {language}… Speak now!', 'assistant.placeholder': 'Ask in {language} or English…', 'assistant.record': 'Record and transcribe speech', 'assistant.pipeline': 'Grounded intelligence synthesis in progress…', 'assistant.unavailable': 'Information unavailable in the retrieved sources.', 'assistant.error': 'Unable to complete the AI query. Please check your connection.',
    'voice.record': 'Click to record and transcribe speech', 'voice.stop': 'Stop ({seconds}s)', 'voice.transcribing': 'Transcribing…', 'voice.microphoneDenied': 'Microphone access denied or unavailable.', 'voice.noSpeech': 'No speech detected. Please speak clearly.', 'voice.transcriptionError': 'Transcription error. Please try again.', 'voice.processingError': 'Failed to process audio.',
    'footer.status': 'Feed status: {status} • Multilingual support enabled', 'error.notFoundTitle': 'Page not found', 'error.notFoundBody': 'The page you asked for does not exist in this workspace.', 'error.returnDashboard': 'Return to dashboard',
    'future.timelineTitle': 'Forecast Timeline',
    'future.timelineSubtitle': 'Select a forecast month to generate predicted flood locations.',
    'future.generating': 'Generating predictions...',
    'future.unavailable': 'Prediction unavailable',
    'future.drawerTitle': 'Predicted Flood Location',
    'future.rankTitle': 'Rank #{rank} Forecast',
    'future.tabOverview': 'Overview & Geography',
    'future.tabAnalysis': 'Severity Analysis',
    'future.probability': 'Flood Probability',
    'future.probabilityDesc': 'Model-estimated probability that this location belongs to the flood-observed class for the selected month.',
    'future.coordinates': 'Coordinates',
    'future.latitude': 'Latitude',
    'future.longitude': 'Longitude',
    'future.severityTitle': 'Predicted Severity Levels',
    'future.peakLevel': 'Peak Flood Level',
    'future.warningLevel': 'Warning Level',
    'future.dangerLevel': 'Danger Level',
    'future.historicalTitle': 'Historical Evidence',
    'future.historicalDesc': 'Historical flood observations recorded at this candidate location.',
    'future.modelTitle': 'Model Interpretation',
    'future.modelDesc': "The probability is the XGBoost model's estimated probability for the flood-observed class. It is a model score and should not be interpreted as a guaranteed real-world probability without probability calibration.",
    'future.riskLevel': 'Risk Level',
    'future.highRisk': 'High Risk',
    'future.mediumRisk': 'Medium Risk',
    'future.lowRisk': 'Low Risk',
    'future.aboveDanger': 'Above Danger Level',
    'future.aboveWarning': 'Above Warning Level',
    'future.belowWarning': 'Normal Flow',
  },
  hi: {
    'HOME': 'होम',
    'FUTURE': 'भविष्य',
    'PRESENT': 'वर्तमान',
    'PAST': 'अतीत',
    'TEAM': 'टीम',
    'present.mapTitle': 'अखिल भारतीय आपदा लाइव मानचित्र',
    'nav.liveMap': 'लाइव मानचित्र और अलर्ट', 'nav.historical': 'ऐतिहासिक अनुसंधान', 'nav.changeLanguage': 'ऐप की भाषा बदलें', 'nav.openAssistant': 'बहुभाषी सहायक खोलें', 'nav.refresh': 'आधिकारिक अलर्ट रीफ़्रेश करें', 'nav.noLanguage': 'कोई मिलती भाषा नहीं मिली',
    'common.close': 'बंद करें', 'common.cancel': 'रद्द करें', 'common.retry': 'पुनः प्रयास करें', 'common.loading': 'लोड हो रहा है…', 'common.error': 'कुछ गलत हुआ।', 'common.sources': 'स्रोत', 'common.copy': 'कॉपी करें', 'common.copied': 'कॉपी हो गया!', 'common.share': 'साझा करें', 'common.listen': 'सुनें', 'common.stop': 'रोकें',
    'present.activeHazards': '{count} सक्रिय खतरे', 'present.allHazards': 'सभी खतरे ({count})', 'present.nearMe': 'मेरे स्थान के पास ({count})', 'present.locationOptional': 'स्थान की अनुमति वैकल्पिक है। GPS के बिना भारत का मानचित्र और अलर्ट विवरण देखें; स्थान साझा करने पर निकटता मार्गदर्शन सक्रिय होगा।', 'present.legend': 'सक्रिय अलर्ट संकेतक', 'present.highPriority': 'उच्च प्राथमिकता खतरा चिह्न', 'present.moderatePriority': 'मध्यम प्राथमिकता खतरा चिह्न', 'present.boundary': 'आधिकारिक खतरा सीमा', 'present.yourLocation': 'आपका स्थान', 'present.mapOffline': 'मानचित्र टाइलें ऑफ़लाइन हैं — पाठ अलर्ट विकल्प सक्रिय है', 'present.retryMap': 'मानचित्र परत पुनः आज़माएँ', 'present.centerLocation': 'मेरे स्थान पर केंद्रित करें', 'present.liveGps': 'लाइव GPS बिंदु', 'present.monitoredLocation': 'निगरानी स्थान', 'present.indiaOverview': '{count} खतरों के साथ भारत अवलोकन',
    'alerts.shareAlert': 'अलर्ट साझा करें', 'alerts.closeDrawer': 'अलर्ट विवरण बंद करें', 'alerts.overview': 'अवलोकन और CAP जानकारी', 'alerts.protectiveMeasures': 'सुरक्षात्मक उपाय', 'alerts.helplines': 'हेल्पलाइन', 'alerts.liveAdvisory': 'लाइव परामर्श फ़ीड', 'alerts.issuingAuthority': 'जारी करने वाली संस्था', 'alerts.bulletinReference': 'बुलेटिन संदर्भ', 'alerts.copyAdvisory': 'परामर्श कॉपी करें', 'alerts.severityUrgency': 'गंभीरता / तात्कालिकता', 'alerts.certainty': 'निश्चितता', 'alerts.affectedArea': 'प्रभावित क्षेत्र', 'alerts.effectiveTime': 'प्रभावी समय', 'alerts.expiryTime': 'समाप्ति समय', 'alerts.coordinates': '{count} वेक्टर निर्देशांक निर्धारित', 'alerts.evacuationProtocol': 'मानक निकासी प्रोटोकॉल', 'alerts.protectiveActions': 'कार्रवाई योग्य सुरक्षात्मक उपाय', 'alerts.dos': 'क्या करें', 'alerts.donts': 'क्या न करें', 'alerts.noGeometry': 'इस अलर्ट में सटीक केंद्र या बहुभुज नहीं है। केवल सत्यापित आधिकारिक निर्देश और सहायक कवरेज दिखाया जा रहा है।', 'alerts.controlRooms': 'आपात नियंत्रण कक्ष और हेल्पलाइन', 'alerts.tapToCall': 'कॉल करने के लिए टैप करें', 'alerts.officialPortal': 'आधिकारिक पोर्टल', 'alerts.portalUnavailable': 'आधिकारिक पोर्टल उपलब्ध नहीं', 'alerts.forward': 'अलर्ट अग्रेषित करें', 'alerts.translationNotice': 'आधिकारिक स्रोत का मूल पाठ',
    'history.searchPlaceholder': 'लाइव डोज़ियर बनाने के लिए आपदा, ज़िला या राज्य खोजें…', 'history.search': 'साक्ष्य खोजें', 'history.download': 'रिपोर्ट डाउनलोड करें', 'history.allStates': 'सभी राज्य', 'history.sourcesCount': '{count} स्रोत', 'history.casualties': 'रिपोर्ट की गई हताहत', 'history.damage': 'अनुमानित क्षति / हानि', 'history.addCompare': 'तुलना में जोड़ें', 'history.inCompare': 'तुलना में है', 'history.askAi': 'AI से पूछें', 'history.liveDossier': 'लाइव डोज़ियर', 'history.copySummary': 'साक्ष्य सारांश कॉपी करें', 'history.noResults': 'कोई मिलते स्रोत नहीं मिले। व्यापक आपदा नाम, ज़िला या राज्य आज़माएँ।', 'history.maxCompare': 'एक साथ अधिकतम 4 आपदाओं की तुलना कर सकते हैं।',
    'assistant.grounded': 'बहुभाषी वाक् पहचान के साथ साक्ष्य-आधारित AI', 'assistant.listening': '{language} में सुन रहे हैं… अब बोलें!', 'assistant.placeholder': '{language} या अंग्रेज़ी में पूछें…', 'assistant.record': 'भाषण रिकॉर्ड और ट्रांसक्राइब करें', 'assistant.pipeline': 'साक्ष्य-आधारित विश्लेषण जारी है…', 'assistant.unavailable': 'प्राप्त स्रोतों में जानकारी उपलब्ध नहीं है।', 'assistant.error': 'AI प्रश्न पूरा नहीं हो सका। अपना कनेक्शन जाँचें।',
    'voice.record': 'रिकॉर्ड करने और भाषण लिखने के लिए क्लिक करें', 'voice.stop': 'रोकें ({seconds}से)', 'voice.transcribing': 'लिप्यंतरण हो रहा है…', 'voice.microphoneDenied': 'माइक्रोफ़ोन अनुमति अस्वीकृत या अनुपलब्ध है।', 'voice.noSpeech': 'कोई भाषण नहीं मिला। कृपया स्पष्ट बोलें।', 'voice.transcriptionError': 'लिप्यंतरण त्रुटि। पुनः प्रयास करें।', 'voice.processingError': 'ऑडियो संसाधित नहीं हो सका।',
    'footer.status': 'फ़ीड स्थिति: {status} • बहुभाषी सहायता सक्षम', 'error.notFoundTitle': 'पृष्ठ नहीं मिला', 'error.notFoundBody': 'आपके द्वारा माँगा गया पृष्ठ इस कार्यक्षेत्र में नहीं है।', 'error.returnDashboard': 'डैशबोर्ड पर लौटें',
    'future.timelineTitle': 'पूर्वानुमान समयरेखा',
    'future.timelineSubtitle': 'पूर्वानुमानित बाढ़ स्थानों को उत्पन्न करने के लिए एक पूर्वानुमान महीना चुनें।',
    'future.generating': 'पूर्वानुमान उत्पन्न किए जा रहे हैं...',
    'future.unavailable': 'पूर्वानुमान अनुपलब्ध',
    'future.drawerTitle': 'पूर्वानुमानित बाढ़ स्थान',
    'future.rankTitle': 'रैंक #{rank} पूर्वानुमान',
    'future.tabOverview': 'अवलोकन और भूगोल',
    'future.tabAnalysis': 'गंभीरता विश्लेषण',
    'future.probability': 'बाढ़ की संभावना',
    'future.probabilityDesc': 'मॉडल-अनुमानित संभावना कि यह स्थान चयनित महीने के लिए बाढ़-प्रेक्षित वर्ग से संबंधित है।',
    'future.coordinates': 'निर्देशांक',
    'future.latitude': 'अक्षांश',
    'future.longitude': 'देशांतर',
    'future.severityTitle': 'पूर्वानुमानित गंभीरता स्तर',
    'future.peakLevel': 'उच्चतम बाढ़ स्तर',
    'future.warningLevel': 'चेतावनी स्तर',
    'future.dangerLevel': 'खतरे का स्तर',
    'future.historicalTitle': 'ऐतिहासिक साक्ष्य',
    'future.historicalDesc': 'इस उम्मीदवार स्थान पर दर्ज किए गए ऐतिहासिक बाढ़ प्रेक्षण।',
    'future.modelTitle': 'मॉडल व्याख्या',
    'future.modelDesc': 'संभावना बाढ़-प्रेक्षित वर्ग के लिए XGBoost मॉडल की अनुमानित संभावना है। यह एक मॉडल स्कोर है और इसे बिना संभावना अंशांकन के वास्तविक दुनिया की गारंटीकृत संभावना के रूप में नहीं लिया जाना चाहिए।',
    'future.riskLevel': 'जोखिम का स्तर',
    'future.highRisk': 'उच्च जोखिम',
    'future.mediumRisk': 'मध्यम जोखिम',
    'future.lowRisk': 'कम जोखिम',
    'future.aboveDanger': 'खतरे के स्तर से ऊपर',
    'future.aboveWarning': 'चेतावनी के स्तर से ऊपर',
    'future.belowWarning': 'सामान्य बहाव',
  },
  bn: {
    'HOME': 'হোম',
    'FUTURE': 'ভবিষ্যৎ',
    'PRESENT': 'বর্তমান',
    'PAST': 'অতীত',
    'TEAM': 'টিম',
    'present.mapTitle': 'সর্বভারতীয় দুর্যোগ লাইভ মানচিত্র',
    'nav.liveMap': 'লাইভ মানচিত্র ও সতর্কতা', 'nav.historical': 'ঐতিহাসিক গবেষণা', 'nav.changeLanguage': 'অ্যাপের ভাষা বদলান', 'nav.openAssistant': 'বহুভাষী সহায়ক খুলুন', 'nav.refresh': 'সরকারি সতর্কতা রিফ্রেশ করুন', 'nav.noLanguage': 'মিলে এমন ভাষা পাওয়া যায়নি',
    'common.close': 'বন্ধ করুন', 'common.cancel': 'বাতিল', 'common.retry': 'আবার চেষ্টা করুন', 'common.loading': 'লোড হচ্ছে…', 'common.error': 'কিছু ভুল হয়েছে।', 'common.sources': 'উৎস', 'common.copy': 'কপি করুন', 'common.copied': 'কপি হয়েছে!', 'common.share': 'শেয়ার করুন', 'common.listen': 'শুনুন', 'common.stop': 'থামান',
    'present.activeHazards': '{count} সক্রিয় বিপদ', 'present.allHazards': 'সব বিপদ ({count})', 'present.nearMe': 'আমার অবস্থানের কাছে ({count})', 'present.locationOptional': 'অবস্থানের অনুমতি ঐচ্ছিক। GPS ছাড়াই ভারতের মানচিত্র ও সতর্কতার বিবরণ দেখুন; অবস্থান শেয়ার করলে নৈকট্য নির্দেশনা সক্রিয় হবে।', 'present.legend': 'সক্রিয় সতর্কতা কিংবদন্তি', 'present.highPriority': 'উচ্চ অগ্রাধিকারের বিপদ চিহ্ন', 'present.moderatePriority': 'মাঝারি অগ্রাধিকারের বিপদ চিহ্ন', 'present.boundary': 'সরকারি বিপদসীমা', 'present.yourLocation': 'আপনার অবস্থান', 'present.mapOffline': 'মানচিত্র টাইল অফলাইন — পাঠ্য সতর্কতা বিকল্প সক্রিয়', 'present.retryMap': 'মানচিত্র স্তর পুনরায় চেষ্টা করুন', 'present.centerLocation': 'আমার অবস্থানে কেন্দ্রীভূত করুন', 'present.liveGps': 'লাইভ GPS বিন্দু', 'present.monitoredLocation': 'নিরীক্ষিত অবস্থান', 'present.indiaOverview': '{count} বিপদসহ ভারত পর্যালোচনা',
    'alerts.shareAlert': 'সতর্কতা শেয়ার করুন', 'alerts.closeDrawer': 'সতর্কতার বিবরণ বন্ধ করুন', 'alerts.overview': 'সারসংক্ষেপ ও CAP তথ্য', 'alerts.protectiveMeasures': 'সুরক্ষামূলক ব্যবস্থা', 'alerts.helplines': 'হেল্পলাইন', 'alerts.liveAdvisory': 'লাইভ পরামর্শ ফিড', 'alerts.issuingAuthority': 'প্রদানকারী সংস্থা', 'alerts.bulletinReference': 'বুলেটিন রেফারেন্স', 'alerts.copyAdvisory': 'পরামর্শ কপি করুন', 'alerts.severityUrgency': 'তীব্রতা / জরুরি অবস্থা', 'alerts.certainty': 'নিশ্চয়তা', 'alerts.affectedArea': 'প্রভাবিত এলাকা', 'alerts.effectiveTime': 'কার্যকর সময়', 'alerts.expiryTime': 'মেয়াদ শেষের সময়', 'alerts.coordinates': '{count} ভেক্টর কোঅর্ডিনেট নির্ধারিত', 'alerts.evacuationProtocol': 'মানক সরিয়ে নেওয়ার প্রোটোকল', 'alerts.protectiveActions': 'করণীয় সুরক্ষামূলক ব্যবস্থা', 'alerts.dos': 'করণীয়', 'alerts.donts': 'বর্জনীয়', 'alerts.noGeometry': 'এই সতর্কতায় নির্দিষ্ট কেন্দ্র বা বহুভুজ নেই। শুধুমাত্র যাচাইকৃত সরকারি নির্দেশনা ও সহায়ক তথ্য দেখানো হচ্ছে।', 'alerts.controlRooms': 'জরুরি নিয়ন্ত্রণকক্ষ ও হেল্পলাইন', 'alerts.tapToCall': 'কল করতে ট্যাপ করুন', 'alerts.officialPortal': 'সরকারি পোর্টাল', 'alerts.portalUnavailable': 'সরকারি পোর্টাল অনুপলব্ধ', 'alerts.forward': 'সতর্কতা ফরওয়ার্ড করুন', 'alerts.translationNotice': 'সরকারি উৎসের মূল ভাষ্য',
    'history.searchPlaceholder': 'লাইভ ডসিয়ার তৈরির জন্য দুর্যোগ, জেলা বা রাজ্য খুঁজুন…', 'history.search': 'প্রমাণ খুঁজুন', 'history.download': 'রিপোর্ট ডাউনলোড করুন', 'history.allStates': 'সব রাজ্য', 'history.sourcesCount': '{count} উৎস', 'history.casualties': 'প্রতিবেদিত হতাহত', 'history.damage': 'আনুমানিক ক্ষতি / লোকসান', 'history.addCompare': 'তুলনায় যোগ করুন', 'history.inCompare': 'তুলনায় আছে', 'history.askAi': 'AI-কে জিজ্ঞাসা করুন', 'history.liveDossier': 'লাইভ ডসিয়ার', 'history.copySummary': 'প্রমাণের সারাংশ কপি করুন', 'history.noResults': 'মিলে এমন উৎস পাওয়া যায়নি। আরও বিস্তৃত দুর্যোগের নাম, জেলা বা রাজ্য চেষ্টা করুন।', 'history.maxCompare': 'একসঙ্গে সর্বোচ্চ ৪টি দুর্যোগের তুলনা করা যায়।',
    'assistant.grounded': 'বহুভাষী বক্তৃতা শনাক্তকরণসহ প্রমাণভিত্তিক AI', 'assistant.listening': '{language} ভাষায় শুনছি… এখন বলুন!', 'assistant.placeholder': '{language} বা ইংরেজিতে জিজ্ঞাসা করুন…', 'assistant.record': 'বক্তৃতা রেকর্ড ও প্রতিলিপি করুন', 'assistant.pipeline': 'প্রমাণভিত্তিক বিশ্লেষণ চলছে…', 'assistant.unavailable': 'পাওয়া উৎসে তথ্য উপলব্ধ নেই।', 'assistant.error': 'AI প্রশ্নটি সম্পন্ন করা যায়নি। সংযোগ পরীক্ষা করুন।',
    'voice.record': 'রেকর্ড ও বক্তৃতা প্রতিলিপির জন্য ক্লিক করুন', 'voice.stop': 'থামান ({seconds}সে)', 'voice.transcribing': 'প্রতিলিপি হচ্ছে…', 'voice.microphoneDenied': 'মাইক্রোফোন অনুমতি অস্বীকৃত বা অনুপলব্ধ।', 'voice.noSpeech': 'কোনো বক্তৃতা পাওয়া যায়নি। স্পষ্ট করে বলুন।', 'voice.transcriptionError': 'প্রতিলিপি ত্রুটি। আবার চেষ্টা করুন।', 'voice.processingError': 'অডিও প্রক্রিয়া করা যায়নি।',
    'footer.status': 'ফিড অবস্থা: {status} • বহুভাষী সহায়তা সক্রিয়', 'error.notFoundTitle': 'পৃষ্ঠা পাওয়া যায়নি', 'error.notFoundBody': 'আপনি যে পৃষ্ঠাটি চেয়েছেন তা এই কর্মক্ষেত্রে নেই।', 'error.returnDashboard': 'ড্যাশবোর্ডে ফিরুন',
    'future.timelineTitle': 'পূর্বাভাস সময়রেখা',
    'future.timelineSubtitle': 'পূর্বাভাসিত বন্যার অবস্থান তৈরি করতে একটি পূর্বাভাস মাস নির্বাচন করুন।',
    'future.generating': 'পূর্বাভাস তৈরি করা হচ্ছে...',
    'future.unavailable': 'পূর্বাভাস অনুপলব্ধ',
    'future.drawerTitle': 'পূর্বাভাসিত বন্যার অবস্থান',
    'future.rankTitle': 'র‌্যাঙ্ক #{rank} পূর্বাভাস',
    'future.tabOverview': 'সারসংক্ষেপ ও ভূগোল',
    'future.tabAnalysis': 'তীব্রতা বিশ্লেষণ',
    'future.probability': 'বন্যার সম্ভাবনা',
    'future.probabilityDesc': 'মডেল-ানুমানিক সম্ভাবনা যে এই অবস্থানটি নির্বাচিত মাসের জন্য বন্যা-পর্যবেক্ষিত শ্রেণীর অন্তর্গত।',
    'future.coordinates': 'স্থানাঙ্ক',
    'future.latitude': 'অক্ষাংশ',
    'future.longitude': 'দ্রাঘিমাংশ',
    'future.severityTitle': 'পূর্বাভাসিত তীব্রতার মাত্রা',
    'future.peakLevel': 'সর্বোচ্চ বন্যার স্তর',
    'future.warningLevel': 'সতর্কতার স্তর',
    'future.dangerLevel': 'বিপদের স্তর',
    'future.historicalTitle': 'ঐতিহাসিক প্রমাণ',
    'future.historicalDesc': 'এই প্রার্থী অবস্থানে রেকর্ড করা ঐতিহাসিক বন্যার পর্যবেক্ষণ।',
    'future.modelTitle': 'মডেল ব্যাখ্যা',
    'future.modelDesc': 'সম্ভাবনাটি হলো বন্যা-পর্যবেক্ষিত শ্রেণীর জন্য XGBoost মডেলের আনুমানিক সম্ভাবনা। এটি একটি মডেল স্কোর এবং সম্ভাবনা ক্রমাঙ্কন ছাড়া একটি নিশ্চিত বাস্তব-জগতের সম্ভাবনা হিসাবে ব্যাখ্যা করা উচিত নয়।',
    'future.riskLevel': 'ঝুঁকির মাত্রা',
    'future.highRisk': 'উচ্চ ঝুঁকি',
    'future.mediumRisk': 'মাঝারি ঝুঁকি',
    'future.lowRisk': 'কম ঝুঁকি',
    'future.aboveDanger': 'বিপদ সীমার উপরে',
    'future.aboveWarning': 'সতর্কতা সীমার উপরে',
    'future.belowWarning': 'স্বাভাবিক প্রবাহ',
  },
} as const;

export type TranslationKey = keyof typeof UI_COPY.en;
export function translate(language: string, key: TranslationKey, values: Record<string, string | number> = {}): string {
  const dictionary = UI_COPY[language as keyof typeof UI_COPY] || UI_COPY.en;
  let value = (dictionary as Record<string, string>)[key] || UI_COPY.en[key] || key;
  const count = Number(values.count);
  value = value.replace('{plural}', count === 1 ? '' : 's');
  return value.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

export function getLocale(language: string): string {
  return (INDIAN_LANGUAGES.find((item) => item.code === language) || INDIAN_LANGUAGES[0]).speechLocale;
}

const HAZARD_LABELS: Record<string, Record<string, string>> = {
  en: {},
  hi: { Cyclone: 'चक्रवात', Flood: 'बाढ़', Earthquake: 'भूकंप', Landslide: 'भूस्खलन', 'Heat Wave': 'लू', Lightning: 'आकाशीय बिजली', Thunderstorm: 'आंधी-तूफ़ान', 'Heavy Rain': 'भारी वर्षा', Storm: 'तूफ़ान', Tsunami: 'सुनामी', Avalanche: 'हिमस्खलन', 'Forest Fire': 'वनाग्नि', Drought: 'सूखा', 'Urban Flood': 'शहरी बाढ़', 'General Alert': 'सामान्य चेतावनी' },
  bn: { Cyclone: 'ঘূর্ণিঝড়', Flood: 'বন্যা', Earthquake: 'ভূমিকম্প', Landslide: 'ভূমিধস', 'Heat Wave': 'তাপপ্রবাহ', Lightning: 'বজ্রপাত', Thunderstorm: 'বজ্রঝড়', 'Heavy Rain': 'ভারী বৃষ্টি', Storm: 'ঝড়', Tsunami: 'সুনামি', Avalanche: 'তুষারধস', 'Forest Fire': 'বন আগুন', Drought: 'খরা', 'Urban Flood': 'শহুরে বন্যা', 'General Alert': 'সাধারণ সতর্কতা' },
};

export function hazardLabel(language: string, category: string): string {
  return HAZARD_LABELS[language]?.[category] || category;
}

const ALERT_ENUM_LABELS: Record<string, Record<string, string>> = {
  en: {},
  hi: { Extreme: 'अत्यंत', Severe: 'गंभीर', Moderate: 'मध्यम', Minor: 'न्यून', Unknown: 'अज्ञात', Immediate: 'तत्काल', Expected: 'अपेक्षित', Future: 'भविष्य', Past: 'पूर्व', Observed: 'देखा गया', Likely: 'संभावित', Possible: 'संभव', Unlikely: 'असंभावित' },
  bn: { Extreme: 'চরম', Severe: 'তীব্র', Moderate: 'মধ্যম', Minor: 'সামান্য', Unknown: 'অজানা', Immediate: 'তাৎক্ষণিক', Expected: 'প্রত্যাশিত', Future: 'ভবিষ্যৎ', Past: 'অতীত', Observed: 'পর্যবেক্ষিত', Likely: 'সম্ভাব্য', Possible: 'সম্ভব', Unlikely: 'অসম্ভাব্য' },
};

export function alertEnumLabel(language: string, value: string): string {
  return ALERT_ENUM_LABELS[language]?.[value] || value;
}
