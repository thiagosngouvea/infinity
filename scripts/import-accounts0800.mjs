/**
 * scripts/import-accounts0800.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Importa as Contas 0800 do Excel para o Firestore.
 *
 * PRÉ-REQUISITOS:
 *   1. Firebase Console → Configurações → Contas de serviço → Gerar nova chave
 *   2. Salve como: scripts/serviceAccountKey.json
 *
 * USO:
 *   node scripts/import-accounts0800.mjs             # importa de verdade
 *   node scripts/import-accounts0800.mjs --dry-run   # apenas visualiza
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import XLSX from 'xlsx';
import admin from 'firebase-admin';

// ─── Config ───────────────────────────────────────────────────────────────────

const CLAN_SLUG   = 'infinity';
const EXCEL_FILE  = 'CONTAS 0800 INFINITY.xlsx';
const SA_KEY_PATH = 'scripts/serviceAccountKey.json';
const DRY_RUN     = process.argv.includes('--dry-run');

// ─── Aliases manuais ──────────────────────────────────────────────────────────
// Chave: nome da aba no Excel em MAIÚSCULAS
// Valor: nick EXATO como está cadastrado no banco
const ALIASES = {
  'Bella':      'Bellaa',
  'LNTIMIDADE': 'RosaPoc',   // aba "lNTIMIDADE" → player RosaPoc no banco
  'IGOLA':      'Igola',
};

// ─── Init ─────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

if (!existsSync(join(root, SA_KEY_PATH))) {
  console.error(`\n❌  Chave de serviço não encontrada em: ${SA_KEY_PATH}`);
  console.error('   Baixe em: Firebase Console → Configurações → Contas de serviço\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(readFileSync(join(root, SA_KEY_PATH), 'utf8'))
  ),
});

const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const up = str => (str ?? '').toString().trim().toUpperCase();
const cv = (row, i) => (row[i] ?? '').toString().trim();

// ─── 1. Lê o Excel ────────────────────────────────────────────────────────────

const excelPath = join(root, EXCEL_FILE);
if (!existsSync(excelPath)) {
  console.error(`\n❌  Arquivo Excel não encontrado: ${EXCEL_FILE}\n`);
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);
console.log(`\n📂  Excel: ${EXCEL_FILE}`);
console.log(`    Abas: ${wb.SheetNames.join(', ')}\n`);

const sheetsData = wb.SheetNames.map(sheetName => {
  const rows    = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  const entries = rows
    .slice(1)
    .filter(r => r.some(c => c !== ''))
    .map(r => ({
      nick:      cv(r, 0), classe:    cv(r, 1),
      login:     cv(r, 2), senha:     cv(r, 3),
      reborn:    cv(r, 4), meridiano: cv(r, 5),
      cultivo:   cv(r, 6), pedra:     cv(r, 7),
      ceu:       cv(r, 8), refino:    cv(r, 9),
    }))
    .filter(e => e.nick || e.login || e.classe);
  return { sheetName, entries };
});

// ─── 2. Busca membros no Firestore ────────────────────────────────────────────

console.log(`🔍  Buscando membros em /clans/${CLAN_SLUG}/users ...`);

const usersSnap = await db.collection('clans').doc(CLAN_SLUG).collection('users').get();
const byNick    = new Map();  // UPPERCASE nick → { id, nick }

usersSnap.forEach(doc => {
  const d = doc.data();
  if (d.nick) byNick.set(up(d.nick), { id: doc.id, nick: d.nick });
});

console.log(`    ${byNick.size} membro(s) encontrado(s).\n`);

// ─── 3. Mapeia abas → membros ─────────────────────────────────────────────────

const toImport = [];
const notFound = [];

for (const { sheetName, entries } of sheetsData) {
  if (entries.length === 0) {
    console.log(`⚠️   "${sheetName}" — sem dados, pulando.`);
    continue;
  }

  const key = up(sheetName);
  let member = null;
  let tag = '';

  // 1. Busca exata
  if (byNick.has(key)) {
    member = byNick.get(key);
    tag    = '✅ ';
  }

  // 2. Alias manual
  if (!member && ALIASES[key]) {
    const m = byNick.get(up(ALIASES[key]));
    if (m) { member = m; tag = '🔁 alias'; }
  }

  // 3. Busca parcial como fallback
  if (!member) {
    for (const [k, m] of byNick) {
      if (k.includes(key) || key.includes(k)) {
        member = m; tag = '🔶 parcial'; break;
      }
    }
  }

  if (member) {
    console.log(`${tag}  "${sheetName}" → ${member.nick} (${member.id}) — ${entries.length} conta(s)`);
    toImport.push({ member, entries });
  } else {
    console.log(`❌  "${sheetName}" → nenhum usuário encontrado no banco!`);
    notFound.push(sheetName);
  }
}

console.log('');

// ─── 4. Verifica docs existentes ─────────────────────────────────────────────

for (const item of toImport) {
  const snap = await db
    .collection('clans').doc(CLAN_SLUG)
    .collection('accounts0800')
    .where('userId', '==', item.member.id)
    .limit(1).get();
  item.existingDocId = snap.empty ? null : snap.docs[0].id;
}

// ─── 5. Escreve no Firestore ─────────────────────────────────────────────────

if (DRY_RUN) console.log('═══════════  DRY RUN — nada será salvo  ═══════════\n');

let created = 0, updated = 0;

for (const { member, entries, existingDocId } of toImport) {
  const data = {
    userId: member.id, userNick: member.nick,
    accounts: entries,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (existingDocId) {
    if (DRY_RUN) {
      console.log(`♻️   [DRY] Atualizaria "${member.nick}" (${existingDocId}) — ${entries.length} conta(s)`);
    } else {
      await db.collection('clans').doc(CLAN_SLUG)
        .collection('accounts0800').doc(existingDocId).update(data);
      console.log(`♻️   Atualizado: "${member.nick}" — ${entries.length} conta(s)`);
      updated++;
    }
  } else {
    const newData = { ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    if (DRY_RUN) {
      console.log(`➕  [DRY] Criaria "${member.nick}" — ${entries.length} conta(s)`);
    } else {
      await db.collection('clans').doc(CLAN_SLUG)
        .collection('accounts0800').add(newData);
      console.log(`➕  Criado: "${member.nick}" — ${entries.length} conta(s)`);
      created++;
    }
  }
}

// ─── 6. Relatório ────────────────────────────────────────────────────────────

console.log('\n══════════════════  RESULTADO  ══════════════════');
if (DRY_RUN) {
  console.log('   Modo DRY RUN — nada foi alterado.');
  console.log(`   Seriam importados: ${toImport.length} player(s)`);
} else {
  console.log(`   ✅ Criados:     ${created}`);
  console.log(`   ♻️  Atualizados: ${updated}`);
}
if (notFound.length > 0) {
  console.log(`\n   ⚠️  Não encontrados (${notFound.length}):`);
  notFound.forEach(n => console.log(`      - "${n}"`));
  console.log('\n   💡 Adicione no mapa ALIASES dentro do script.\n');
}

process.exit(0);
