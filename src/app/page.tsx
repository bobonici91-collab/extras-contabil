'use client';

import { useState } from 'react';
import Link from 'next/link';

const FEATURES = [
  {
    icon: '\u{1F3E6}',
    title: '9 Banci Suportate',
    desc: 'BCR, BRD, Banca Transilvania, ING, Raiffeisen, CEC Bank, UniCredit, OTP Bank, Alpha Bank',
  },
  {
    icon: '\u{1F4C4}',
    title: 'Formate Multiple',
    desc: 'CSV, MT940 (SWIFT), CAMT.053 (ISO 20022 XML) cu detectie automata a formatului',
  },
  {
    icon: '\u2713',
    title: '5 Straturi de Validare',
    desc: 'Validare structurala, encoding, semantica, financiara cu reconciliere sold, verificari incrucisate',
  },
  {
    icon: '\u{1F512}',
    title: 'Securitate Maxima',
    desc: 'Criptare AES-256-GCM, stergere automata fisiere la 24h, audit trail complet',
  },
  {
    icon: '\u{1F916}',
    title: 'Asistent AI Integrat',
    desc: 'Chat AI care raspunde la intrebari despre functiile aplicatiei si te ghideaza pas cu pas',
  },
  {
    icon: '\u26A1',
    title: 'Export Instant SAGA',
    desc: 'Genereaza fisier CSV compatibil SAGA cu encoding Windows-1250, format romanesc, verificare dubla',
  },
];

const BANKS = [
  'BCR', 'BRD', 'Banca Transilvania', 'ING', 'Raiffeisen',
  'CEC Bank', 'UniCredit', 'OTP Bank', 'Alpha Bank',
];

export default function LandingPage() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              EC
            </div>
            <span className="text-xl font-bold text-gray-900">ExtrasContabil</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium">
              Autentificare
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Incepe Gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Converteste extrasele bancare<br />in format SAGA automat
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Economiseste ore intregi de munca manuala. Incarca extrasul de cont de la orice banca din Romania,
            verifica tranzactiile si exporta direct in format compatibil SAGA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-blue-700 px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-50 transition shadow-lg"
            >
              14 Zile Gratuit
            </Link>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="border-2 border-white/30 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-white/10 transition"
            >
              Vezi Cum Functioneaza
            </button>
          </div>

          {showDemo && (
            <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="text-3xl mb-3">1</div>
                  <h3 className="font-bold text-lg mb-2">Incarca Extrasul</h3>
                  <p className="text-blue-200 text-sm">
                    Trage fisierul CSV, MT940 sau XML in aplicatie. Formatul si banca sunt detectate automat.
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="text-3xl mb-3">2</div>
                  <h3 className="font-bold text-lg mb-2">Verifica si Editeaza</h3>
                  <p className="text-blue-200 text-sm">
                    Previzualizeaza tranzactiile intr-un tabel editabil. 5 straturi de validare verifica automat datele.
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="text-3xl mb-3">3</div>
                  <h3 className="font-bold text-lg mb-2">Exporta SAGA</h3>
                  <p className="text-blue-200 text-sm">
                    Descarca fisierul compatibil SAGA cu un click. Encoding Windows-1250, format romanesc, verificat dublu.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Banks */}
      <section className="py-12 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-500 mb-6 font-medium">Suportam extrase de la toate bancile majore din Romania</p>
          <div className="flex flex-wrap justify-center gap-6">
            {BANKS.map(bank => (
              <div key={bank} className="bg-gray-50 px-5 py-3 rounded-lg text-gray-700 font-medium border">
                {bank}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">De ce ExtrasContabil?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Pret Simplu si Transparent</h2>
          <p className="text-center text-gray-500 mb-12">Un singur plan, fara surprize, fara limite</p>

          <div className="max-w-md mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
            <div className="text-center mb-6">
              <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Plan Standard</span>
            </div>
            <div className="text-center mb-6">
              <span className="text-5xl font-bold">500</span>
              <span className="text-xl ml-1">RON</span>
              <span className="text-blue-200 block">/ luna / firma de contabilitate</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Fisiere nelimitate — fara restrictii',
                'Toate cele 9 banci suportate',
                'Export SAGA nelimitat',
                'Asistent AI integrat',
                'Validare avansata cu reconciliere sold',
                'Criptare AES-256 si securitate maxima',
                'Suport prioritar',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">&#10003;</span>
                  <span className="text-blue-100">{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block w-full bg-white text-blue-700 text-center py-3 rounded-lg font-bold text-lg hover:bg-blue-50 transition"
            >
              Incepe cu 14 Zile Gratuit
            </Link>
            <p className="text-center text-blue-200 text-sm mt-3">
              Nu necesita card pentru perioada de proba
            </p>
          </div>
        </div>
      </section>

      {/* SAGA Import Instructions */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Cum import fisierul in SAGA?</h2>
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <div className="space-y-6">
              <StepItem num={1} title="Descarca fisierul din ExtrasContabil">
                Dupa ce ai verificat tranzactiile, apasa butonul &quot;Descarca Fisier SAGA&quot;. Fisierul va fi salvat
                pe calculatorul tau in format CSV cu encoding Windows-1250.
              </StepItem>
              <StepItem num={2} title="Deschide SAGA">
                In SAGA, navigheaza la meniul <strong>Fisier &rarr; Import &rarr; Import extras de cont</strong> sau
                <strong> Banca &rarr; Import extras bancar</strong> (depinde de versiunea SAGA).
              </StepItem>
              <StepItem num={3} title="Selecteaza fisierul">
                In fereastra de import, apasa &quot;Selecteaza fisier&quot; si alege fisierul CSV descarcat din ExtrasContabil.
                Asigura-te ca separatorul este setat pe &quot;;&quot; (punct si virgula).
              </StepItem>
              <StepItem num={4} title="Verifica maparea coloanelor">
                SAGA va afisa previzualizarea datelor. Verifica ca coloana &quot;Data&quot; este mapata corect (format DD.MM.YYYY),
                &quot;Explicatie&quot; contine descrierea, iar &quot;Debit&quot; si &quot;Credit&quot; contin sumele corecte.
              </StepItem>
              <StepItem num={5} title="Importa si verifica">
                Apasa &quot;Import&quot; si verifica in SAGA ca soldul final corespunde cu extrasul bancar.
                ExtrasContabil a verificat deja aceste date, deci nu ar trebui sa existe diferente.
              </StepItem>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                EC
              </div>
              <span className="text-white font-bold">ExtrasContabil</span>
            </div>
            <p className="text-sm">
              &copy; {new Date().getFullYear()} ExtrasContabil. Toate drepturile rezervate.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepItem({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <div>
        <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-600 text-sm">{children}</p>
      </div>
    </div>
  );
}
