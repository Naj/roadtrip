// =====================================================================
//  ROADTRIP — réglages
//  C'est le SEUL fichier qui contient tes réglages.
//  Lors d'une mise à jour, NE REMPLACE JAMAIS ce fichier : garde le tien.
//  (SUPABASE_URL vide = mode démo.)
// =====================================================================
window.OSCC_CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: "https://nkzkzplwitkmwdzxotjj.supabase.co",
  SUPABASE_ANON_KEY: "",            // À RECOPIER : clé « anon public » (commence par eyJ)

  // Clé PUBLIQUE générée avec tools/vapid.html
  VAPID_PUBLIC_KEY: "",             // À RECOPIER : la même valeur que le secret VAPID_PUBLIC_KEY

  // Fin de l'URL de la fonction d'envoi (Edge Functions > colonne URL, après /functions/v1/)
  PUSH_FUNCTION: "quick-worker",

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
