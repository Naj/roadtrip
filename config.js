// =====================================================================
//  ROADTRIP — réglages
//  C'est le SEUL fichier à modifier après le déploiement.
//  Laisse SUPABASE_URL vide pour tester l'appli en mode démo.
// =====================================================================
window.OSCC_CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: "",                 // ex. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",            // la clé « anon public » (elle peut être publique)

  // Clé PUBLIQUE générée avec tools/vapid.html
  VAPID_PUBLIC_KEY: "",

  // Le voyage
  TRAVELER_NAME: "Antoine",           // prénom du voyageur
  TRIP_START: "2026-11-02",         // date de départ (AAAA-MM-JJ)
  TRIP_DAYS: 183,                   // durée prévue en jours

  // Contacts référents pour le SOS sans internet (SMS)
  // Numéros au format international, sans espaces.
  REFERENTS: [
    { name: "Référent 1", phone: "+33600000001" },
    { name: "Référent 2", phone: "+33600000002" },
  ],
};
