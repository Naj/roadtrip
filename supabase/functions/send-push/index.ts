// =====================================================================
//  ROADTRIP — Edge Function « send-push »
//  1. Appelée par un Database Webhook à chaque nouveau message :
//   - message du voyageur      → tout le groupe
//   - message du groupe        → personne : il part dans le courrier du mois
//   - SOS                      → tout le monde (notification persistante)
//   - réponse à un SOS         → tout le monde, voyageur compris (coordination)
//  2. Appelée le 1er de chaque mois par une tâche planifiée ({"type":"MONTHLY"}) :
//   signale au voyageur que du courrier l'attend (seulement s'il a activé les notifications),
//   et prévient le groupe que le courrier est parti. Le voyageur l'ouvre quand il veut.
//
//  Secrets à déclarer (Edge Functions > Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:toi@exemple.fr),
//   WEBHOOK_SECRET (une phrase aléatoire, recopiée dans l'en-tête du webhook)
//  SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
// =====================================================================

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const POKES: Record<string, string> = {
  pense: "pense à toi 💭",
  cafe: "t'offre un café ☕",
  calin: "t'envoie un câlin 🤗",
  courage: "t'envoie du courage 💪",
  bureau: "dit que tu manques au bureau 😂",
};

type Msg = {
  id: string; author_id: string; kind: string; body: string | null; poke: string | null;
  reply_to: string | null; lat: number | null; lng: number | null; battery: number | null;
};

function buildNotification(msg: Msg, authorName: string) {
  const base = { url: `./#m-${msg.id}`, tag: `msg-${msg.id}`, urgent: false };
  switch (msg.kind) {
    case "sos": {
      const where = msg.lat != null ? ` Position : ${msg.lat.toFixed(4)}, ${msg.lng!.toFixed(4)}.` : " Position indisponible.";
      const batt = msg.battery != null ? ` Batterie ${msg.battery} %.` : "";
      return { ...base, urgent: true, tag: "sos",
        title: `🚨 SOS de ${authorName}`,
        body: `${msg.body ?? "Alerte déclenchée."}${where}${batt} Ouvre l'appli.` };
    }
    case "checkin":
      return { ...base, tag: "checkin", title: `${authorName} va bien ✅`, body: msg.body ? `Étape : ${msg.body}` : "Nouvelle étape enregistrée." };
    case "poke":
      return { ...base, tag: `poke-${msg.author_id}`, title: authorName, body: `${authorName} ${POKES[msg.poke ?? "pense"] ?? "pense à toi"}` };
    case "photo":
      return { ...base, title: `📷 ${authorName}`, body: msg.body || "a partagé une photo" };
    default:
      return { ...base, title: authorName, body: (msg.body ?? "").slice(0, 140) };
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("Accès refusé", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type === "MONTHLY") return monthlyMail();
  const msg: Msg | undefined = payload?.record;
  if (!msg || payload?.type !== "INSERT") return new Response("Rien à faire");

  const { data: author } = await supabase.from("members").select("name, role").eq("id", msg.author_id).single();
  if (!author) return new Response("Auteur inconnu", { status: 404 });

  // Une réponse à un SOS est diffusée à tout le monde
  let replyToSos = false;
  if (msg.reply_to) {
    const { data: parent } = await supabase.from("messages").select("kind").eq("id", msg.reply_to).single();
    replyToSos = parent?.kind === "sos";
  }

  const { data: members } = await supabase.from("members").select("id, role");
  const recipients = (members ?? [])
    .filter((m) => m.id !== msg.author_id)
    .filter((m) => {
      if (msg.kind === "sos" || replyToSos) return true;
      // Les messages du groupe attendent le courrier du 1er : pas de notification
      return author.role === "voyageur" && m.role === "groupe";
    })
    .map((m) => m.id);

  if (recipients.length === 0) return new Response("Aucun destinataire");

  const notification = buildNotification(msg, author.name);
  return pushTo(recipients, notification, msg.kind === "sos");
});

// Envoie une notification à une liste de membres
async function pushTo(recipients: string[], note: Record<string, unknown>, urgent = false) {
  const { data: subs } = await supabase
    .from("push_subscriptions").select("endpoint, p256dh, auth").in("member_id", recipients);

  const notification = JSON.stringify(note);
  const options = { TTL: urgent ? 86400 : 43200, urgency: urgent ? "high" : "normal" } as const;

  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, notification, options);
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      // Abonnement expiré ou révoqué : on le supprime
      if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("Échec d'envoi", code, err);
    }
  }));

  return new Response(JSON.stringify({ sent, total: subs?.length ?? 0 }), { headers: { "Content-Type": "application/json" } });
}

// Le 1er du mois : le courrier du mois précédent s'ouvre
async function monthlyMail() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = start.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });

  const { data: members } = await supabase.from("members").select("id, name, role");
  const group = (members ?? []).filter((m) => m.role === "groupe").map((m) => m.id);
  const travelers = (members ?? []).filter((m) => m.role === "voyageur");
  if (!travelers.length) return new Response("Pas de voyageur");

  const { data: rows } = await supabase.from("messages")
    .select("kind, author_id, reply_to")
    .in("author_id", group)
    .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());

  // On écarte les réponses à un SOS, déjà vues sur le moment
  const parents = [...new Set((rows ?? []).map((r) => r.reply_to).filter(Boolean))];
  const { data: sosRows } = parents.length
    ? await supabase.from("messages").select("id").in("id", parents).eq("kind", "sos")
    : { data: [] };
  const sosIds = new Set((sosRows ?? []).map((r) => r.id));
  const mail = (rows ?? []).filter((r) => !r.reply_to || !sosIds.has(r.reply_to));
  if (!mail.length) return new Response("Courrier vide");

  const photos = mail.filter((r) => r.kind === "photo").length;
  const pokes = mail.filter((r) => r.kind === "poke").length;
  const texts = mail.length - photos - pokes;
  const senders = new Set(mail.map((r) => r.author_id)).size;
  const parts = [[texts, "message"], [photos, "photo"], [pokes, "poke"]]
    .filter(([n]) => n).map(([n, w]) => `${n} ${w}${(n as number) > 1 ? "s" : ""}`);
  const detail = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : parts[0];
  const name = travelers[0].name;

  await pushTo(travelers.map((t) => t.id), {
    title: `📬 Du courrier t'attend`,
    body: `${detail} du groupe. À ouvrir quand tu veux, aucune réponse attendue.`,
    tag: `courrier-${month}`, url: "./",
  });
  return pushTo(group, {
    title: `📬 Le courrier de ${month} est parti`,
    body: `${mail.length} envois de ${senders} collègue${senders > 1 ? "s" : ""}. ${name} l'ouvrira s'il le souhaite.`,
    tag: `courrier-${month}`, url: "./",
  });
}
