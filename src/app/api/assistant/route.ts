import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';

const SYSTEM_PROMPT = `Esti asistentul aplicatiei ExtrasContabil, un instrument SaaS romanesc pentru conversia extraselor bancare in format compatibil SAGA.

FUNCTIONALITATI APLICATIE:
- Incarcarea extraselor de cont de la 9 banci romanesti: BCR, BRD, Banca Transilvania, ING, Raiffeisen, CEC Bank, UniCredit, OTP Bank, Alpha Bank
- Formate suportate: CSV (specific fiecarei banci), MT940 (SWIFT), CAMT.053 (ISO 20022 XML)
- Detectie automata a bancii si formatului
- 5 straturi de validare: structurala, encoding, semantica, financiara (reconciliere sold), verificari incrucisate
- Previzualizare si editare tranzactii inainte de export
- Export in format SAGA (CSV cu separator ; , date DD.MM.YYYY, sume format romanesc 1.234,56, encoding Windows-1250)
- Verificare dubla a datelor exportate (round-trip verification)
- Criptare AES-256-GCM pentru toate fisierele
- Stergere automata a fisierelor dupa 24 ore

CUM SE IMPORTA IN SAGA:
1. Deschide SAGA > Fisier > Import > Import extras de cont (sau Banca > Import extras bancar)
2. Selecteaza fisierul CSV descarcat din ExtrasContabil
3. Seteaza separatorul pe ";" (punct si virgula)
4. Verifica maparea coloanelor: Data=col1, Explicatie=col2, Debit=col3, Credit=col4, Document=col5
5. Selecteaza contul bancar corespunzator (ex: 5121 pentru cont curent RON)
6. Apasa Import

ABONAMENT:
- 500 RON / luna / firma de contabilitate
- Fisiere nelimitate
- 14 zile gratuit
- Anulare oricand din pagina Abonament

Raspunde intotdeauna in limba romana. Fii concis, prietenos si util. Daca nu stii raspunsul, spune-le utilizatorilor sa contacteze suportul.`;

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    const body = await request.json();
    const { message, history } = body;

    if (!message) {
      return NextResponse.json({ error: 'Mesajul este obligatoriu.' }, { status: 400 });
    }

    // Build messages for Claude API
    const messages = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: message });

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your-anthropic-api-key') {
      // Fallback response when API key not configured
      return NextResponse.json({
        response: getOfflineResponse(message),
      });
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      return NextResponse.json({
        response: getOfflineResponse(message),
      });
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData.content?.[0]?.type === 'text'
      ? claudeData.content[0].text
      : 'Ne pare rau, nu am putut genera un raspuns. Incercati din nou.';

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('Assistant error:', error);
    return NextResponse.json({
      response: 'A aparut o eroare. Va rugam incercati din nou sau contactati suportul.',
    });
  }
}

// Offline fallback responses based on keywords
function getOfflineResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('saga') && lower.includes('import')) {
    return 'Pentru a importa fisierul in SAGA:\n\n1. Deschide SAGA > Fisier > Import > Import extras de cont\n2. Selecteaza fisierul CSV descarcat\n3. Seteaza separatorul pe ";" (punct si virgula)\n4. Verifica maparea coloanelor\n5. Selecteaza contul bancar (ex: 5121)\n6. Apasa Import';
  }
  if (lower.includes('format') || lower.includes('fisier') || lower.includes('suportat')) {
    return 'ExtrasContabil suporta urmatoarele formate:\n\n- CSV (de la BCR, BRD, Banca Transilvania, ING, Raiffeisen, CEC Bank, UniCredit, OTP Bank, Alpha Bank)\n- MT940 (format SWIFT, fisiere .sta)\n- CAMT.053 (ISO 20022 XML)\n\nAplicatia detecteaza automat banca si formatul, dar poti selecta manual daca doresti.';
  }
  if (lower.includes('edit') || lower.includes('modific')) {
    return 'Poti edita orice tranzactie in pagina de Previzualizare:\n\n1. Dupa incarcarea extrasului, vei fi redirectionat la Previzualizare\n2. Click pe butonul "Edit" de langa tranzactia dorita\n3. Modifica campurile (data, descriere, debit, credit, referinta)\n4. Apasa "Salv" pentru a salva modificarile\n\nPoti si sterge tranzactii cu butonul "X".';
  }
  if (lower.includes('export') && lower.includes('nu')) {
    return 'Exportul poate fi blocat daca exista erori critice de validare, in special:\n\n- Eroare de reconciliere sold (soldul initial + credite - debituri nu corespunde cu soldul final)\n- Erori structurale critice\n\nVerifica panoul de validare din pagina Previzualizare si corecteaza erorile marcate cu rosu.';
  }
  if (lower.includes('sold') || lower.includes('reconciliere') || lower.includes('balanta')) {
    return 'Eroarea de sold apare cand: Sold initial + Total credite - Total debituri ≠ Sold final\n\nAceasta inseamna ca unele tranzactii lipsesc sau au sume incorecte. Verificati:\n1. Ca nu au fost sterse tranzactii din previzualizare\n2. Ca sumele de debit si credit sunt corecte\n3. Ca fisierul original contine toate tranzactiile perioadei';
  }
  if (lower.includes('pret') || lower.includes('abonament') || lower.includes('cost')) {
    return 'ExtrasContabil costa 500 RON / luna / firma de contabilitate, cu:\n\n- Fisiere nelimitate\n- Toate cele 9 banci suportate\n- 14 zile gratuit la inregistrare\n- Anulare oricand\n\nAcceseaza pagina Abonament din meniu pentru a activa sau gestiona abonamentul.';
  }

  return 'Sunt asistentul ExtrasContabil! Te pot ajuta cu:\n\n- Cum sa importi fisierul in SAGA\n- Ce formate de fisiere sunt suportate\n- Cum sa editezi tranzactiile\n- De ce nu poti exporta\n- Informatii despre erori de validare\n- Detalii despre abonament\n\nCe doresti sa afli?';
}
