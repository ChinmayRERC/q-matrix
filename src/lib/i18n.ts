/**
 * Partial localisation.
 *
 * Only the navigation, page titles and the two entry learning paths are
 * translated. Lesson prose is English-only: machine-translating physics is worse
 * than leaving it, and a half-translated lesson would strand a learner mid-flow.
 */
import { useSyncExternalStore } from 'react'

export type Locale = 'en' | 'hi' | 'kn'

const KEY = 'qmatrix-locale'
const listeners = new Set<() => void>()

let current: Locale = (() => {
  try {
    const saved = localStorage.getItem(KEY) as Locale | null
    return saved === 'hi' || saved === 'kn' ? saved : 'en'
  } catch {
    return 'en'
  }
})()

export const LOCALES: Array<{ id: Locale; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'kn', label: 'ಕನ್ನಡ' },
]

export const getLocale = (): Locale => current

export function setLocale(locale: Locale): void {
  current = locale
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* private mode: keep the in-memory choice */
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale, getLocale)

type Table = Record<string, string>

const en: Table = {
  'nav.dashboard': 'Dashboard',
  'nav.galaxy': 'Galaxy',
  'nav.paths': 'Paths',
  'nav.india': 'India',
  'nav.hardware': 'Hardware',
  'nav.lab': 'Workbench',
  'nav.challenges': 'Challenges',
  'nav.game': 'Qubit Lab',
  'nav.progress': 'Progress & data',
  'page.dashboard.title': 'Dashboard',
  'page.dashboard.sub': 'Your next best move',
  'page.galaxy.title': 'Quantum Galaxy',
  'page.galaxy.sub': 'Spatial knowledge map',
  'page.paths.title': 'Learning paths',
  'page.paths.sub': 'Eight routes to quantum fluency',
  'page.game.title': 'Qubit Lab',
  'page.game.sub': 'Learn the first ideas by playing',
  'page.india.title': "India's Quantum Future",
  'page.india.sub': 'NQM, RRI and the machines being built',
  'page.hardware.title': 'Hardware',
  'page.hardware.sub': 'The physical stack behind the circuit',
  'page.lab.title': 'Workbench',
  'page.lab.sub': 'Design, simulate, export',
  'page.lesson.title': 'Virtual Lab',
  'page.lesson.sub': 'Seven-stage guided lesson',
  'page.challenges.title': 'Challenges',
  'page.challenges.sub': 'Auto-graded circuit problems',
  'page.progress.title': 'Progress & data',
  'page.progress.sub': 'Mastery, badges, educator export and settings',
  'path.quantum-beginner': 'Quantum Beginner',
  'path.quantum-programmer': 'Quantum Programmer',
}

const hi: Table = {
  'nav.dashboard': 'डैशबोर्ड',
  'nav.galaxy': 'गैलेक्सी',
  'nav.paths': 'पथ',
  'nav.india': 'भारत',
  'nav.hardware': 'हार्डवेयर',
  'nav.lab': 'वर्कबेंच',
  'nav.challenges': 'चुनौतियाँ',
  'nav.game': 'क्यूबिट लैब',
  'nav.progress': 'प्रगति और डेटा',
  'page.dashboard.title': 'डैशबोर्ड',
  'page.dashboard.sub': 'आपका अगला सबसे अच्छा कदम',
  'page.galaxy.title': 'क्वांटम गैलेक्सी',
  'page.galaxy.sub': 'ज्ञान का स्थानिक नक्शा',
  'page.paths.title': 'सीखने के पथ',
  'page.paths.sub': 'क्वांटम दक्षता तक आठ रास्ते',
  'page.game.title': 'क्यूबिट लैब',
  'page.game.sub': 'खेलते हुए पहली बातें सीखें',
  'page.india.title': 'भारत का क्वांटम भविष्य',
  'page.india.sub': 'राष्ट्रीय क्वांटम मिशन, RRI और बन रही मशीनें',
  'page.hardware.title': 'हार्डवेयर',
  'page.hardware.sub': 'सर्किट के पीछे की भौतिक परत',
  'page.lab.title': 'वर्कबेंच',
  'page.lab.sub': 'बनाएँ, सिम्युलेट करें, निर्यात करें',
  'page.lesson.title': 'वर्चुअल लैब',
  'page.lesson.sub': 'सात चरणों वाला निर्देशित पाठ',
  'page.challenges.title': 'चुनौतियाँ',
  'page.challenges.sub': 'स्वतः जाँचे जाने वाले सर्किट प्रश्न',
  'page.progress.title': 'प्रगति और डेटा',
  'page.progress.sub': 'महारत, बैज, शिक्षक निर्यात और सेटिंग्स',
  'path.quantum-beginner': 'क्वांटम शुरुआती',
  'path.quantum-programmer': 'क्वांटम प्रोग्रामर',
}

const kn: Table = {
  'nav.dashboard': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  'nav.galaxy': 'ಗ್ಯಾಲಕ್ಸಿ',
  'nav.paths': 'ಮಾರ್ಗಗಳು',
  'nav.india': 'ಭಾರತ',
  'nav.hardware': 'ಹಾರ್ಡ್‌ವೇರ್',
  'nav.lab': 'ವರ್ಕ್‌ಬೆಂಚ್',
  'nav.challenges': 'ಸವಾಲುಗಳು',
  'nav.game': 'ಕ್ವಿಬಿಟ್ ಲ್ಯಾಬ್',
  'nav.progress': 'ಪ್ರಗತಿ ಮತ್ತು ಡೇಟಾ',
  'page.dashboard.title': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  'page.dashboard.sub': 'ನಿಮ್ಮ ಮುಂದಿನ ಉತ್ತಮ ಹೆಜ್ಜೆ',
  'page.galaxy.title': 'ಕ್ವಾಂಟಮ್ ಗ್ಯಾಲಕ್ಸಿ',
  'page.galaxy.sub': 'ಜ್ಞಾನದ ಪ್ರಾದೇಶಿಕ ನಕ್ಷೆ',
  'page.paths.title': 'ಕಲಿಕೆಯ ಮಾರ್ಗಗಳು',
  'page.paths.sub': 'ಕ್ವಾಂಟಮ್ ಪರಿಣತಿಗೆ ಎಂಟು ದಾರಿಗಳು',
  'page.game.title': 'ಕ್ವಿಬಿಟ್ ಲ್ಯಾಬ್',
  'page.game.sub': 'ಆಡುತ್ತಾ ಮೊದಲ ಪರಿಕಲ್ಪನೆಗಳನ್ನು ಕಲಿಯಿರಿ',
  'page.india.title': 'ಭಾರತದ ಕ್ವಾಂಟಮ್ ಭವಿಷ್ಯ',
  'page.india.sub': 'ರಾಷ್ಟ್ರೀಯ ಕ್ವಾಂಟಮ್ ಮಿಷನ್, RRI ಮತ್ತು ನಿರ್ಮಾಣವಾಗುತ್ತಿರುವ ಯಂತ್ರಗಳು',
  'page.hardware.title': 'ಹಾರ್ಡ್‌ವೇರ್',
  'page.hardware.sub': 'ಸರ್ಕ್ಯೂಟ್‌ನ ಹಿಂದಿನ ಭೌತಿಕ ಪದರ',
  'page.lab.title': 'ವರ್ಕ್‌ಬೆಂಚ್',
  'page.lab.sub': 'ವಿನ್ಯಾಸಿಸಿ, ಸಿಮ್ಯುಲೇಟ್ ಮಾಡಿ, ರಫ್ತು ಮಾಡಿ',
  'page.lesson.title': 'ವರ್ಚುವಲ್ ಲ್ಯಾಬ್',
  'page.lesson.sub': 'ಏಳು ಹಂತಗಳ ಮಾರ್ಗದರ್ಶಿ ಪಾಠ',
  'page.challenges.title': 'ಸವಾಲುಗಳು',
  'page.challenges.sub': 'ಸ್ವಯಂ ಮೌಲ್ಯಮಾಪನ ಸರ್ಕ್ಯೂಟ್ ಸಮಸ್ಯೆಗಳು',
  'page.progress.title': 'ಪ್ರಗತಿ ಮತ್ತು ಡೇಟಾ',
  'page.progress.sub': 'ಪ್ರಾವೀಣ್ಯ, ಬ್ಯಾಡ್ಜ್‌ಗಳು, ಶಿಕ್ಷಕರ ರಫ್ತು ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
  'path.quantum-beginner': 'ಕ್ವಾಂಟಮ್ ಆರಂಭಿಕ',
  'path.quantum-programmer': 'ಕ್ವಾಂಟಮ್ ಪ್ರೋಗ್ರಾಮರ್',
}

const TABLES: Record<Locale, Table> = { en, hi, kn }

/** Look up a label, falling back to English and then the key itself. */
export function t(key: string, locale: Locale = current, fallback?: string): string {
  return TABLES[locale]?.[key] ?? en[key] ?? fallback ?? key
}
