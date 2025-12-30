import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Droplets, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  History, 
  Settings, 
  Plus, 
  ArrowRight, 
  Beaker, 
  Info,
  ChevronLeft,
  Trash2,
  Minus,
  Eye,
  Pencil,
  CheckSquare,
  Square,
  X,
  Waves,
  Share2,
  BookOpen,
  ShieldAlert
} from 'lucide-react';

// --- ARQUITETURA DE DADOS (MODELO) ---

type UnitSystem = 'metric' | 'imperial'; // Focaremos em metric (litros/gramas) por enquanto
type PoolShape = 'rectangular' | 'round' | 'custom';
type PoolType = 'pool' | 'spa';
type CoatingType = 'tile' | 'fiberglass' | 'vinyl';
type ChlorineType = 'granulate' | 'tablet';

interface Pool {
  id: string;
  name: string;
  volume: number; // em litros
  shape: PoolShape;
  type: PoolType;
  coating: CoatingType;
  chlorineType?: ChlorineType; // Opcional para manter compatibilidade com dados antigos
}

interface Measurements {
  ph: number | null;
  chlorine: number | null; // ppm
  alkalinity: number | null; // ppm
  hardness: number | null; // ppm
  cyanuric: number | null; // ppm
}

interface VisualState {
  appearance: 'clear' | 'cloudy' | 'green' | 'brown' | 'algae';
  strongSmell: boolean;
  heavyUsage: boolean;
}

interface TreatmentStep {
  order: number;
  title: string;
  product: string;
  dose: number;
  unit: string;
  instruction: string;
  waitDuration: string;
}

interface TreatmentResult {
  id: string;
  date: string;
  status: 'ok' | 'warning' | 'critical';
  summary: string;
  steps: TreatmentStep[];
  measurements: Measurements;
  visual: VisualState;
}

// --- MOTOR DE CÁLCULO (SERVICES) ---

const calculateTreatment = (
  pool: Pool, 
  measurements: Measurements, 
  visual: VisualState,
  previousMeasurements?: Measurements | null, // Novo parâmetro para contexto histórico
  existingId?: string // Para manter o ID ao editar
): TreatmentResult => {
  const steps: TreatmentStep[] = [];
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  let orderCounter = 1;

  // Constantes de Alvo (simplificado para MVP)
  const TARGET = {
    PH_MIN: 7.2, PH_MAX: 7.6, PH_IDEAL: 7.4,
    ALK_MIN: 80, ALK_MAX: 120, ALK_IDEAL: 100,
    CL_MIN: 1, CL_MAX: 3, CL_IDEAL: 2,
    HARD_MIN: 200, HARD_MAX: 400, HARD_IDEAL: 300
  };

  // --- LÓGICA DE PERSISTÊNCIA (Contexto Histórico) ---
  if (previousMeasurements) {
    // Verificar pH travado
    if (measurements.ph !== null && previousMeasurements.ph !== null) {
      if (previousMeasurements.ph < TARGET.PH_MIN && measurements.ph < TARGET.PH_MIN) {
        // Estava baixo, continua baixo
        steps.push({
          order: orderCounter++,
          title: 'Atenção: pH Continua Baixo',
          product: 'Verificar Produto / Dosagem',
          dose: 0,
          unit: '-',
          instruction: 'Seu pH estava baixo na última análise e não subiu. Verifique se o produto (Barrilha) está vencido ou se a Alcalinidade está travando o pH.',
          waitDuration: '-'
        });
      } else if (previousMeasurements.ph > TARGET.PH_MAX && measurements.ph > TARGET.PH_MAX) {
        steps.push({
          order: orderCounter++,
          title: 'Atenção: pH Continua Alto',
          product: 'Atenção na Aplicação',
          dose: 0,
          unit: '-',
          instruction: 'O pH não baixou desde a última medição. Certifique-se de que a dose anterior foi aplicada corretamente.',
          waitDuration: '-'
        });
      }
    }

    // Verificar Cloro zerado persistente
    if (measurements.chlorine !== null && previousMeasurements.chlorine !== null) {
      if (previousMeasurements.chlorine < 0.5 && measurements.chlorine < 0.5) {
        steps.push({
          order: orderCounter++,
          title: 'Atenção: Cloro sendo consumido rápido',
          product: 'Investigação',
          dose: 0,
          unit: '-',
          instruction: 'O cloro está zerando muito rápido. Isso pode indicar contaminação orgânica forte ou excesso de estabilizante (Ácido Cianúrico). Considere um choque mais forte.',
          waitDuration: '-'
        });
      }
    }
  }

  // Lógica 1: Alcalinidade (Sempre ajuste primeiro pois segura o pH)
  if (measurements.alkalinity !== null) {
    if (measurements.alkalinity < TARGET.ALK_MIN) {
      status = 'warning';
      // Regra aprox: 17g de Bicarbonato aumentam 10ppm em 1000L
      const delta = TARGET.ALK_IDEAL - measurements.alkalinity;
      const factor = 1.7; 
      const dose = (delta * factor * pool.volume) / 1000;
      
      steps.push({
        order: orderCounter++,
        title: 'Ajustar Alcalinidade Baixa',
        product: 'Elevador de Alcalinidade (Bicarbonato)',
        dose: Math.round(dose),
        unit: 'g',
        instruction: 'Dissolva em um balde com água da própria piscina e espalhe pela superfície.',
        waitDuration: '6 horas filtrando'
      });
    } else if (measurements.alkalinity > TARGET.ALK_MAX) {
      status = 'warning';
      // Regra de Redução: Aprox 1.5ml de Redutor reduz 1ppm em 1000L (Média de mercado)
      const delta = measurements.alkalinity - TARGET.ALK_IDEAL;
      const factor = 1.5;
      const dose = (delta * factor * pool.volume) / 1000;

      steps.push({
        order: orderCounter++,
        title: 'Baixar Alcalinidade',
        product: 'Redutor de pH e Alcalinidade (Líquido)',
        dose: Math.round(dose),
        unit: 'ml',
        instruction: 'A alcalinidade está alta. Dilua o redutor em um balde com água e distribua pelas bordas da piscina. Isso também ajudará a baixar o pH.',
        waitDuration: '6 horas circulando'
      });
    }
  }

  // Lógica 2: pH
  if (measurements.ph !== null) {
    if (measurements.ph < TARGET.PH_MIN) {
      // Só ajusta pH se não tiver ajustado alcalinidade na mesma vez (geralmente)
      // Mas para simplificar o app, daremos a instrução sequencial
      const delta = TARGET.PH_IDEAL - measurements.ph;
      // Regra aprox: 10g de Barrilha aumentam 0.1 em 1000L (muito variável, mas usado como estimativa)
      const dose = (delta * 100 * pool.volume) / 1000; 
      
      steps.push({
        order: orderCounter++,
        title: 'Elevar pH',
        product: 'Barrilha Leve (Elevador de pH)',
        dose: Math.round(dose),
        unit: 'g',
        instruction: 'O pH está ácido. Dissolva previamente e distribua na piscina.',
        waitDuration: '1 hora circulando'
      });
      if (status === 'ok') status = 'warning';
    } else if (measurements.ph > TARGET.PH_MAX) {
      // Regra Redução pH: ~10ml por m3 baixa 0.1 de pH
      const delta = measurements.ph - TARGET.PH_IDEAL;
      // Ex: pH 8.0 (delta 0.6) em 10m3 -> (0.6/0.1) * 10ml * 10 = 600ml
      const dose = (delta / 0.1) * 10 * (pool.volume / 1000);

      steps.push({
        order: orderCounter++,
        title: 'Reduzir pH',
        product: 'Redutor de pH (Líquido)',
        dose: Math.round(dose),
        unit: 'ml',
        instruction: 'O pH está alto. Dilua o redutor em um balde e aplique.',
        waitDuration: '1 hora circulando'
      });
      if (status === 'ok') status = 'warning';
    }
  }

  // Lógica 3: Dureza Cálcica
  if (measurements.hardness !== null) {
    if (measurements.hardness < TARGET.HARD_MIN) {
      status = 'warning';
      const delta = TARGET.HARD_IDEAL - measurements.hardness;
      // Aprox 15g de Cloreto de Cálcio aumentam 10ppm em 1000L => 1.5g por ppm
      const dose = (delta * 1.5 * pool.volume) / 1000;

      steps.push({
        order: orderCounter++,
        title: 'Ajustar Dureza Cálcica',
        product: 'Elevador de Dureza (Cloreto de Cálcio)',
        dose: Math.round(dose),
        unit: 'g',
        instruction: 'A dureza está baixa, o que pode corroer equipamentos e rejuntes. Dissolva e aplique.',
        waitDuration: '2 a 4 horas circulando'
      });
    } else if (measurements.hardness > TARGET.HARD_MAX) {
      if (status === 'ok') status = 'warning';
      steps.push({
        order: orderCounter++,
        title: 'Dureza Cálcica Alta',
        product: 'Substituição de Água',
        dose: 0,
        unit: '-',
        instruction: 'A dureza está muito alta. A única forma eficaz de reduzir é drenando parte da água e reabastecendo com água nova.',
        waitDuration: '-'
      });
    }
  }

  // Lógica 4: Sanitização (Cloro) e Aspecto Visual
  const isGreen = visual.appearance === 'green' || visual.appearance === 'algae';
  const isCloudy = visual.appearance === 'cloudy';

  if (isGreen) {
    status = 'critical';
    // Supercloração (Choque) - aprox 14g/m3
    // OBS: Mesmo se o usuário prefere pastilha, água verde exige choque (granulado), pois pastilha é lenta.
    const shockDose = (14 * pool.volume) / 1000;
    
    steps.push({
      order: orderCounter++,
      title: 'Choque (Água Verde)',
      product: 'Cloro Granulado ou de Choque',
      dose: Math.round(shockDose),
      unit: 'g',
      instruction: 'Sua piscina tem algas. O tratamento exige cloro de choque (granulado), pois pastilhas agem muito lentamente.',
      waitDuration: 'Filtrar por 8 a 12 horas'
    });

    // Algicida de Choque - aprox 6ml/m3
    const algicideDose = (6 * pool.volume) / 1000;
    steps.push({
      order: orderCounter++,
      title: 'Aplicar Algicida',
      product: 'Algicida de Choque',
      dose: Math.round(algicideDose),
      unit: 'ml',
      instruction: 'Aplique 1 hora após o cloro. Escove as paredes da piscina.',
      waitDuration: 'Filtrar junto com o cloro'
    });

  } else if (isCloudy) {
    if (status === 'ok') status = 'warning';
    steps.push({
      order: orderCounter++,
      title: 'Clarificar Água',
      product: 'Clarificante / Floculante',
      dose: Math.round((4 * pool.volume) / 1000), // 4ml/m3 estimado
      unit: 'ml',
      instruction: 'A água está turva. Use clarificante e deixe filtrar.',
      waitDuration: '6 a 8 horas'
    });
  }

  // Cloro de Manutenção (se não for choque)
  if (!isGreen && measurements.chlorine !== null) {
    if (measurements.chlorine < TARGET.CL_MIN) {
      
      const preferredType = pool.chlorineType || 'granulate';
      
      // Se preferir pastilha E não for um caso de emergência (cloro zerado pode exigir choque, mas vamos sugerir pastilha para manutenção)
      if (preferredType === 'tablet') {
        
        const isSmallPool = pool.volume <= 10000; // Corte de 10.000L para definir tamanho da pastilha
        let tabletCount = 0;
        let tabletName = "";
        let tabletWeight = 0;

        if (isSmallPool) {
          // Mini pastilhas de 20g. Aprox 1 para cada 2.000L
          tabletWeight = 20;
          tabletCount = Math.max(1, Math.ceil(pool.volume / 2000));
          tabletName = "Mini Pastilha (20g)";
        } else {
          // Pastilhas grandes de 200g. Aprox 1 para cada 30.000L
          tabletWeight = 200;
          tabletCount = Math.max(1, Math.ceil(pool.volume / 30000));
          tabletName = "Pastilha Grande (200g)";
        }

        steps.push({
          order: orderCounter++,
          title: 'Repor Cloro (Pastilha)',
          product: `Cloro ${tabletName}`,
          dose: tabletCount,
          unit: 'unidade(s)',
          instruction: 'Coloque a pastilha dentro do flutuador ou no cesto do skimmer. Nunca jogue diretamente no fundo (mancha o revestimento).',
          waitDuration: 'Acompanhar dissolução semanalmente'
        });

      } else {
        // Lógica tradicional (Granulado)
        const delta = TARGET.CL_IDEAL - measurements.chlorine;
        // Aprox 4g/m3 para subir 1ppm (Dicloro)
        const dose = (delta * 4 * pool.volume) / 1000;
        
        steps.push({
          order: orderCounter++,
          title: 'Repor Cloro',
          product: 'Cloro Granulado',
          dose: Math.round(dose),
          unit: 'g',
          instruction: 'Nível de proteção baixo. Reajuste o cloro.',
          waitDuration: '1 hora após aplicação'
        });
      }

      if (status === 'ok') status = 'warning';
    }
  }

  let summary = "Sua água está equilibrada e pronta para uso!";
  if (status === 'critical') summary = "Atenção: Condições críticas. Não utilize a piscina até tratar.";
  else if (status === 'warning') summary = "A água precisa de alguns ajustes para ficar ideal.";

  return {
    id: existingId || Date.now().toString(),
    date: existingId ? new Date().toISOString() : new Date().toISOString(), // Em um app real, manteria a data original se não quisesse atualizar o timestamp
    status,
    summary,
    steps,
    measurements,
    visual
  };
};

// --- COMPONENTES UI (DESIGN SYSTEM REFINADO) ---

// Cores baseadas na logo: Ciano (#00C2FF) a Azul Escuro (#005580)
const BRAND_GRADIENT = "bg-gradient-to-br from-cyan-500 to-sky-700";
const BRAND_GRADIENT_HOVER = "hover:from-cyan-600 hover:to-sky-800";
const BRAND_TEXT = "text-sky-800";

const Button = ({ onClick, variant = 'primary', children, className = '', fullWidth = false }: any) => {
  const base = "px-6 py-4 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] text-sm tracking-wide flex justify-center items-center gap-2";
  const styles = {
    primary: `${BRAND_GRADIENT} ${BRAND_GRADIENT_HOVER} text-white shadow-sky-200/50`,
    secondary: "bg-white text-sky-700 border border-sky-100 hover:bg-sky-50",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-slate-300 bg-transparent"
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`${base} ${styles[variant as keyof typeof styles]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const InputGroup = ({ label, suffix, value, onChange, placeholder, type = "number" }: any) => (
  <div className="mb-5">
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
    <div className="relative group">
      <input
        type={type}
        className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none transition-all font-semibold text-slate-700 group-hover:bg-white"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix && (
        <span className="absolute right-4 top-4 text-slate-400 text-sm font-bold">{suffix}</span>
      )}
    </div>
  </div>
);

// --- TELAS DO APP ---

// 1. Onboarding (Atualizado com Logo)
const Onboarding = ({ onFinish }: { onFinish: () => void }) => (
  <div className={`flex flex-col h-screen ${BRAND_GRADIENT} text-white p-8 justify-between relative overflow-hidden`}>
    {/* Efeito de fundo (ondas) */}
    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
       <div className="absolute -top-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
       <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-300 rounded-full blur-3xl"></div>
    </div>

    <div className="mt-12 relative z-10 flex flex-col items-center text-center">
      <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-sky-900/20 mb-8 animate-in zoom-in duration-500">
        {/* Placeholder para a logo. O usuário deve substituir src por sua imagem real */}
        <div className="w-32 h-32 relative flex items-center justify-center overflow-hidden">
          {/* Fallback caso a imagem não carregue, mostramos um ícone estilizado */}
          <img 
            src="logo.png" 
            alt="PoolSense Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.classList.add('bg-sky-100');
              const icon = document.createElement('div');
              icon.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
              e.currentTarget.parentElement!.appendChild(icon);
            }}
          />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-3 tracking-tight">PoolSense</h1>
      <p className="text-sky-100 text-lg font-medium max-w-xs mx-auto">
        Água Perfeita, Fácil e Rápido
      </p>
    </div>
    
    <div className="space-y-3 mb-8 relative z-10">
      <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
        <div className="bg-white/20 p-2 rounded-full"><CheckCircle className="text-cyan-300" size={20} /></div>
        <span className="font-semibold text-white/90">Dosagem precisa</span>
      </div>
      <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
        <div className="bg-white/20 p-2 rounded-full"><Waves className="text-cyan-300" size={20} /></div>
        <span className="font-semibold text-white/90">Água sempre cristalina</span>
      </div>
    </div>

    <button 
      onClick={onFinish}
      className="w-full bg-white text-sky-700 py-5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-sky-50 transition-all relative z-10"
    >
      Começar
    </button>
  </div>
);

// 2. Setup Piscina
const PoolSetup = ({ onSave }: { onSave: (pool: Pool) => void }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState<PoolType>('pool');
  const [shape, setShape] = useState<PoolShape>('rectangular');
  const [dims, setDims] = useState({ length: '', width: '', depth: '', diameter: '' });
  const [manualVolume, setManualVolume] = useState('');
  const [calcMode, setCalcMode] = useState<'dimensions' | 'manual'>('dimensions');
  const [coating, setCoating] = useState<CoatingType>('tile');
  const [chlorineType, setChlorineType] = useState<ChlorineType>('granulate');

  const calculateVolume = () => {
    if (calcMode === 'manual') return parseFloat(manualVolume);
    
    // M3 to Liters = * 1000
    if (shape === 'rectangular') {
      return (parseFloat(dims.length) * parseFloat(dims.width) * parseFloat(dims.depth)) * 1000;
    } else if (shape === 'round') {
      const radius = parseFloat(dims.diameter) / 2;
      // PI * r^2 * depth
      return (Math.PI * Math.pow(radius, 2) * parseFloat(dims.depth)) * 1000;
    }
    return 0;
  };

  const handleFinish = () => {
    const vol = calculateVolume();
    if (vol <= 0 || isNaN(vol)) {
      alert("Por favor, preencha as medidas corretamente para calcular o volume.");
      return;
    }
    
    onSave({
      id: Date.now().toString(),
      name: name || 'Minha Piscina',
      volume: Math.round(vol),
      type,
      shape,
      coating,
      chlorineType
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-6 pt-12 pb-4 rounded-b-3xl shadow-sm z-10">
        <h2 className={`text-2xl font-extrabold ${BRAND_TEXT}`}>Configurar Piscina</h2>
        <div className="flex gap-2 mt-4">
           <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-sky-500' : 'bg-slate-200'}`}></div>
           <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-sky-500' : 'bg-slate-200'}`}></div>
        </div>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto">
      {step === 1 && (
        <div className="space-y-6 fade-in">
          <InputGroup label="Nome da Piscina" placeholder="Ex: Piscina de Casa" value={name} onChange={setName} type="text" />
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Tipo</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setType('pool')}
                className={`p-4 rounded-2xl border-2 font-bold transition-all ${type === 'pool' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md' : 'border-slate-100 bg-white text-slate-400'}`}
              >
                Piscina
              </button>
              <button 
                onClick={() => setType('spa')}
                className={`p-4 rounded-2xl border-2 font-bold transition-all ${type === 'spa' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md' : 'border-slate-100 bg-white text-slate-400'}`}
              >
                Spa / Jacuzzi
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Revestimento</label>
            <select 
              className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-sky-400 outline-none"
              value={coating}
              onChange={(e) => setCoating(e.target.value as CoatingType)}
            >
              <option value="tile">Azulejo / Pastilha</option>
              <option value="vinyl">Vinil</option>
              <option value="fiberglass">Fibra</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Cloro Preferido</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setChlorineType('granulate')}
                className={`p-3 rounded-2xl border-2 font-semibold text-sm transition-all ${chlorineType === 'granulate' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}
              >
                Granulado
              </button>
              <button 
                onClick={() => setChlorineType('tablet')}
                className={`p-3 rounded-2xl border-2 font-semibold text-sm transition-all ${chlorineType === 'tablet' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}
              >
                Pastilha
              </button>
            </div>
          </div>

          <Button fullWidth onClick={() => setStep(2)}>Continuar</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 fade-in">
          <div className="flex bg-white p-1 rounded-xl mb-6 shadow-sm border border-slate-100">
            <button 
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${calcMode === 'dimensions' ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`}
              onClick={() => setCalcMode('dimensions')}
            >
              Por Medidas
            </button>
            <button 
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${calcMode === 'manual' ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`}
              onClick={() => setCalcMode('manual')}
            >
              Volume Direto
            </button>
          </div>

          {calcMode === 'manual' ? (
            <InputGroup label="Volume Total (Litros)" placeholder="Ex: 20000" suffix="L" value={manualVolume} onChange={setManualVolume} />
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Formato</label>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button onClick={() => setShape('rectangular')} className={`p-4 rounded-2xl border-2 font-bold transition-all ${shape === 'rectangular' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}>Retangular</button>
                  <button onClick={() => setShape('round')} className={`p-4 rounded-2xl border-2 font-bold transition-all ${shape === 'round' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}>Redonda</button>
                </div>
              </div>

              {shape === 'rectangular' ? (
                <>
                  <InputGroup label="Comprimento" suffix="m" value={dims.length} onChange={(v:string) => setDims({...dims, length: v})} />
                  <InputGroup label="Largura" suffix="m" value={dims.width} onChange={(v:string) => setDims({...dims, width: v})} />
                </>
              ) : (
                <InputGroup label="Diâmetro" suffix="m" value={dims.diameter} onChange={(v:string) => setDims({...dims, diameter: v})} />
              )}
              <InputGroup label="Profundidade Média" suffix="m" value={dims.depth} onChange={(v:string) => setDims({...dims, depth: v})} />
            </>
          )}

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
            <Button onClick={handleFinish} className="flex-1">Salvar</Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// 3. Wizard de Análise
const AnalysisWizard = ({ 
  pool, 
  onComplete, 
  onCancel, 
  history, 
  initialResult 
}: { 
  pool: Pool, 
  onComplete: (res: TreatmentResult) => void, 
  onCancel: () => void, 
  history: TreatmentResult[],
  initialResult?: TreatmentResult | null
}) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Measurements>({ ph: null, chlorine: null, alkalinity: null, hardness: null, cyanuric: null });
  const [visual, setVisual] = useState<VisualState>({ appearance: 'clear', strongSmell: false, heavyUsage: false });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Preenche dados se for edição
  useEffect(() => {
    if (initialResult) {
      setData(initialResult.measurements);
      setVisual(initialResult.visual);
    }
  }, [initialResult]);

  const updateData = (field: keyof Measurements, val: string) => {
    setData(prev => ({ ...prev, [field]: val === '' ? null : parseFloat(val) }));
  };

  const handleCalculate = () => {
    let previousMeasurement = null;
    if (!initialResult && history.length > 0) {
      previousMeasurement = history[0].measurements;
    }

    const result = calculateTreatment(
      pool, 
      data, 
      visual, 
      previousMeasurement,
      initialResult?.id // Passa o ID se for edição para manter o mesmo
    );
    onComplete(result);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-4 pt-10 border-b border-slate-100 sticky top-0 z-10 flex items-center justify-between shadow-sm rounded-b-3xl">
         <button onClick={onCancel} className="p-3 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft /></button>
         <span className={`font-bold text-lg ${BRAND_TEXT}`}>{initialResult ? 'Editar Análise' : 'Nova Análise'}</span>
         <div className="w-10"></div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {step === 1 && (
          <div className="space-y-6 animate-in">
            <div className="bg-white p-6 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
              <h3 className={`text-xl font-bold ${BRAND_TEXT} mb-1`}>Química da Água</h3>
              <p className="text-sm text-slate-400 mb-6">Insira os valores do kit de teste.</p>

              <InputGroup label="pH Atual" placeholder="Ideal: 7.2 - 7.6" value={data.ph || ''} onChange={(v:string) => updateData('ph', v)} />
              <InputGroup label="Cloro Livre" suffix="ppm" placeholder="Ideal: 1 - 3" value={data.chlorine || ''} onChange={(v:string) => updateData('chlorine', v)} />
              <InputGroup label="Alcalinidade" suffix="ppm" placeholder="Ideal: 80 - 120" value={data.alkalinity || ''} onChange={(v:string) => updateData('alkalinity', v)} />
              <InputGroup label="Dureza Cálcica" suffix="ppm" placeholder="Ideal: 200 - 400" value={data.hardness || ''} onChange={(v:string) => updateData('hardness', v)} />
              
              <div className="pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sky-500 text-sm font-bold flex items-center gap-1 hover:text-sky-700 py-2"
                >
                  {showAdvanced ? <Minus size={16} /> : <Plus size={16} />} {showAdvanced ? 'Menos opções' : 'Mais opções (Cianúrico)'}
                </button>
              </div>

              {showAdvanced && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <InputGroup label="Ácido Cianúrico" suffix="ppm" placeholder="Ideal: 30 - 50" value={data.cyanuric || ''} onChange={(v:string) => updateData('cyanuric', v)} />
                </div>
              )}
            </div>

            <Button fullWidth onClick={() => setStep(2)}>Avançar <ArrowRight size={18} className="inline ml-2"/></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in">
             <div className="bg-white p-6 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
                <h3 className={`text-xl font-bold ${BRAND_TEXT} mb-4`}>Aspecto Visual</h3>
                
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">Cor da Água</label>
                <div className="space-y-3">
                  {[
                    { id: 'clear', label: 'Cristalina', color: 'bg-sky-50 text-sky-700 border-sky-200' },
                    { id: 'cloudy', label: 'Turva / Branca', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { id: 'green', label: 'Esverdeada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { id: 'algae', label: 'Com algas (Limo)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                    { id: 'brown', label: 'Marrom / Terra', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setVisual({ ...visual, appearance: opt.id as any })}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all font-semibold ${visual.appearance === opt.id ? `ring-2 ring-sky-400 ring-offset-1 ${opt.color}` : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center justify-between">
                        {opt.label}
                        {visual.appearance === opt.id && <CheckCircle size={18} />}
                      </div>
                    </button>
                  ))}
                </div>
             </div>

             <div className="bg-white p-6 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 space-y-4">
                <label className="flex items-center gap-4 p-2 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors">
                  <input type="checkbox" className="w-6 h-6 text-sky-500 rounded-lg border-gray-300 focus:ring-sky-400" checked={visual.strongSmell} onChange={e => setVisual({...visual, strongSmell: e.target.checked})} />
                  <span className="text-slate-700 font-bold">Cheiro forte de cloro?</span>
                </label>
                <label className="flex items-center gap-4 p-2 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors">
                  <input type="checkbox" className="w-6 h-6 text-sky-500 rounded-lg border-gray-300 focus:ring-sky-400" checked={visual.heavyUsage} onChange={e => setVisual({...visual, heavyUsage: e.target.checked})} />
                  <span className="text-slate-700 font-bold">Uso intenso em 24h?</span>
                </label>
             </div>

             <Button fullWidth onClick={handleCalculate} className="shadow-sky-300/50">
               {initialResult ? 'Salvar Alterações' : 'Gerar Tratamento'}
             </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. Tela de Resultado
const ResultScreen = ({ result, onClose, onEdit }: { result: TreatmentResult, onClose: () => void, onEdit: () => void }) => {
  const handleShare = async () => {
    const text = `
🌊 *Resultado PoolSense - ${new Date(result.date).toLocaleDateString('pt-BR')}*
Status: ${result.status === 'ok' ? '✅ Água Equilibrada' : result.status === 'warning' ? '⚠️ Atenção Necessária' : '🚫 Crítico'}

*Produtos Necessários:*
${result.steps.map(s => s.dose > 0 ? `- ${s.title}: ${s.dose}${s.unit} de ${s.product}` : `- ${s.title}: Verifique ${s.product}`).join('\n')}

_Gerado por PoolSense App_
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tratamento de Piscina',
          text: text,
        });
      } catch (err) {
        console.error('Erro ao compartilhar', err);
      }
    } else {
      // Fallback: Copiar para área de transferência
      navigator.clipboard.writeText(text);
      alert('Texto copiado para a área de transferência!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Result */}
      <div className={`p-8 pb-16 rounded-b-[3rem] shadow-xl ${result.status === 'ok' ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : result.status === 'warning' ? 'bg-gradient-to-br from-amber-400 to-orange-600' : 'bg-gradient-to-br from-red-500 to-rose-700'}`}>
        <div className="flex justify-between items-center text-white mb-8">
          <button onClick={onClose} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all"><ChevronLeft /></button>
          <span className="font-bold tracking-wide opacity-90 text-sm uppercase">Relatório</span>
          <div className="flex gap-2">
             <button onClick={handleShare} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all" title="Compartilhar">
              <Share2 size={20} />
            </button>
            <button onClick={onEdit} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all" title="Editar dados">
              <Pencil size={20} />
            </button>
          </div>
        </div>
        <div className="text-center text-white">
          <div className="bg-white/25 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-inner border border-white/20">
            {result.status === 'ok' ? <CheckCircle size={48} className="drop-shadow-md" /> : result.status === 'warning' ? <AlertTriangle size={48} className="drop-shadow-md" /> : <XCircle size={48} className="drop-shadow-md" />}
          </div>
          <h2 className="text-3xl font-extrabold mb-3 tracking-tight">
            {result.status === 'ok' ? 'Água Perfeita!' : result.status === 'warning' ? 'Atenção' : 'Ação Imediata'}
          </h2>
          <p className="text-white/90 font-medium text-lg leading-relaxed max-w-xs mx-auto">{result.summary}</p>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-10 pb-10 z-10">
        {result.steps.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <p className="text-slate-600 text-lg font-medium">Nenhum produto químico necessário. Aproveite sua piscina!</p>
          </div>
        ) : (
          <div className="space-y-5">
             {result.steps.map((step, idx) => (
               <div key={idx} className="bg-white p-0 rounded-3xl shadow-lg shadow-slate-200/60 border border-slate-100 overflow-hidden">
                 {/* Card Header */}
                 <div className={`px-6 py-4 flex justify-between items-center ${step.dose === 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${step.dose === 0 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                     {step.dose === 0 ? 'Observação' : `Passo ${step.order}`}
                   </span>
                   {step.dose > 0 && <span className="text-xs font-bold text-slate-400">AGUARDAR: {step.waitDuration}</span>}
                 </div>
                 
                 <div className="p-6">
                    <h4 className={`font-bold text-xl mb-1 ${step.dose === 0 ? 'text-amber-800' : 'text-slate-800'}`}>{step.title}</h4>
                    <p className={`font-medium mb-4 ${step.dose === 0 ? 'text-amber-600' : 'text-sky-600'}`}>{step.product}</p>

                    {step.dose > 0 && (
                      <div className="flex items-baseline gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 inline-flex pr-6">
                        <span className="text-3xl font-extrabold text-slate-800">{step.dose}</span>
                        <span className="text-sm font-bold text-slate-500 uppercase">{step.unit}</span>
                      </div>
                    )}
                    
                    <div className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-2xl">
                      {step.instruction}
                    </div>
                 </div>
               </div>
             ))}
          </div>
        )}

        <div className="mt-8 bg-orange-50 p-5 rounded-3xl border border-orange-100 flex gap-4 items-start">
          <Info className="text-orange-500 shrink-0 mt-1" />
          <p className="text-orange-800 text-xs leading-relaxed font-medium">
            <strong>Segurança:</strong> Nunca misture produtos químicos. Adicione sempre o produto à água, nunca o contrário. Mantenha fora do alcance de crianças.
          </p>
        </div>
        
        <div className="h-6"></div>
        <Button fullWidth onClick={onClose} variant="secondary">Voltar ao Início</Button>
      </div>
    </div>
  );
};

// 5. Configurações e Referência (Nova Tela)
const SettingsScreen = ({ onClose, onDeleteData }: { onClose: () => void, onDeleteData: () => void }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <div className={`p-6 pt-12 rounded-b-[2rem] shadow-lg ${BRAND_GRADIENT} text-white mb-6`}>
         <div className="flex justify-between items-center mb-4">
           <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-md"><ChevronLeft /></button>
           <h2 className="text-xl font-bold">Configurações e Ajuda</h2>
           <div className="w-10"></div>
         </div>
         <p className="text-sky-100 text-center text-sm">Ajustes e Tabela de Referência</p>
       </div>

       <div className="px-6 space-y-6 flex-1 overflow-y-auto pb-10">
         <section>
           <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
             <BookOpen size={20} className="text-sky-500" />
             Parâmetros Ideais
           </h3>
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                 <tr>
                   <th className="px-4 py-3">Parâmetro</th>
                   <th className="px-4 py-3">Ideal</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 <tr><td className="px-4 py-3 font-medium text-slate-700">pH</td><td className="px-4 py-3 text-emerald-600 font-bold">7.2 - 7.6</td></tr>
                 <tr><td className="px-4 py-3 font-medium text-slate-700">Cloro Livre</td><td className="px-4 py-3 text-emerald-600 font-bold">1 - 3 ppm</td></tr>
                 <tr><td className="px-4 py-3 font-medium text-slate-700">Alcalinidade</td><td className="px-4 py-3 text-emerald-600 font-bold">80 - 120 ppm</td></tr>
                 <tr><td className="px-4 py-3 font-medium text-slate-700">Dureza Cálcica</td><td className="px-4 py-3 text-emerald-600 font-bold">200 - 400 ppm</td></tr>
                 <tr><td className="px-4 py-3 font-medium text-slate-700">Ác. Cianúrico</td><td className="px-4 py-3 text-emerald-600 font-bold">30 - 50 ppm</td></tr>
               </tbody>
             </table>
           </div>
           <p className="text-xs text-slate-400 mt-2 italic">Fonte: Associações de Tratamento de Piscinas (ABNT/APP).</p>
         </section>

         <section>
           <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
             <Settings size={20} className="text-slate-500" />
             Preferências
           </h3>
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex items-center justify-between py-2">
               <span className="text-slate-600 font-medium">Unidade de Volume</span>
               <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold">Litros / m³</span>
             </div>
             <div className="flex items-center justify-between py-2 border-t border-slate-50">
               <span className="text-slate-600 font-medium">Idioma</span>
               <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold">Português</span>
             </div>
           </div>
         </section>

         <section>
           <h3 className="text-red-600 font-bold mb-3 flex items-center gap-2">
             <ShieldAlert size={20} />
             Zona de Perigo
           </h3>
           <button 
             onClick={onDeleteData} 
             className="w-full flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 font-medium hover:bg-red-100 transition-colors"
           >
             <span>Apagar Piscina e Dados</span>
             <Trash2 size={18} />
           </button>
           <p className="text-xs text-red-400 mt-2">Esta ação não pode ser desfeita.</p>
         </section>
       </div>
    </div>
  );
};

// 6. Dashboard Principal
const Dashboard = ({ pool, onNewAnalysis, history, onDeletePool, onViewHistory, onDeleteHistoryItems, onClearHistory, onOpenSettings }: any) => {
  const lastTreatment = history.length > 0 ? history[0] : null;
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (confirm(`Excluir ${selectedIds.size} itens selecionados?`)) {
      onDeleteHistoryItems(Array.from(selectedIds));
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Curved Header */}
      <div className={`px-8 pt-12 pb-16 rounded-b-[3rem] shadow-xl ${BRAND_GRADIENT} text-white relative overflow-hidden`}>
         {/* Background Decoration */}
         <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
         <div className="absolute -left-10 bottom-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl"></div>

         <div className="relative z-10 flex justify-between items-start">
           <div>
             <p className="text-sky-100 text-sm font-medium mb-1">Bem-vindo(a) à</p>
             <h1 className="text-3xl font-extrabold tracking-tight">{pool.name}</h1>
           </div>
           
           <button 
            onClick={onOpenSettings}
            className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-lg hover:bg-white/30 transition-all text-white"
           >
             <Settings size={24} />
           </button>
         </div>

         {/* Volume Badge */}
         <div className="mt-4 inline-flex items-center gap-2 bg-black/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-xs font-bold text-white/90">{pool.volume / 1000}k Litros ({pool.type === 'pool' ? 'Piscina' : 'Spa'})</span>
         </div>
      </div>

      <main className="px-6 -mt-8 relative z-10 space-y-8">
        {/* Status Card */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-700">Status Atual</h3>
             {lastTreatment && (
               <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                 {new Date(lastTreatment.date).toLocaleDateString('pt-BR')}
               </span>
             )}
          </div>

          {lastTreatment ? (
            <div className="flex items-center gap-4">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lastTreatment.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : lastTreatment.status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                  {lastTreatment.status === 'ok' ? <CheckCircle size={28} /> : lastTreatment.status === 'warning' ? <AlertTriangle size={28} /> : <XCircle size={28} />}
               </div>
               <div>
                 <p className={`font-bold text-lg ${lastTreatment.status === 'ok' ? 'text-emerald-700' : lastTreatment.status === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>
                   {lastTreatment.status === 'ok' ? 'Água Equilibrada' : lastTreatment.status === 'warning' ? 'Requer Atenção' : 'Crítico'}
                 </p>
                 <p className="text-xs text-slate-400 font-medium">Toque no histórico para detalhes</p>
               </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Nenhuma análise registrada.</p>
          )}

          <div className="mt-6">
            <button 
              onClick={onNewAnalysis}
              className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg shadow-sky-200/50 flex items-center justify-center gap-3 transition-transform active:scale-95 ${BRAND_GRADIENT}`}
            >
              <Plus size={24} className="text-white" />
              Nova Análise
            </button>
          </div>
        </div>

        {/* History Section */}
        <section>
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className={`font-bold text-lg ${BRAND_TEXT}`}>Histórico</h3>
            <div className="flex gap-2">
              {history.length > 0 && !isSelectionMode && (
                <button 
                  onClick={() => setIsSelectionMode(true)}
                  className="text-xs text-sky-600 font-bold bg-sky-50 px-4 py-2 rounded-full hover:bg-sky-100 transition-colors"
                >
                  Gerenciar
                </button>
              )}
              {isSelectionMode && (
                <button 
                  onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                  className="text-xs text-slate-500 font-bold bg-slate-200 px-4 py-2 rounded-full hover:bg-slate-300 transition-colors"
                >
                  Pronto
                </button>
              )}
            </div>
          </div>
          
          {isSelectionMode && (
            <div className="mb-4 flex gap-3 animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="flex-1 bg-red-50 text-red-600 text-xs font-bold py-3 px-4 rounded-2xl border border-red-100 disabled:opacity-50 shadow-sm"
              >
                Excluir ({selectedIds.size})
              </button>
              <button 
                onClick={onClearHistory}
                className="flex-1 bg-white text-slate-600 text-xs font-bold py-3 px-4 rounded-2xl border border-slate-200 shadow-sm"
              >
                Limpar Tudo
              </button>
            </div>
          )}

          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 border-dashed">
                <History className="mx-auto mb-3 text-slate-300" size={32} />
                <p className="text-slate-400 font-medium">Seu histórico aparecerá aqui</p>
              </div>
            ) : (
              history.slice(0, isSelectionMode ? undefined : 5).map((item: TreatmentResult) => (
                <div key={item.id} className="relative flex items-center group">
                  {isSelectionMode && (
                    <button 
                      onClick={() => toggleSelection(item.id)}
                      className="mr-3 p-2 text-slate-300 hover:text-sky-500 transition-colors"
                    >
                      {selectedIds.has(item.id) ? (
                        <CheckSquare className="text-sky-500" size={24} />
                      ) : (
                        <Square size={24} />
                      )}
                    </button>
                  )}
                  <button 
                    onClick={() => !isSelectionMode && onViewHistory(item)}
                    disabled={isSelectionMode}
                    className="flex-1 bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                  >
                     <div className="flex gap-4 items-center">
                       <div className={`w-2 h-12 rounded-full ${item.status === 'ok' ? 'bg-emerald-400' : item.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                       <div className="text-left">
                         <p className="font-bold text-slate-700 text-lg">{new Date(item.date).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</p>
                         <p className="text-xs font-semibold text-slate-400">{item.steps.length} {item.steps.length === 1 ? 'passo' : 'passos'} indicados</p>
                       </div>
                     </div>
                     <div className="text-right flex items-center gap-3">
                       {!isSelectionMode && <div className="bg-slate-50 p-2 rounded-full"><Eye size={18} className="text-slate-300 group-hover:text-sky-500 transition-colors" /></div>}
                     </div>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

// --- APP PRINCIPAL ---

const App = () => {
  const [screen, setScreen] = useState<'onboarding' | 'setup' | 'dashboard' | 'wizard' | 'result' | 'settings'>('onboarding');
  const [pool, setPool] = useState<Pool | null>(null);
  const [history, setHistory] = useState<TreatmentResult[]>([]);
  const [currentResult, setCurrentResult] = useState<TreatmentResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Carregar dados locais ao iniciar
  useEffect(() => {
    const savedPool = localStorage.getItem('poolsense_pool');
    const savedHistory = localStorage.getItem('poolsense_history');
    
    if (savedPool) {
      setPool(JSON.parse(savedPool));
      setScreen('dashboard');
    }
    
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const handlePoolSave = (newPool: Pool) => {
    setPool(newPool);
    localStorage.setItem('poolsense_pool', JSON.stringify(newPool));
    setScreen('dashboard');
  };

  const handleAnalysisComplete = (result: TreatmentResult) => {
    // Verifica se já existe (Edição)
    const existingIndex = history.findIndex(h => h.id === result.id);
    
    let newHistory;
    if (existingIndex >= 0) {
      // Atualiza existente
      newHistory = [...history];
      newHistory[existingIndex] = result;
    } else {
      // Cria novo
      newHistory = [result, ...history];
    }

    setHistory(newHistory);
    localStorage.setItem('poolsense_history', JSON.stringify(newHistory));
    setCurrentResult(result);
    setIsEditing(false);
    setScreen('result');
  };

  const handleViewHistory = (result: TreatmentResult) => {
    setCurrentResult(result);
    setScreen('result');
  };

  const handleEditResult = () => {
    setIsEditing(true);
    setScreen('wizard');
  };

  const handleDeleteHistoryItems = (ids: string[]) => {
    const newHistory = history.filter(item => !ids.includes(item.id));
    setHistory(newHistory);
    localStorage.setItem('poolsense_history', JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    if (confirm("Isso apagará TODO o histórico de análises, mas manterá os dados da piscina. Continuar?")) {
      setHistory([]);
      localStorage.removeItem('poolsense_history');
    }
  };

  const handleDeleteData = () => {
    if (confirm("Tem certeza? Isso apagará a piscina e todo o histórico permanentemente.")) {
      localStorage.removeItem('poolsense_pool');
      localStorage.removeItem('poolsense_history');
      setPool(null);
      setHistory([]);
      setScreen('onboarding');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl overflow-hidden relative font-inter">
      {screen === 'onboarding' && <Onboarding onFinish={() => setScreen('setup')} />}
      {screen === 'setup' && <PoolSetup onSave={handlePoolSave} />}
      {screen === 'dashboard' && pool && (
        <Dashboard 
          pool={pool} 
          history={history} 
          onNewAnalysis={() => { setIsEditing(false); setCurrentResult(null); setScreen('wizard'); }} 
          onDeletePool={handleDeleteData}
          onViewHistory={handleViewHistory}
          onDeleteHistoryItems={handleDeleteHistoryItems}
          onClearHistory={handleClearHistory}
          onOpenSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen 
          onClose={() => setScreen('dashboard')} 
          onDeleteData={handleDeleteData}
        />
      )}
      {screen === 'wizard' && pool && (
        <AnalysisWizard 
          pool={pool} 
          onComplete={handleAnalysisComplete} 
          onCancel={() => setScreen(currentResult ? 'result' : 'dashboard')} 
          history={history}
          initialResult={isEditing ? currentResult : null}
        />
      )}
      {screen === 'result' && currentResult && (
        <ResultScreen 
          result={currentResult} 
          onClose={() => setScreen('dashboard')} 
          onEdit={handleEditResult}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);