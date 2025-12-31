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
  ShieldAlert,
  Code,
  FlaskConical,
  Save
} from 'lucide-react';

// --- ARQUITETURA DE DADOS (MODELO) ---

type UnitSystem = 'metric' | 'imperial';
type PoolShape = 'rectangular' | 'round' | 'custom';
type PoolType = 'pool' | 'spa';
type CoatingType = 'tile' | 'fiberglass' | 'vinyl';
type ChlorineType = 'granulate' | 'tablet';

// Categorias de tratamento suportadas
type TreatmentCategory = 
  | 'ph_up'       // Elevador de pH (Barrilha)
  | 'ph_down'     // Redutor de pH (Ácido)
  | 'alk_up'      // Elevador de Alcalinidade (Bicarbonato)
  | 'alk_down'    // Redutor de Alcalinidade
  | 'chlorine'    // Cloro de Manutenção/Choque
  | 'hardness_up' // Elevador de Dureza
  | 'algicide'    // Algicida
  | 'clarifier';  // Clarificante

// Interface para Produto Químico Customizável
interface ChemicalProduct {
  id: string;
  name: string;
  category: TreatmentCategory;
  
  // Regra de Dosagem: "Use X (doseQuantity) [unidade] para afetar Y (effectChange) [unidade] em Z (volumeReference) litros"
  doseQuantity: number;      // Ex: 10 (g)
  unit: string;              // Ex: 'g', 'ml'
  effectChange: number;      // Ex: 0.1 (pH) ou 1 (ppm)
  volumeReference: number;   // Ex: 1000 (Litros)
  
  instructions?: string;     // Instrução extra (ex: "Diluir em balde")
  isDefault?: boolean;       // Se é um produto padrão do sistema
}

interface Pool {
  id: string;
  name: string;
  volume: number; // em litros
  shape: PoolShape;
  type: PoolType;
  coating: CoatingType;
  chlorineType?: ChlorineType; 
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

// --- DADOS PADRÃO (FALLBACKS CONSERVADORES - REVISADO) ---
// Valores ajustados para serem mais seguros (evitar superdosagem)
const DEFAULT_PRODUCTS: ChemicalProduct[] = [
  {
    id: 'def_ph_up',
    name: 'Elevador de pH (Barrilha)',
    category: 'ph_up',
    doseQuantity: 6, // REVISADO: 6g (antes 10g). Barrilha leve geralmente pede 4-6g por m3 para subir 0.1
    unit: 'g',
    effectChange: 0.1, // sobe 0.1 pH
    volumeReference: 1000, 
    isDefault: true,
    instructions: 'Dissolva previamente e distribua na piscina. Filtre.'
  },
  {
    id: 'def_ph_down',
    name: 'Redutor de pH (Líquido)',
    category: 'ph_down',
    doseQuantity: 8, // REVISADO: 8ml (antes 10ml). Ácido é forte, melhor ir devagar.
    unit: 'ml',
    effectChange: 0.1, // baixa 0.1 pH
    volumeReference: 1000,
    isDefault: true,
    instructions: 'PERIGO: Ácido. Dilua em um balde com água e espalhe.'
  },
  {
    id: 'def_alk_up',
    name: 'Bicarbonato de Sódio',
    category: 'alk_up',
    doseQuantity: 17, // Mantido: 17g é o padrão químico exato para subir 10ppm em 1000L
    unit: 'g',
    effectChange: 10, // sobe 10 ppm
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Espalhe pela superfície.'
  },
  {
    id: 'def_alk_down',
    name: 'Redutor de pH/Alcalinidade',
    category: 'alk_down',
    doseQuantity: 10, // REVISADO: 10ml (antes 15ml). Conservador.
    unit: 'ml',
    effectChange: 10, // baixa 10 ppm
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Aplique em pontos localizados para maior efeito na alcalinidade.'
  },
  {
    id: 'def_cl_gran',
    name: 'Cloro Granulado (Dicloro)',
    category: 'chlorine',
    doseQuantity: 3, // REVISADO: 3g (antes 4g). Dicloro 56% tipicamente usa 2-3g para 1ppm.
    unit: 'g',
    effectChange: 1, // sobe 1 ppm
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Aplique preferencialmente ao entardecer.'
  },
  {
    id: 'def_hard_up',
    name: 'Cloreto de Cálcio',
    category: 'hardness_up',
    doseQuantity: 15, // Mantido: Padrão de mercado
    unit: 'g',
    effectChange: 10, // sobe 10 ppm
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Dissolva bem, aquece ao misturar com água.'
  },
  {
    id: 'def_clarifier',
    name: 'Clarificante Padrão',
    category: 'clarifier',
    doseQuantity: 4, // 4ml (Dose de manutenção/leve)
    unit: 'ml',
    effectChange: 1, // Dummy effect (1 aplicação)
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Filtre por 6 horas ou conforme instrução.'
  },
  {
    id: 'def_algicide',
    name: 'Algicida de Choque',
    category: 'algicide',
    doseQuantity: 5, // REVISADO: 5ml (antes 6ml).
    unit: 'ml',
    effectChange: 1, // Dummy
    volumeReference: 1000,
    isDefault: true,
    instructions: 'Use 1h após o cloro. Escove as paredes.'
  }
];

// --- MOTOR DE CÁLCULO (SERVICES) ---

// Função auxiliar para encontrar o produto correto
const getProductFor = (category: TreatmentCategory, userProducts: ChemicalProduct[]): ChemicalProduct => {
  // 1. Tenta achar um produto criado pelo usuário para essa categoria
  const custom = userProducts.find(p => p.category === category && !p.isDefault);
  if (custom) return custom;
  
  // 2. Se não, usa o padrão
  const def = DEFAULT_PRODUCTS.find(p => p.category === category);
  return def!;
};

const calculateTreatment = (
  pool: Pool, 
  measurements: Measurements, 
  visual: VisualState,
  userProducts: ChemicalProduct[], // Nova dependência: Lista de produtos
  previousMeasurements?: Measurements | null,
  existingId?: string
): TreatmentResult => {
  const steps: TreatmentStep[] = [];
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  let orderCounter = 1;

  const TARGET = {
    PH_MIN: 7.2, PH_MAX: 7.6, PH_IDEAL: 7.4,
    ALK_MIN: 80, ALK_MAX: 120, ALK_IDEAL: 100,
    CL_MIN: 1, CL_MAX: 3, CL_IDEAL: 2, // Ideal para Dicloro estabilizado
    HARD_MIN: 200, HARD_MAX: 400, HARD_IDEAL: 300
  };

  // --- Lógica de Persistência (Alertas) ---
  if (previousMeasurements) {
    if (measurements.ph !== null && previousMeasurements.ph !== null) {
      if (previousMeasurements.ph < TARGET.PH_MIN && measurements.ph < TARGET.PH_MIN) {
        steps.push({
          order: orderCounter++,
          title: 'Atenção: pH Travado',
          product: 'Verificar Alcalinidade',
          dose: 0,
          unit: '-',
          instruction: 'O pH não subiu. Verifique se a alcalinidade está correta, pois ela funciona como um "amortecedor" do pH.',
          waitDuration: '-'
        });
      }
    }
  }

  // Helper de cálculo genérico baseado no produto
  const calculateDose = (product: ChemicalProduct, targetValue: number, currentValue: number): number => {
    const delta = Math.abs(targetValue - currentValue);
    // Regra de três: 
    // Se Product.doseQuantity faz Product.effectChange em Product.volumeReference...
    // Fator = (delta / Product.effectChange)
    // Dose = Fator * Product.doseQuantity * (Pool.volume / Product.volumeReference)
    
    // Proteção contra divisão por zero
    if (product.effectChange === 0 || product.volumeReference === 0) return 0;

    const factor = delta / product.effectChange;
    const totalDose = factor * product.doseQuantity * (pool.volume / product.volumeReference);
    return Math.round(totalDose);
  };

  // 1. Alcalinidade (Prioridade 1)
  if (measurements.alkalinity !== null) {
    if (measurements.alkalinity < TARGET.ALK_MIN) {
      status = 'warning';
      const product = getProductFor('alk_up', userProducts);
      const dose = calculateDose(product, TARGET.ALK_IDEAL, measurements.alkalinity);
      
      steps.push({
        order: orderCounter++,
        title: 'Ajustar Alcalinidade Baixa',
        product: product.name,
        dose: dose,
        unit: product.unit,
        instruction: product.instructions || 'Dissolva e espalhe.',
        waitDuration: '6 horas filtrando'
      });
    } else if (measurements.alkalinity > TARGET.ALK_MAX) {
      status = 'warning';
      const product = getProductFor('alk_down', userProducts);
      const dose = calculateDose(product, TARGET.ALK_IDEAL, measurements.alkalinity);

      steps.push({
        order: orderCounter++,
        title: 'Baixar Alcalinidade',
        product: product.name,
        dose: dose,
        unit: product.unit,
        instruction: product.instructions || 'Use redutor de pH/Alcalinidade.',
        waitDuration: '6 horas circulando'
      });
    }
  }

  // 2. pH (Prioridade 2)
  if (measurements.ph !== null) {
    if (measurements.ph < TARGET.PH_MIN) {
      const product = getProductFor('ph_up', userProducts);
      const dose = calculateDose(product, TARGET.PH_IDEAL, measurements.ph);
      
      steps.push({
        order: orderCounter++,
        title: 'Elevar pH',
        product: product.name,
        dose: dose,
        unit: product.unit,
        instruction: product.instructions || 'Dissolva previamente.',
        waitDuration: '1 hora circulando'
      });
      if (status === 'ok') status = 'warning';

    } else if (measurements.ph > TARGET.PH_MAX) {
      const product = getProductFor('ph_down', userProducts);
      const dose = calculateDose(product, TARGET.PH_IDEAL, measurements.ph);

      steps.push({
        order: orderCounter++,
        title: 'Reduzir pH',
        product: product.name,
        dose: dose,
        unit: product.unit,
        instruction: product.instructions || 'Dilua em balde e aplique.',
        waitDuration: '1 hora circulando'
      });
      if (status === 'ok') status = 'warning';
    }
  }

  // 3. Dureza Cálcica
  if (measurements.hardness !== null) {
    if (measurements.hardness < TARGET.HARD_MIN) {
      status = 'warning';
      const product = getProductFor('hardness_up', userProducts);
      const dose = calculateDose(product, TARGET.HARD_IDEAL, measurements.hardness);

      steps.push({
        order: orderCounter++,
        title: 'Ajustar Dureza Cálcica',
        product: product.name,
        dose: dose,
        unit: product.unit,
        instruction: product.instructions || 'Dissolva e aplique.',
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
        instruction: 'Drene parte da água e reponha.',
        waitDuration: '-'
      });
    }
  }

  // 4. Sanitização e Visual
  const isGreen = visual.appearance === 'green' || visual.appearance === 'algae';
  const isCloudy = visual.appearance === 'cloudy';

  if (isGreen) {
    status = 'critical';
    // Para choque, calculamos uma dose para subir MUITO o cloro (Ex: +10 a +12 ppm)
    const productCl = getProductFor('chlorine', userProducts);
    const shockDose = calculateDose(productCl, 12, 0); // Considera subir 12ppm
    
    steps.push({
      order: orderCounter++,
      title: 'Supercloração (Choque)',
      product: productCl.name,
      dose: shockDose,
      unit: productCl.unit,
      instruction: 'Para matar algas. Dissolva bem e espalhe.',
      waitDuration: 'Filtrar por 8 a 12 horas'
    });

    const productAlg = getProductFor('algicide', userProducts);
    // Algicida de choque: doseQuantity * (pool.volume / volumeReference)
    const doseAlg = productAlg.doseQuantity * (pool.volume / productAlg.volumeReference);

    steps.push({
      order: orderCounter++,
      title: 'Aplicar Algicida',
      product: productAlg.name,
      dose: Math.round(doseAlg),
      unit: productAlg.unit,
      instruction: productAlg.instructions || '1h após o cloro.',
      waitDuration: 'Filtrar junto com o cloro'
    });

  } else if (isCloudy) {
    if (status === 'ok') status = 'warning';
    const productClar = getProductFor('clarifier', userProducts);
    const doseClar = productClar.doseQuantity * (pool.volume / productClar.volumeReference);
    
    steps.push({
      order: orderCounter++,
      title: 'Clarificar Água',
      product: productClar.name,
      dose: Math.round(doseClar),
      unit: productClar.unit,
      instruction: productClar.instructions || 'Filtre conforme instrução.',
      waitDuration: '6 a 8 horas'
    });
  }

  // Cloro Manutenção
  if (!isGreen && measurements.chlorine !== null) {
    if (measurements.chlorine < TARGET.CL_MIN) {
      if (pool.chlorineType === 'tablet') {
        // Lógica de pastilha mantida simples (unidades)
        const isSmallPool = pool.volume <= 10000;
        const tabletCount = Math.max(1, Math.ceil(pool.volume / (isSmallPool ? 2000 : 30000)));
        steps.push({
          order: orderCounter++,
          title: 'Repor Cloro (Pastilha)',
          product: isSmallPool ? 'Mini Pastilha (20g)' : 'Pastilha (200g)',
          dose: tabletCount,
          unit: 'unidade(s)',
          instruction: 'No flutuador ou skimmer.',
          waitDuration: '-'
        });
      } else {
        const product = getProductFor('chlorine', userProducts);
        const dose = calculateDose(product, TARGET.CL_IDEAL, measurements.chlorine);
        
        steps.push({
          order: orderCounter++,
          title: 'Repor Cloro',
          product: product.name,
          dose: dose,
          unit: product.unit,
          instruction: product.instructions || 'Aplique ao entardecer.',
          waitDuration: '1 hora'
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
    date: existingId ? new Date().toISOString() : new Date().toISOString(),
    status,
    summary,
    steps,
    measurements,
    visual
  };
};

// --- UI COMPONENTS ---

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

// --- TELA DE PRODUTOS ---

const ProductsScreen = ({ products, onSaveProducts, onClose }: { products: ChemicalProduct[], onSaveProducts: (p: ChemicalProduct[]) => void, onClose: () => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ChemicalProduct>>({});
  const [activeCategory, setActiveCategory] = useState<TreatmentCategory>('ph_up');

  // Categorias amigáveis
  const categories: {key: TreatmentCategory, label: string}[] = [
    { key: 'ph_up', label: 'Elevar pH' },
    { key: 'ph_down', label: 'Baixar pH' },
    { key: 'alk_up', label: 'Elevar Alcalinidade' },
    { key: 'alk_down', label: 'Baixar Alcalinidade' },
    { key: 'chlorine', label: 'Cloro' },
    { key: 'hardness_up', label: 'Elevar Dureza' },
    { key: 'algicide', label: 'Algicida' },
    { key: 'clarifier', label: 'Clarificante' }
  ];

  const currentProduct = products.find(p => p.category === activeCategory) || DEFAULT_PRODUCTS.find(p => p.category === activeCategory);

  const startEdit = () => {
    if (currentProduct) {
      setFormData({ ...currentProduct });
      setEditingId(currentProduct.id);
    }
  };

  const saveEdit = () => {
    if (!formData.name || !formData.doseQuantity || !formData.volumeReference) return;
    
    const newProduct: ChemicalProduct = {
      ...(formData as ChemicalProduct),
      id: formData.isDefault ? Date.now().toString() : (formData.id || Date.now().toString()), // Se editar um default, cria novo ID
      isDefault: false, // Customizado deixa de ser default
      category: activeCategory
    };

    // Remove qualquer produto existente dessa categoria na lista do usuário e adiciona o novo
    const otherProducts = products.filter(p => p.category !== activeCategory);
    onSaveProducts([...otherProducts, newProduct]);
    setEditingId(null);
  };

  const resetToDefault = () => {
    if (confirm('Voltar para o produto padrão do sistema?')) {
      const otherProducts = products.filter(p => p.category !== activeCategory);
      onSaveProducts(otherProducts); // Ao remover o custom, o sistema usa o Default automaticamente no cálculo
      setEditingId(null);
    }
  };

  const renderEffectLabel = (cat: TreatmentCategory) => {
    if (cat === 'chlorine' || cat.includes('alk') || cat.includes('hardness')) return 'ppm';
    if (cat.includes('ph')) return 'pH';
    return 'dose';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className={`p-6 pt-12 rounded-b-[2rem] shadow-lg ${BRAND_GRADIENT} text-white mb-4