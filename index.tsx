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
      <div className={`p-6 pt-12 rounded-b-[2rem] shadow-lg ${BRAND_GRADIENT} text-white mb-4`}>
        <div className="flex justify-between items-center mb-4">
          <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-md"><ChevronLeft /></button>
          <h2 className="text-xl font-bold">Meus Produtos</h2>
          <div className="w-10"></div>
        </div>
        <p className="text-sky-100 text-center text-sm">Configure as dosagens conforme o rótulo da marca que você usa.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {/* Seletor de Categoria Horizontal */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-4 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setEditingId(null); }}
              className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-xs transition-colors ${activeCategory === cat.key ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {editingId ? (
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-bold text-lg text-slate-800 mb-4">Editar {categories.find(c => c.key === activeCategory)?.label}</h3>
            
            <InputGroup label="Nome do Produto (Marca)" value={formData.name} onChange={(v:string)=>setFormData({...formData, name: v})} type="text" placeholder="Ex: Genco pH+" />
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Regra de Dosagem (Leia o Rótulo)</p>
              
              <div className="flex items-end gap-3 mb-4">
                 <div className="flex-1">
                    <label className="text-xs text-slate-500 font-bold ml-1">Usa quanto?</label>
                    <input type="number" className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700" value={formData.doseQuantity} onChange={e=>setFormData({...formData, doseQuantity: parseFloat(e.target.value)})} />
                 </div>
                 <div className="w-24">
                    <label className="text-xs text-slate-500 font-bold ml-1">Unidade</label>
                    <select className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700 bg-white" value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})}>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="oz">oz</option>
                    </select>
                 </div>
              </div>

              {activeCategory !== 'algicide' && activeCategory !== 'clarifier' && (
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                      <label className="text-xs text-slate-500 font-bold ml-1">Para mudar quanto?</label>
                      <input type="number" className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700" value={formData.effectChange} onChange={e=>setFormData({...formData, effectChange: parseFloat(e.target.value)})} />
                  </div>
                  <div className="w-24 flex items-center h-[50px]">
                      <span className="font-bold text-slate-400">{renderEffectLabel(activeCategory)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-3">
                 <div className="flex-1">
                    <label className="text-xs text-slate-500 font-bold ml-1">Em quantos litros?</label>
                    <input type="number" className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700" value={formData.volumeReference} onChange={e=>setFormData({...formData, volumeReference: parseFloat(e.target.value)})} />
                 </div>
              </div>
            </div>

            <InputGroup label="Instruções Extras" value={formData.instructions || ''} onChange={(v:string)=>setFormData({...formData, instructions: v})} type="text" placeholder="Ex: Diluir antes" />

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setEditingId(null)} className="flex-1">Cancelar</Button>
              <Button onClick={saveEdit} className="flex-1">Salvar</Button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="font-bold text-xl text-slate-800">{currentProduct?.name}</h3>
                 <span className={`text-xs font-bold px-2 py-1 rounded-md ${currentProduct?.isDefault ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-600'}`}>
                   {currentProduct?.isDefault ? 'Produto Padrão' : 'Personalizado'}
                 </span>
               </div>
               <div className="p-3 bg-sky-50 rounded-full text-sky-500">
                 <FlaskConical size={24} />
               </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6">
              <p className="text-slate-600 text-sm font-medium leading-relaxed">
                Regra: <span className="font-bold text-slate-800">{currentProduct?.doseQuantity}{currentProduct?.unit}</span> para 
                {activeCategory !== 'algicide' && activeCategory !== 'clarifier' && (
                  <> alterar <span className="font-bold text-slate-800">{currentProduct?.effectChange} {renderEffectLabel(activeCategory)}</span> em </>
                )}
                 <span className="font-bold text-slate-800"> {currentProduct?.volumeReference} Litros</span>.
              </p>
            </div>

            <Button fullWidth onClick={startEdit} variant="outline" className="mb-3">
              {currentProduct?.isDefault ? 'Personalizar este produto' : 'Editar'}
            </Button>
            
            {!currentProduct?.isDefault && (
              <button onClick={resetToDefault} className="w-full text-red-500 text-sm font-bold py-3 hover:bg-red-50 rounded-xl transition-colors">
                Restaurar Padrão
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- RESTO DO APP (Mantido igual) ---

// Onboarding
const Onboarding = ({ onFinish }: { onFinish: () => void }) => (
  <div className={`flex flex-col h-screen ${BRAND_GRADIENT} text-white p-8 justify-between relative overflow-hidden`}>
    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
       <div className="absolute -top-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
       <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-300 rounded-full blur-3xl"></div>
    </div>
    <div className="mt-12 relative z-10 flex flex-col items-center text-center">
      <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-sky-900/20 mb-8 animate-in zoom-in duration-500">
        <div className="w-32 h-32 relative flex items-center justify-center overflow-hidden">
          <img src="logo.png" alt="PoolSense Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.classList.add('bg-sky-100'); const icon = document.createElement('div'); icon.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'; e.currentTarget.parentElement!.appendChild(icon); }} />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-3 tracking-tight">PoolSense</h1>
      <p className="text-sky-100 text-lg font-medium max-w-xs mx-auto">Água Perfeita, Fácil e Rápido</p>
    </div>
    <div className="space-y-3 mb-8 relative z-10">
      <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
        <div className="bg-white/20 p-2 rounded-full"><CheckCircle className="text-cyan-300" size={20} /></div><span className="font-semibold text-white/90">Dosagem precisa</span>
      </div>
      <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
        <div className="bg-white/20 p-2 rounded-full"><Waves className="text-cyan-300" size={20} /></div><span className="font-semibold text-white/90">Água sempre cristalina</span>
      </div>
    </div>
    <div className="relative z-10 w-full">
      <button onClick={onFinish} className="w-full bg-white text-sky-700 py-5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-sky-50 transition-all mb-6">Começar</button>
      <p className="text-center text-white/50 text-xs font-medium pb-4">Desenvolvido por Daniel Possamai Vieira</p>
    </div>
  </div>
);

// Pool Setup
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
    if (shape === 'rectangular') return (parseFloat(dims.length) * parseFloat(dims.width) * parseFloat(dims.depth)) * 1000;
    else if (shape === 'round') { const radius = parseFloat(dims.diameter) / 2; return (Math.PI * Math.pow(radius, 2) * parseFloat(dims.depth)) * 1000; }
    return 0;
  };
  const handleFinish = () => {
    const vol = calculateVolume();
    if (vol <= 0 || isNaN(vol)) { alert("Por favor, preencha as medidas corretamente para calcular o volume."); return; }
    onSave({ id: Date.now().toString(), name: name || 'Minha Piscina', volume: Math.round(vol), type, shape, coating, chlorineType });
  };
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-6 pt-12 pb-4 rounded-b-3xl shadow-sm z-10">
        <h2 className={`text-2xl font-extrabold ${BRAND_TEXT}`}>Configurar Piscina</h2>
        <div className="flex gap-2 mt-4"><div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-sky-500' : 'bg-slate-200'}`}></div><div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-sky-500' : 'bg-slate-200'}`}></div></div>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
      {step === 1 && (
        <div className="space-y-6 fade-in">
          <InputGroup label="Nome da Piscina" placeholder="Ex: Piscina de Casa" value={name} onChange={setName} type="text" />
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Tipo</label>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setType('pool')} className={`p-4 rounded-2xl border-2 font-bold transition-all ${type === 'pool' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md' : 'border-slate-100 bg-white text-slate-400'}`}>Piscina</button>
              <button onClick={() => setType('spa')} className={`p-4 rounded-2xl border-2 font-bold transition-all ${type === 'spa' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md' : 'border-slate-100 bg-white text-slate-400'}`}>Spa / Jacuzzi</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Revestimento</label>
            <select className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-sky-400 outline-none" value={coating} onChange={(e) => setCoating(e.target.value as CoatingType)}>
              <option value="tile">Azulejo / Pastilha</option><option value="vinyl">Vinil</option><option value="fiberglass">Fibra</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Cloro Preferido</label>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setChlorineType('granulate')} className={`p-3 rounded-2xl border-2 font-semibold text-sm transition-all ${chlorineType === 'granulate' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}>Granulado</button>
              <button onClick={() => setChlorineType('tablet')} className={`p-3 rounded-2xl border-2 font-semibold text-sm transition-all ${chlorineType === 'tablet' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 bg-white text-slate-400'}`}>Pastilha</button>
            </div>
          </div>
          <Button fullWidth onClick={() => setStep(2)}>Continuar</Button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-6 fade-in">
          <div className="flex bg-white p-1 rounded-xl mb-6 shadow-sm border border-slate-100">
            <button className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${calcMode === 'dimensions' ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`} onClick={() => setCalcMode('dimensions')}>Por Medidas</button>
            <button className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${calcMode === 'manual' ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`} onClick={() => setCalcMode('manual')}>Volume Direto</button>
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
                <><InputGroup label="Comprimento" suffix="m" value={dims.length} onChange={(v:string) => setDims({...dims, length: v})} /><InputGroup label="Largura" suffix="m" value={dims.width} onChange={(v:string) => setDims({...dims, width: v})} /></>
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

// Analysis Wizard
const AnalysisWizard = ({ 
  pool, 
  userProducts,
  onComplete, 
  onCancel, 
  history, 
  initialResult 
}: { 
  pool: Pool, 
  userProducts: ChemicalProduct[],
  onComplete: (res: TreatmentResult) => void, 
  onCancel: () => void, 
  history: TreatmentResult[],
  initialResult?: TreatmentResult | null
}) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Measurements>({ ph: null, chlorine: null, alkalinity: null, hardness: null, cyanuric: null });
  const [visual, setVisual] = useState<VisualState>({ appearance: 'clear', strongSmell: false, heavyUsage: false });
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      userProducts, // Passamos os produtos customizados
      previousMeasurement,
      initialResult?.id
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
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sky-500 text-sm font-bold flex items-center gap-1 hover:text-sky-700 py-2">
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
                    <button key={opt.id} onClick={() => setVisual({ ...visual, appearance: opt.id as any })} className={`w-full text-left p-4 rounded-2xl border-2 transition-all font-semibold ${visual.appearance === opt.id ? `ring-2 ring-sky-400 ring-offset-1 ${opt.color}` : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                      <div className="flex items-center justify-between">{opt.label}{visual.appearance === opt.id && <CheckCircle size={18} />}</div>
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
             <Button fullWidth onClick={handleCalculate} className="shadow-sky-300/50">{initialResult ? 'Salvar Alterações' : 'Gerar Tratamento'}</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Result Screen
const ResultScreen = ({ result, onClose, onEdit }: { result: TreatmentResult, onClose: () => void, onEdit: () => void }) => {
  const handleShare = async () => {
    const text = `
🌊 *Resultado PoolSense - ${new Date(result.date).toLocaleDateString('pt-BR')}*
Status: ${result.status === 'ok' ? '✅ Água Equilibrada' : result.status === 'warning' ? '⚠️ Atenção Necessária' : '🚫 Crítico'}

*Produtos Necessários:*
${result.steps.map(s => s.dose > 0 ? `- ${s.title}: ${s.dose}${s.unit} de ${s.product}` : `- ${s.title}: Verifique ${s.product}`).join('\n')}

_Gerado por PoolSense App_`.trim();

    if (navigator.share) {
      try { await navigator.share({ title: 'Tratamento de Piscina', text: text, }); } catch (err) { console.error('Erro ao compartilhar', err); }
    } else {
      navigator.clipboard.writeText(text); alert('Texto copiado para a área de transferência!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className={`p-8 pb-16 rounded-b-[3rem] shadow-xl ${result.status === 'ok' ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : result.status === 'warning' ? 'bg-gradient-to-br from-amber-400 to-orange-600' : 'bg-gradient-to-br from-red-500 to-rose-700'}`}>
        <div className="flex justify-between items-center text-white mb-8">
          <button onClick={onClose} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all"><ChevronLeft /></button>
          <span className="font-bold tracking-wide opacity-90 text-sm uppercase">Relatório</span>
          <div className="flex gap-2">
             <button onClick={handleShare} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all" title="Compartilhar"><Share2 size={20} /></button>
            <button onClick={onEdit} className="bg-white/20 p-3 rounded-full hover:bg-white/30 backdrop-blur-md transition-all" title="Editar dados"><Pencil size={20} /></button>
          </div>
        </div>
        <div className="text-center text-white">
          <div className="bg-white/25 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-inner border border-white/20">
            {result.status === 'ok' ? <CheckCircle size={48} className="drop-shadow-md" /> : result.status === 'warning' ? <AlertTriangle size={48} className="drop-shadow-md" /> : <XCircle size={48} className="drop-shadow-md" />}
          </div>
          <h2 className="text-3xl font-extrabold mb-3 tracking-tight">{result.status === 'ok' ? 'Água Perfeita!' : result.status === 'warning' ? 'Atenção' : 'Ação Imediata'}</h2>
          <p className="text-white/90 font-medium text-lg leading-relaxed max-w-xs mx-auto">{result.summary}</p>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-10 pb-10 z-10">
        {result.steps.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-emerald-500" size={32} /></div>
            <p className="text-slate-600 text-lg font-medium">Nenhum produto químico necessário. Aproveite sua piscina!</p>
          </div>
        ) : (
          <div className="space-y-5">
             {result.steps.map((step, idx) => (
               <div key={idx} className="bg-white p-0 rounded-3xl shadow-lg shadow-slate-200/60 border border-slate-100 overflow-hidden">
                 <div className={`px-6 py-4 flex justify-between items-center ${step.dose === 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${step.dose === 0 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{step.dose === 0 ? 'Observação' : `Passo ${step.order}`}</span>
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
                    <div className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-2xl">{step.instruction}</div>
                 </div>
               </div>
             ))}
          </div>
        )}
        <div className="mt-8 bg-orange-50 p-5 rounded-3xl border border-orange-100 flex gap-4 items-start">
          <Info className="text-orange-500 shrink-0 mt-1" /><p className="text-orange-800 text-xs leading-relaxed font-medium"><strong>Segurança:</strong> Nunca misture produtos químicos. Adicione sempre o produto à água, nunca o contrário. Mantenha fora do alcance de crianças.</p>
        </div>
        <div className="h-6"></div>
        <Button fullWidth onClick={onClose} variant="secondary">Voltar ao Início</Button>
      </div>
    </div>
  );
};

// Settings Screen
const SettingsScreen = ({ onClose, onDeleteData, onOpenProducts }: { onClose: () => void, onDeleteData: () => void, onOpenProducts: () => void }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <div className={`p-6 pt-12 rounded-b-[2rem] shadow-lg ${BRAND_GRADIENT} text-white mb-6`}>
         <div className="flex justify-between items-center mb-4">
           <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-md"><ChevronLeft /></button>
           <h2 className="text-xl font-bold">Configurações</h2>
           <div className="w-10"></div>
         </div>
         <p className="text-sky-100 text-center text-sm">Ajustes e Tabela de Referência</p>
       </div>

       <div className="px-6 space-y-6 flex-1 overflow-y-auto pb-10">
         
         <section>
           <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
             <FlaskConical size={20} className="text-sky-500" />
             Produtos Químicos
           </h3>
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <p className="text-slate-600 text-sm mb-4">Configure as marcas e concentrações dos produtos que você usa para cálculos mais precisos.</p>
             <Button fullWidth variant="outline" onClick={onOpenProducts}>
                Gerenciar Meus Produtos
             </Button>
           </div>
         </section>

         <section>
           <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
             <BookOpen size={20} className="text-sky-500" />
             Parâmetros Ideais
           </h3>
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                 <tr><th className="px-4 py-3">Parâmetro</th><th className="px-4 py-3">Ideal</th></tr>
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
         </section>

         <section>
           <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
             <Code size={20} className="text-sky-500" />
             Sobre o App
           </h3>
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex flex-col gap-1 py-2">
               <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Desenvolvedor</span>
               <span className="text-slate-800 font-semibold">Daniel Possamai Vieira</span>
             </div>
             <div className="flex items-center justify-between py-2 border-t border-slate-50">
               <span className="text-slate-600 font-medium">Versão</span>
               <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold">1.1.1</span>
             </div>
           </div>
         </section>

         <section>
           <h3 className="text-red-600 font-bold mb-3 flex items-center gap-2">
             <ShieldAlert size={20} />
             Zona de Perigo
           </h3>
           <button onClick={onDeleteData} className="w-full flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 font-medium hover:bg-red-100 transition-colors"><span>Apagar Piscina e Dados</span><Trash2 size={18} /></button>
         </section>
       </div>
    </div>
  );
};

// Dashboard
const Dashboard = ({ pool, onNewAnalysis, history, onDeletePool, onViewHistory, onDeleteHistoryItems, onClearHistory, onOpenSettings }: any) => {
  const lastTreatment = history.length > 0 ? history[0] : null;
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedIds(newSelected);
  };
  const handleDeleteSelected = () => {
    if (confirm(`Excluir ${selectedIds.size} itens selecionados?`)) {
      onDeleteHistoryItems(Array.from(selectedIds)); setIsSelectionMode(false); setSelectedIds(new Set());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className={`px-8 pt-12 pb-16 rounded-b-[3rem] shadow-xl ${BRAND_GRADIENT} text-white relative overflow-hidden`}>
         <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
         <div className="absolute -left-10 bottom-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl"></div>
         <div className="relative z-10 flex justify-between items-start">
           <div><p className="text-sky-100 text-sm font-medium mb-1">Bem-vindo(a) à</p><h1 className="text-3xl font-extrabold tracking-tight">{pool.name}</h1></div>
           <button onClick={onOpenSettings} className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-lg hover:bg-white/30 transition-all text-white"><Settings size={24} /></button>
         </div>
         <div className="mt-4 inline-flex items-center gap-2 bg-black/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-xs font-bold text-white/90">{pool.volume / 1000}k Litros ({pool.type === 'pool' ? 'Piscina' : 'Spa'})</span>
         </div>
      </div>
      <main className="px-6 -mt-8 relative z-10 space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Status Atual</h3>{lastTreatment && (<span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{new Date(lastTreatment.date).toLocaleDateString('pt-BR')}</span>)}</div>
          {lastTreatment ? (
            <div className="flex items-center gap-4">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lastTreatment.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : lastTreatment.status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>{lastTreatment.status === 'ok' ? <CheckCircle size={28} /> : lastTreatment.status === 'warning' ? <AlertTriangle size={28} /> : <XCircle size={28} />}</div>
               <div><p className={`font-bold text-lg ${lastTreatment.status === 'ok' ? 'text-emerald-700' : lastTreatment.status === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>{lastTreatment.status === 'ok' ? 'Água Equilibrada' : lastTreatment.status === 'warning' ? 'Requer Atenção' : 'Crítico'}</p><p className="text-xs text-slate-400 font-medium">Toque no histórico para detalhes</p></div>
            </div>
          ) : (<p className="text-slate-500 text-sm">Nenhuma análise registrada.</p>)}
          <div className="mt-6"><button onClick={onNewAnalysis} className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg shadow-sky-200/50 flex items-center justify-center gap-3 transition-transform active:scale-95 ${BRAND_GRADIENT}`}><Plus size={24} className="text-white" />Nova Análise</button></div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className={`font-bold text-lg ${BRAND_TEXT}`}>Histórico</h3>
            <div className="flex gap-2">
              {history.length > 0 && !isSelectionMode && (<button onClick={() => setIsSelectionMode(true)} className="text-xs text-sky-600 font-bold bg-sky-50 px-4 py-2 rounded-full hover:bg-sky-100 transition-colors">Gerenciar</button>)}
              {isSelectionMode && (<button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="text-xs text-slate-500 font-bold bg-slate-200 px-4 py-2 rounded-full hover:bg-slate-300 transition-colors">Pronto</button>)}
            </div>
          </div>
          {isSelectionMode && (
            <div className="mb-4 flex gap-3 animate-in fade-in slide-in-from-top-2">
              <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="flex-1 bg-red-50 text-red-600 text-xs font-bold py-3 px-4 rounded-2xl border border-red-100 disabled:opacity-50 shadow-sm">Excluir ({selectedIds.size})</button>
              <button onClick={onClearHistory} className="flex-1 bg-white text-slate-600 text-xs font-bold py-3 px-4 rounded-2xl border border-slate-200 shadow-sm">Limpar Tudo</button>
            </div>
          )}
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 border-dashed"><History className="mx-auto mb-3 text-slate-300" size={32} /><p className="text-slate-400 font-medium">Seu histórico aparecerá aqui</p></div>
            ) : (
              history.slice(0, isSelectionMode ? undefined : 5).map((item: TreatmentResult) => (
                <div key={item.id} className="relative flex items-center group">
                  {isSelectionMode && (<button onClick={() => toggleSelection(item.id)} className="mr-3 p-2 text-slate-300 hover:text-sky-500 transition-colors">{selectedIds.has(item.id) ? (<CheckSquare className="text-sky-500" size={24} />) : (<Square size={24} />)}</button>)}
                  <button onClick={() => !isSelectionMode && onViewHistory(item)} disabled={isSelectionMode} className="flex-1 bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
                     <div className="flex gap-4 items-center">
                       <div className={`w-2 h-12 rounded-full ${item.status === 'ok' ? 'bg-emerald-400' : item.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
                       <div className="text-left"><p className="font-bold text-slate-700 text-lg">{new Date(item.date).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</p><p className="text-xs font-semibold text-slate-400">{item.steps.length} {item.steps.length === 1 ? 'passo' : 'passos'} indicados</p></div>
                     </div>
                     <div className="text-right flex items-center gap-3">{!isSelectionMode && <div className="bg-slate-50 p-2 rounded-full"><Eye size={18} className="text-slate-300 group-hover:text-sky-500 transition-colors" /></div>}</div>
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
  const [screen, setScreen] = useState<'onboarding' | 'setup' | 'dashboard' | 'wizard' | 'result' | 'settings' | 'products'>('onboarding');
  const [pool, setPool] = useState<Pool | null>(null);
  const [history, setHistory] = useState<TreatmentResult[]>([]);
  const [userProducts, setUserProducts] = useState<ChemicalProduct[]>([]);
  const [currentResult, setCurrentResult] = useState<TreatmentResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Carregar dados locais ao iniciar
  useEffect(() => {
    const savedPool = localStorage.getItem('poolsense_pool');
    const savedHistory = localStorage.getItem('poolsense_history');
    const savedProducts = localStorage.getItem('poolsense_products');
    
    if (savedPool) { setPool(JSON.parse(savedPool)); setScreen('dashboard'); }
    if (savedHistory) { setHistory(JSON.parse(savedHistory)); }
    if (savedProducts) { setUserProducts(JSON.parse(savedProducts)); }
  }, []);

  const handlePoolSave = (newPool: Pool) => {
    setPool(newPool); localStorage.setItem('poolsense_pool', JSON.stringify(newPool)); setScreen('dashboard');
  };

  const handleProductsSave = (newProducts: ChemicalProduct[]) => {
    setUserProducts(newProducts);
    localStorage.setItem('poolsense_products', JSON.stringify(newProducts));
  };

  const handleAnalysisComplete = (result: TreatmentResult) => {
    const existingIndex = history.findIndex(h => h.id === result.id);
    let newHistory;
    if (existingIndex >= 0) { newHistory = [...history]; newHistory[existingIndex] = result; } 
    else { newHistory = [result, ...history]; }
    setHistory(newHistory); localStorage.setItem('poolsense_history', JSON.stringify(newHistory));
    setCurrentResult(result); setIsEditing(false); setScreen('result');
  };

  const handleViewHistory = (result: TreatmentResult) => { setCurrentResult(result); setScreen('result'); };
  const handleEditResult = () => { setIsEditing(true); setScreen('wizard'); };
  const handleDeleteHistoryItems = (ids: string[]) => { const newHistory = history.filter(item => !ids.includes(item.id)); setHistory(newHistory); localStorage.setItem('poolsense_history', JSON.stringify(newHistory)); };
  
  const handleClearHistory = () => {
    if (confirm("Isso apagará TODO o histórico de análises, mas manterá os dados da piscina. Continuar?")) {
      setHistory([]); localStorage.removeItem('poolsense_history');
    }
  };

  const handleDeleteData = () => {
    if (confirm("Tem certeza? Isso apagará a piscina e todo o histórico permanentemente.")) {
      localStorage.removeItem('poolsense_pool'); localStorage.removeItem('poolsense_history'); localStorage.removeItem('poolsense_products');
      setPool(null); setHistory([]); setUserProducts([]); setScreen('onboarding');
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
          onOpenProducts={() => setScreen('products')}
        />
      )}
      {screen === 'products' && (
        <ProductsScreen 
          products={userProducts}
          onSaveProducts={handleProductsSave}
          onClose={() => setScreen('settings')}
        />
      )}
      {screen === 'wizard' && pool && (
        <AnalysisWizard 
          pool={pool} 
          userProducts={userProducts}
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