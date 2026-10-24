// =====================================================================
//  ROADTRIP — réglages
//  C'est le SEUL fichier à modifier après le déploiement.
//  Laisse SUPABASE_URL vide pour tester l'appli en mode démo.
// =====================================================================
window.OSCC_CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: "https://nkzkzplwitkmwdzxotjj.supabase.co",                 // ex. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5remt6cGx3aXRrbXdkenhvdGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NTgzNjUsImV4cCI6MjEwODQzNDM2NX0.Wf4YQD9mv_XT7ryQr8A6mIo7LtqFIzW6FrTN4JceB6Q",            // la clé « anon public » (elle peut être publique)

  // Clé PUBLIQUE générée avec tools/vapid.html
  VAPID_PUBLIC_KEY: "BGTHur24nhP1v8mkdSdCsMQJOg7sUGnckDYvoOay0YCdgaacHinuoqCwJ0zIB0_T4MXm-act_2uHs-JuHoyA4v4",
  PUSH_FUNCTION: "quick-worker",
  // Le voyage
  TRAVELER_NAME: "Antoine",           // prénom du voyageur
  TRIP_START: "2026-11-01",         // date de départ (AAAA-MM-JJ)
  TRIP_DAYS: 183,                   // durée prévue en jours

  // Contacts référents pour le SOS sans internet (SMS)
  // Numéros au format international, sans espaces.
  REFERENTS: [
    { name: "Référent 1", phone: "+33600000001" },
    { name: "Référent 2", phone: "+33600000002" },
  ],
};
