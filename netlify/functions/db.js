// netlify/functions/db.js
// Proxy sécurisé entre l'app React et Airtable
// La clé API Airtable ne quitte jamais ce fichier serveur

const BASE_ID = "app5qyxyWAo0MokQX";
const TABLES = {
  users:       "tblTB0xraNfJdj5p1",
  matches:     "tbl946eY5aFdF0H6z",
  bets:        "tblWzmfPHVWXFreHy",
  groups:      "tbllvGiL3xciZXg7P",
  bonus:       "tblTels3dxb0KCXng",
  redemptions: "tblDPnZRYu5QnDGLS",
  config:      "tblxMEdkuqAqKk3ua",
};

const AT_URL = `https://api.airtable.com/v0/${BASE_ID}`;

async function atFetch(path, options = {}) {
  const res = await fetch(`${AT_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAll(table) {
  const records = [];
  let offset = null;
  do {
    const url = `/${table}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const data = await atFetch(url);
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

async function upsert(table, keyField, keyValue, fields) {
  // Check if record exists
  const encoded = encodeURIComponent(`{${keyField}} = "${keyValue}"`);
  const data = await atFetch(`/${table}?filterByFormula=${encoded}`);
  
  if (data.records && data.records.length > 0) {
    // Update
    return atFetch(`/${table}/${data.records[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });
  } else {
    // Create
    return atFetch(`/${table}`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }
}

async function deleteRecord(table, keyField, keyValue) {
  const encoded = encodeURIComponent(`{${keyField}} = "${keyValue}"`);
  const data = await atFetch(`/${table}?filterByFormula=${encoded}`);
  if (data.records && data.records.length > 0) {
    await atFetch(`/${table}/${data.records[0].id}`, { method: "DELETE" });
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, table, key, value, keyField, keyValue, fields } = body;

    // ── LOAD ALL (pour charger toutes les données au démarrage) ──
    if (action === "loadAll") {
      const [users, matches, bets, groups, bonus, redemptions, config] = await Promise.all([
        getAll(TABLES.users),
        getAll(TABLES.matches),
        getAll(TABLES.bets),
        getAll(TABLES.groups),
        getAll(TABLES.bonus),
        getAll(TABLES.redemptions),
        getAll(TABLES.config),
      ]);

      // Transformer les enregistrements en objets utilisables
      const parseRecords = (records, primaryField) =>
        Object.fromEntries(
          records
            .filter(r => r.fields[primaryField] && r.fields.data)
            .map(r => [r.fields[primaryField], JSON.parse(r.fields.data)])
        );

      const configObj = Object.fromEntries(
        config
          .filter(r => r.fields.key)
          .map(r => [r.fields.key, r.fields.value])
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          users:       parseRecords(users, "uid"),
          matches:     parseRecords(matches, "mid"),
          bets:        parseRecords(bets, "uid"),
          groups:      parseRecords(groups, "gid"),
          bonus:       parseRecords(bonus, "bid"),
          redemptions: parseRecords(redemptions, "rid"),
          config:      configObj,
        }),
      };
    }

    // ── SAVE (upsert un enregistrement) ──
    if (action === "save") {
      const tableId = TABLES[table];
      if (!tableId) throw new Error(`Table inconnue: ${table}`);
      
      await upsert(tableId, keyField, keyValue, {
        [keyField]: keyValue,
        data: JSON.stringify(value),
      });

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── DELETE (supprimer un enregistrement) ──
    if (action === "delete") {
      const tableId = TABLES[table];
      if (!tableId) throw new Error(`Table inconnue: ${table}`);
      await deleteRecord(tableId, keyField, keyValue);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── SAVE CONFIG ──
    if (action === "saveConfig") {
      await upsert(TABLES.config, "key", key, { key, value });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Action inconnue" }) };

  } catch (err) {
    console.error("DB Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
