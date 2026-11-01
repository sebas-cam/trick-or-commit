import type { Door, Verdict, VerdictId } from "./score";

export type Lang = "es" | "en";
export type Theme = "halloween" | "muertos";

export function parseLang(value: string | null | undefined): Lang {
  return value === "es" ? "es" : "en";
}

export function parseTheme(value: string | undefined): Theme {
  return value === "muertos" ? "muertos" : "halloween";
}

type VerdictText = { title: string; tagline: string; stat: (n: number) => string };

const num = (lang: Lang, n: number) => n.toLocaleString(lang === "es" ? "es-CO" : "en-US");

const VERDICTS: Record<Lang, Record<VerdictId, VerdictText>> = {
  es: {
    empty: { title: "Cubeta Vacía", tagline: "No hay puertas donde tocar. Todavía.", stat: () => "0 repos públicos" },
    fullSize: { title: "Chocolate Gigante", tagline: "Todos tus repos reparten de los buenos.", stat: (n) => `${n} de ${n} repos con dulces` },
    graveyard: { title: "Turno de Cementerio", tagline: "Todos tus repos fueron truco. Hora de revivir algo.", stat: (n) => `${n} repos sin un push en más de un año` },
    nightKnocker: { title: "Toca-Puertas de Medianoche", tagline: "Cuando todos duermen, tú haces push.", stat: (n) => `${n}% de tus commits entre medianoche y las 5 a. m.` },
    sugarRush: { title: "Subidón de Azúcar", tagline: "No paras de repartir commits.", stat: (n) => `${n.toLocaleString("es-CO")} contribuciones este año` },
    candyHoarder: { title: "Acaparador de Dulces", tagline: "La gente te deja estrellas en la cubeta.", stat: (n) => `${n.toLocaleString("es-CO")} estrellas en tus repos` },
    hauntedKeeper: { title: "Casero Embrujado", tagline: "Tus repos no están muertos. Solo descansan.", stat: (n) => `${n} repos sin un push en más de un año` },
    trickOrTreater: { title: "Dulce o Truco", tagline: "Mitad dulces, mitad telarañas.", stat: (n) => `${n} repos con dulces` },
  },
  en: {
    empty: { title: "The Empty Bucket", tagline: "No doors to knock on. Yet.", stat: () => "0 public repos" },
    fullSize: { title: "Full-Size Candy Bar", tagline: "Every repo hands out the good stuff.", stat: (n) => `${n} of ${n} repos gave treats` },
    graveyard: { title: "Graveyard Shift", tagline: "Every repo was a trick. Time to raise the dead.", stat: (n) => `${n} repos without a push in over a year` },
    nightKnocker: { title: "Midnight Knocker", tagline: "While everyone sleeps, you push.", stat: (n) => `${n}% of your commits land between midnight and 5 AM` },
    sugarRush: { title: "Sugar Rush Shipper", tagline: "You just keep handing out commits.", stat: (n) => `${n.toLocaleString("en-US")} contributions this year` },
    candyHoarder: { title: "Candy Hoarder", tagline: "People keep dropping stars in your bucket.", stat: (n) => `${n.toLocaleString("en-US")} stars across your repos` },
    hauntedKeeper: { title: "Haunted House Keeper", tagline: "Your repos aren't dead. They're just resting.", stat: (n) => `${n} repos without a push in over a year` },
    trickOrTreater: { title: "Trick-or-Treater", tagline: "Half candy, half cobwebs.", stat: (n) => `${n} repos gave treats` },
  },
};

export function verdictText(v: Pick<Verdict, "id" | "stat">, lang: Lang) {
  const t = VERDICTS[lang][v.id];
  return { title: t.title, tagline: t.tagline, stat: t.stat(v.stat) };
}

export function ageLabel(days: number, lang: Lang) {
  const es = lang === "es";
  if (days < 1) return es ? "hoy" : "today";
  if (days < 30) return es ? `hace ${Math.round(days)} d` : `${Math.round(days)}d ago`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return es ? `hace ${months} ${months === 1 ? "mes" : "meses"}` : `${months}mo ago`;
  }
  const years = (days / 365).toFixed(1);
  return es ? `hace ${years.replace(".", ",")} años` : `${years}y ago`;
}

/** The line under TREAT/TRICK: it has to name something true about this repo. */
export function doorLine(d: Door, lang: Lang) {
  const es = lang === "es";
  if (d.outcome === "trick") return es ? `Sin un push: ${ageLabel(d.days, lang)}` : `Last push: ${ageLabel(d.days, lang)}`;
  if (d.stars > 0) return `★ ${num(lang, d.stars)}${d.language ? ` · ${d.language}` : ""}`;
  return es ? `Último push: ${ageLabel(d.days, lang)}` : `Last push: ${ageLabel(d.days, lang)}`;
}

export const UI = {
  es: {
    privateCta: "Incluir mis repos privados",
    privateHint: "Solo lectura de metadatos: nunca vemos tu código y no guardamos nada. Tú eliges los repos.",
    authFailed: "No pudimos conectar con GitHub. Inténtalo de nuevo.",
    privateRepo: "repo privado",
    showNames: "Mostrar nombres de repos privados",
    hideNames: "Ocultar nombres de repos privados",
    privateRunNote: "Esta versión solo la ves tú. Para compartirla, descarga el video o la imagen.",
    privateCount: (n: number) => (n === 1 ? "1 repo privado compartido" : `${n} repos privados compartidos`),
    noneShared: "Aún no compartes repos privados. Elígelos en GitHub.",
    chooseRepos: "Elegir repos en GitHub",
    signOut: "Cerrar sesión",
    eyebrow: "TU GITHUB ABRE LA PUERTA",
    lead: "Tu pet de Petdex toca la puerta de cada uno de tus repos. Los activos dan dulces. Los abandonados te asustan.",
    placeholder: "usuario",
    usernameLabel: "Usuario de GitHub",
    knock: "Toca la puerta",
    knocking: "Tocando…",
    invalid: "Ese no parece un usuario de GitHub.",
    how: [
      ["Tocamos tus repos", "Los más conocidos, los más recientes y, al final, el más abandonado."],
      ["Dulce o truco", "Un push reciente da dulces. Años de silencio traen sustos."],
      ["Te llevas el video", "Vertical, con sonido y listo para publicar."],
    ],
    titles: "Los veredictos",
    is: "es",
    treats: "dulces",
    tricks: "trucos",
    oneTreat: "dulce",
    oneTrick: "truco",
    streak: "días de racha",
    treat: "¡DULCE!",
    trick: "¡TRUCO!",
    door: (i: number, n: number) => `puerta ${i} de ${n}`,
    summon: "Invocando a tu pet…",
    petError: "No pudimos cargar a tu pet. Recarga para intentarlo de nuevo.",
    noPet: "Petdex no responde ahora mismo. Recarga en un momento.",
    video: "Generar video",
    rendering: (pct: number) => `Generando… ${pct}%`,
    downloadVideo: "Descargar video",
    downloadImage: "Descargar imagen",
    share: "Compartir",
    copy: "Copiar link",
    copied: "Copiado",
    sound: "Activar sonido",
    mute: "Silenciar",
    choosePet: "Elige tu pet",
    theme: "Tema",
    themes: { halloween: "Halloween", muertos: "Día de Muertos" },
    log: "Lo que encontró",
    tryAnother: "Probar con otro usuario",
    install: "Llévatelo a tu terminal",
    madeBy: "hecho por",
    renderFail: "No pudimos generar el video en este navegador. Prueba con Chrome o Safari.",
    webm: "Este navegador solo exporta WebM. Para X usa Chrome o Safari actualizados, que exportan MP4.",
    errorTitle: "Error fantasma",
    errorBody: "GitHub nos está limitando. Inténtalo de nuevo en un minuto.",
    back: "Volver",
    notFoundTitle: "Aquí no vive nadie",
    notFoundBody: "No encontramos ese usuario de GitHub.",
    shareText: (title: string, treats: number, tricks: number) =>
      `Mi pet de Petdex salió a pedir dulces por mis repos de GitHub 🎃\n\n🍬 ${treats} dulces · 🕸️ ${tricks} trucos → "${title}"\n\nPrueba el tuyo:`,
    footer: "Pets de",
    notAffiliated: "Sin afiliación con GitHub ni Petdex",
    videoLead: "¿Qué hay detrás de tu puerta?",
    isA: "es",
  },
  en: {
    privateCta: "Include my private repos",
    privateHint: "Read-only metadata: we never see your code and store nothing. You pick the repos.",
    authFailed: "Couldn't connect to GitHub. Please try again.",
    privateRepo: "private repo",
    showNames: "Show private repo names",
    hideNames: "Hide private repo names",
    privateRunNote: "Only you can see this version. To share it, download the video or image.",
    privateCount: (n: number) => (n === 1 ? "1 private repo shared" : `${n} private repos shared`),
    noneShared: "You aren't sharing any private repos yet. Pick them on GitHub.",
    chooseRepos: "Pick repos on GitHub",
    signOut: "Sign out",
    eyebrow: "YOUR GITHUB OPENS THE DOOR",
    lead: "Your Petdex pet knocks on every one of your repos. Active ones hand out treats. Abandoned ones play tricks.",
    placeholder: "username",
    usernameLabel: "GitHub username",
    knock: "Knock knock",
    knocking: "Knocking…",
    invalid: "That doesn't look like a GitHub username.",
    how: [
      ["We knock on your repos", "The best known, the most recent and, last, the most abandoned."],
      ["Treat or trick", "A recent push earns candy. Years of silence earn a scare."],
      ["You keep the video", "Vertical, with sound and ready to post."],
    ],
    titles: "The verdicts",
    is: "is a",
    treats: "treats",
    tricks: "tricks",
    oneTreat: "treat",
    oneTrick: "trick",
    streak: "day streak",
    treat: "TREAT!",
    trick: "TRICK!",
    door: (i: number, n: number) => `door ${i} of ${n}`,
    summon: "Summoning your pet…",
    petError: "Couldn't load your pet. Refresh to try again.",
    noPet: "Petdex isn't answering right now. Refresh in a moment.",
    video: "Render video",
    rendering: (pct: number) => `Rendering… ${pct}%`,
    downloadVideo: "Download video",
    downloadImage: "Download image",
    share: "Share",
    copy: "Copy link",
    copied: "Copied",
    sound: "Sound on",
    mute: "Mute",
    choosePet: "Pick your pet",
    theme: "Theme",
    themes: { halloween: "Halloween", muertos: "Día de Muertos" },
    log: "What it found",
    tryAnother: "Try another username",
    install: "Take it to your terminal",
    madeBy: "made by",
    renderFail: "Couldn't render the video in this browser. Try Chrome or Safari.",
    webm: "This browser only exports WebM. For X, use an up-to-date Chrome or Safari, which export MP4.",
    errorTitle: "Spooky error",
    errorBody: "GitHub is rate-limiting us right now. Try again in a minute.",
    back: "Back",
    notFoundTitle: "Nobody lives here",
    notFoundBody: "We couldn't find that GitHub user.",
    shareText: (title: string, treats: number, tricks: number) =>
      `My Petdex pet went trick-or-treating through my GitHub repos 🎃\n\n🍬 ${treats} treats · 🕸️ ${tricks} tricks → "${title}"\n\nTry yours:`,
    footer: "Pets by",
    notAffiliated: "Not affiliated with GitHub or Petdex",
    videoLead: "What's behind your door?",
    isA: "is a",
  },
} as const;

export const VERDICT_IDS: VerdictId[] = ["nightKnocker", "sugarRush", "candyHoarder", "fullSize", "hauntedKeeper", "graveyard"];
