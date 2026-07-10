import React, { useState, useEffect, useRef } from 'react';
import { Worker, WorkerType, WeeklyPayment, DAYS_OF_WEEK, Attendance, MaterialItem } from './types';
import { generateReceiptText } from './services/geminiService';
import html2canvas from 'html2canvas';
import { 
  Users, 
  Calendar, 
  Trash2, 
  Save, 
  MessageSquare, 
  CheckSquare, 
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Copy,
  Plus,
  Minus,
  Download,
  AlertCircle,
  Share2
} from 'lucide-react';

const INITIAL_WORKERS: Worker[] = [
  {
    id: '1',
    name: 'Acidio',
    role: WorkerType.PEDREIRO,
    dailyRate: 180,
    attendance: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
    hasAdvance: false,
    advanceDays: 0,
    hasDeduction: false,
    deductionDays: 0
  },
  {
    id: '2',
    name: 'Marquinhos',
    role: WorkerType.AJUDANTE,
    dailyRate: 130,
    attendance: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
    hasAdvance: false,
    advanceDays: 0,
    hasDeduction: false,
    deductionDays: 0
  }
];

const WHATSAPP_NUMBER = "5521997391448";

const App: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = localStorage.getItem('current_week_workers');
    return saved ? JSON.parse(saved) : INITIAL_WORKERS;
  });

  const [history, setHistory] = useState<WeeklyPayment[]>(() => {
    const saved = localStorage.getItem('payment_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [view, setView] = useState<'current' | 'history' | 'material'>('current');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] = useState<boolean>(false);
  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem('materials_list');
    return saved ? JSON.parse(saved) : [];
  });
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialQty, setNewMaterialQty] = useState('');

  const captureRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('current_week_workers', JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('payment_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('materials_list', JSON.stringify(materials));
  }, [materials]);

  const toggleAttendance = (workerId: string, day: keyof Attendance) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { ...w, attendance: { ...w.attendance, [day]: !w.attendance[day] } }
        : w
    ));
  };

  const updateAdvance = (workerId: string, hasAdvance: boolean, days?: number, customValue?: number) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { 
            ...w, 
            hasAdvance, 
            advanceDays: days !== undefined ? days : w.advanceDays || 0,
            customAdvanceValue: customValue !== undefined ? customValue : w.customAdvanceValue || 0
          }
        : w
    ));
  };

  const updateDeduction = (workerId: string, hasDeduction: boolean, days?: number, customValue?: number) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { 
            ...w, 
            hasDeduction, 
            deductionDays: days !== undefined ? days : w.deductionDays || 0,
            customDeductionValue: customValue !== undefined ? customValue : w.customDeductionValue || 0
          }
        : w
    ));
  };

  const calculateWorkerTotal = (worker: Worker) => {
    const daysWorked = Object.values(worker.attendance).filter(Boolean).length;
    const advanceAmount = worker.hasAdvance 
      ? ((worker.advanceDays || 0) * worker.dailyRate) + (worker.customAdvanceValue || 0)
      : 0;
    const deductionAmount = worker.hasDeduction 
      ? ((worker.deductionDays || 0) * worker.dailyRate) + (worker.customDeductionValue || 0)
      : 0;
    return (daysWorked * worker.dailyRate) + advanceAmount - deductionAmount;
  };

  const calculateGrandTotal = () => {
    return workers.reduce((acc, w) => acc + calculateWorkerTotal(w), 0);
  };

  const handleSaveWeek = () => {
    const total = calculateGrandTotal();
    if (total === 0) {
      setToastMessage("Selecione os dias trabalhados antes de salvar!");
      setTimeout(() => setToastMessage(''), 4000);
      return;
    }

    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR');

    const newPayment: WeeklyPayment = {
      id: Date.now().toString(),
      startDate: formattedDate,
      endDate: "",
      workers: JSON.parse(JSON.stringify(workers)),
      totalAmount: total
    };

    setHistory(prev => [newPayment, ...prev]);
    setWorkers(prev => prev.map(w => ({
      ...w,
      attendance: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
      hasAdvance: false,
      advanceDays: 0,
      hasDeduction: false,
      deductionDays: 0
    })));
    setToastMessage("Semana salva com sucesso!");
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleDeleteHistory = (id: string) => {
    if (!id) return;
    setDeleteConfirmationId(id);
  };

  const handleClearAllHistory = () => {
    setShowClearAllConfirmation(true);
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMaterialName.trim()) return;

    const newItem: MaterialItem = {
      id: Date.now().toString(),
      name: newMaterialName.trim(),
      quantity: newMaterialQty.trim() || '1',
      checked: false,
      createdAt: Date.now()
    };

    setMaterials(prev => [newItem, ...prev]);
    setNewMaterialName('');
    setNewMaterialQty('');
  };

  const handleToggleMaterial = (id: string) => {
    setMaterials(prev => prev.map(m => 
      m.id === id ? { ...m, checked: !m.checked } : m
    ));
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleClearAllMaterials = () => {
    setMaterials([]);
    setToastMessage("Lista de materiais limpa!");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleGenerateReceipt = async (payment: WeeklyPayment) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (!captureRef.current) {
        throw new Error("Elemento de captura não encontrado");
      }

      const element = captureRef.current;

      // Capturar o "print" da tela do histórico (área do recibo) com alta resolução
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });

      if (!canvas) {
        throw new Error("Falha ao criar elemento de canvas.");
      }

      // Converter o canvas em um blob de imagem
      const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!imageBlob) {
        throw new Error("Falha ao gerar o arquivo de imagem");
      }

      const filename = `demonstrativo_${payment.startDate.replace(/\//g, '-')}.png`;
      const file = new File([imageBlob], filename, { type: 'image/png' });

      // 1. Tentar compartilhamento nativo de arquivo (Excelente para iOS AirDrop, WhatsApp nativo, etc. no celular)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Demonstrativo - Semanal (${payment.startDate})`,
            text: payment.endDate ? `Fechamento de Obra de ${payment.startDate} a ${payment.endDate}` : `Fechamento de Obra - ${payment.startDate}`
          });
          setToastMessage("Compartilhado com sucesso!");
          setTimeout(() => setToastMessage(''), 4000);
          setIsProcessing(false);
          return;
        } catch (shareErr: any) {
          console.warn("Compartilhamento nativo cancelado ou falhou:", shareErr);
          if (shareErr.name === "AbortError") {
            // Se o usuário cancelou o menu de compartilhar nativo, apenas finalizamos graciosamente
            setIsProcessing(false);
            return;
          }
        }
      }

      // 2. Fallback: Download tradicional da foto + Cópia para a Área de Transferência (Clipboard)
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Tenta copiar para o clipboard para facilitar o envio (Ctrl+V ou pressionar e segurar para colar)
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const item = new ClipboardItem({ 'image/png': imageBlob });
          await navigator.clipboard.write([item]);
          setToastMessage("Foto salva e copiada! Cole no WhatsApp.");
        } catch (clipErr) {
          console.warn("A área de transferência não aceita imagens neste navegador.", clipErr);
          setToastMessage("Demonstrativo salvo com sucesso!");
        }
      } else {
        setToastMessage("Demonstrativo salvo com sucesso!");
      }

      setTimeout(() => setToastMessage(''), 4000);

    } catch (error) {
      console.error("Erro ao gerar ou salvar demonstrativo:", error);
      setToastMessage("Erro ao gerar a imagem do demonstrativo!");
      setTimeout(() => setToastMessage(''), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareMaterials = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (!materialsRef.current) {
        throw new Error("Elemento de captura não encontrado");
      }

      const element = materialsRef.current;

      // Capturar o "print" da lista de materiais com alta resolução
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });

      if (!canvas) {
        throw new Error("Falha ao criar elemento de canvas.");
      }

      // Converter o canvas em um blob de imagem
      const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!imageBlob) {
        throw new Error("Falha ao gerar o arquivo de imagem");
      }

      const filename = `lista_materiais_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.png`;
      const file = new File([imageBlob], filename, { type: 'image/png' });

      // Texto de fallback para caso queiram colar em formato de lista simples também
      const textList = materials.map(m => `${m.checked ? '✓' : '☐'} ${m.name} (${m.quantity})`).join('\n');
      const shareText = `Lista de Materiais de ${new Date().toLocaleDateString('pt-BR')}:\n\n${textList}`;

      // 1. Tentar compartilhamento nativo de arquivo (Excelente para iOS AirDrop, WhatsApp nativo, etc. no celular)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Lista de Materiais - ${new Date().toLocaleDateString('pt-BR')}`,
            text: shareText
          });
          setToastMessage("Lista compartilhada com sucesso!");
          setTimeout(() => setToastMessage(''), 4000);
          setIsProcessing(false);
          return;
        } catch (shareErr: any) {
          console.warn("Compartilhamento nativo cancelado ou falhou:", shareErr);
          if (shareErr.name === "AbortError") {
            setIsProcessing(false);
            return;
          }
        }
      }

      // 2. Fallback: Download tradicional da foto + Cópia para a Área de Transferência (Clipboard)
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Tenta copiar para o clipboard para facilitar o envio (Ctrl+V ou pressionar e segurar para colar)
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const item = new ClipboardItem({ 'image/png': imageBlob });
          await navigator.clipboard.write([item]);
          setToastMessage("Foto salva e copiada! Cole no WhatsApp.");
        } catch (clipErr) {
          console.warn("A área de transferência não aceita imagens neste navegador.", clipErr);
          setToastMessage("Lista salva com sucesso!");
        }
      } else {
        setToastMessage("Lista salva com sucesso!");
      }

      setTimeout(() => setToastMessage(''), 4000);

    } catch (error) {
      console.error("Erro ao gerar ou salvar lista de materiais:", error);
      setToastMessage("Erro ao gerar a imagem da lista!");
      setTimeout(() => setToastMessage(''), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedPayment = history.find(h => h.id === selectedHistoryId);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-yellow-500 text-slate-900 shadow-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">Gestão de Obra</h1>
          </div>
          <nav className="flex bg-yellow-600 rounded-lg p-1">
            <button 
              onClick={() => { setView('current'); setSelectedHistoryId(null); }}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md transition-all ${view === 'current' ? 'bg-yellow-400 font-bold text-slate-900 shadow-sm' : 'text-yellow-100'}`}
            >
              Semana
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md transition-all ${view === 'history' ? 'bg-yellow-400 font-bold text-slate-900 shadow-sm' : 'text-yellow-100'}`}
            >
              Histórico
            </button>
            <button 
              onClick={() => { setView('material'); setSelectedHistoryId(null); }}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md transition-all ${view === 'material' ? 'bg-yellow-400 font-bold text-slate-900 shadow-sm' : 'text-yellow-100'}`}
            >
              Material
            </button>
          </nav>
        </div>
      </header>

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-yellow-500 animate-in fade-in zoom-in duration-300">
          <Download className="w-4 h-4 text-yellow-500 animate-bounce" />
          <span className="text-xs font-bold uppercase tracking-tight">{toastMessage}</span>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {view === 'current' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Frequência Semanal</span>
              <span className="text-[10px] bg-white border px-2 py-0.5 rounded text-slate-400">R$ 180 / R$ 130</span>
            </div>

            <div className="space-y-4">
              {workers.map(worker => (
                <div key={worker.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">{worker.name}</h3>
                      <p className="text-[10px] text-slate-400">{worker.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-yellow-600">R$ {calculateWorkerTotal(worker).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="p-2 grid grid-cols-6 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.key}
                        onClick={() => toggleAttendance(worker.id, day.key as keyof Attendance)}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
                          worker.attendance[day.key as keyof Attendance]
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700 shadow-inner'
                            : day.key === 'saturday'
                              ? 'border-slate-100 bg-slate-50 text-slate-400'
                              : 'border-slate-100 bg-white text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] font-black uppercase mb-1">{day.label}</span>
                        {worker.attendance[day.key as keyof Attendance] 
                          ? <CheckSquare className="w-4 h-4" /> 
                          : <div className={`w-4 h-4 border-2 rounded-sm ${day.key === 'saturday' ? 'border-slate-200' : 'border-slate-100'}`} />}
                      </button>
                    ))}
                  </div>

                  <div className="px-3 pb-3 pt-1 border-t border-slate-50 bg-slate-50/30 space-y-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={worker.hasAdvance || false}
                            onChange={(e) => updateAdvance(worker.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-700 transition-colors">Adiantamento?</span>
                        </label>
                      </div>
                      
                      {worker.hasAdvance && (
                        <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-100 p-2 rounded-xl animate-in fade-in slide-in-from-left-2 duration-200 shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Dias:</span>
                            <div className="relative flex items-center">
                              <select 
                                value={worker.advanceDays || 0}
                                onChange={(e) => updateAdvance(worker.id, true, parseFloat(e.target.value) || 0, worker.customAdvanceValue)}
                                className="appearance-none w-14 h-8 px-2 text-center text-xs font-black bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-yellow-400 cursor-pointer shadow-sm"
                              >
                                {Array.from({ length: 8 }, (_, i) => i).map(val => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                              <ChevronRight className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none rotate-90" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Valor Livre R$:</span>
                            <input 
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0,00"
                              value={worker.customAdvanceValue || ''}
                              onChange={(e) => updateAdvance(worker.id, true, worker.advanceDays, parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-yellow-400 shadow-sm"
                            />
                          </div>

                          <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded shrink-0 border border-green-100/50">
                            + R$ {(((worker.advanceDays || 0) * worker.dailyRate) + (worker.customAdvanceValue || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-slate-100/50 pt-2">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={worker.hasDeduction || false}
                            onChange={(e) => updateDeduction(worker.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-700 transition-colors">Desconto de Adiantamento?</span>
                        </label>
                      </div>
                      
                      {worker.hasDeduction && (
                        <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-100 p-2 rounded-xl animate-in fade-in slide-in-from-left-2 duration-200 shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Dias:</span>
                            <div className="relative flex items-center">
                              <select 
                                value={worker.deductionDays || 0}
                                onChange={(e) => updateDeduction(worker.id, true, parseFloat(e.target.value) || 0, worker.customDeductionValue)}
                                className="appearance-none w-14 h-8 px-2 text-center text-xs font-black bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 cursor-pointer shadow-sm"
                              >
                                {Array.from({ length: 8 }, (_, i) => i).map(val => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                              <ChevronRight className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none rotate-90" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Valor Livre R$:</span>
                            <input 
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0,00"
                              value={worker.customDeductionValue || ''}
                              onChange={(e) => updateDeduction(worker.id, true, worker.deductionDays, parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 shadow-sm"
                            />
                          </div>

                          <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded shrink-0 border border-red-100/50">
                            - R$ {(((worker.deductionDays || 0) * worker.dailyRate) + (worker.customDeductionValue || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl mt-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                  <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Total à Pagar</p>
                  <h2 className="text-4xl font-black text-yellow-400">R$ {calculateGrandTotal().toFixed(2)}</h2>
                </div>
                <button 
                  onClick={handleSaveWeek} 
                  className="w-full md:w-64 bg-yellow-500 hover:bg-yellow-400 text-slate-900 py-4 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  SALVAR SEMANA
                </button>
              </div>
            </div>
          </div>
        ) : view === 'history' ? (
          <div className="space-y-4">
            {!selectedHistoryId ? (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest">Histórico de Pagamentos</h3>
                  {history.length > 0 && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleClearAllHistory();
                      }}
                      className="text-red-500 text-[10px] font-black uppercase flex items-center gap-1 hover:text-red-700 transition-colors py-2 px-3 bg-red-50/50 rounded-lg border border-red-100"
                    >
                      <Trash2 className="w-3 h-3" /> Limpar Tudo
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-slate-200">
                    <HistoryIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Nenhum registro encontrado</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {history.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedHistoryId(item.id)} 
                        className="bg-white rounded-xl border border-slate-200 p-4 flex justify-between items-center hover:border-yellow-400 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center font-black text-xs">
                            {item.startDate.split('/')[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              {item.endDate ? `${item.startDate} — ${item.endDate}` : item.startDate}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">Toque para detalhes e recibo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-black text-slate-900">R$ {item.totalAmount.toFixed(2)}</span>
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <button onClick={() => setSelectedHistoryId(null)} className="flex items-center gap-2 text-slate-500 text-xs font-bold hover:text-slate-800">
                  <ChevronLeft className="w-4 h-4" /> VOLTAR AO HISTÓRICO
                </button>
                
                <div className="bg-white rounded-2xl border-2 border-yellow-400 shadow-2xl overflow-hidden">
                  <div ref={captureRef} className="p-6 bg-white">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Recibo de Pagamento</h2>
                        <p className="text-xs font-bold text-slate-400">
                          {selectedPayment?.endDate ? `${selectedPayment?.startDate} até ${selectedPayment?.endDate}` : selectedPayment?.startDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Valor Total</p>
                        <p className="text-3xl font-black text-yellow-600">R$ {selectedPayment?.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedPayment?.workers.map(worker => {
                        const days = Object.values(worker.attendance).filter(Boolean).length;
                        const baseAmount = days * worker.dailyRate;
                        const advanceAmount = worker.hasAdvance 
                          ? ((worker.advanceDays || 0) * worker.dailyRate) + (worker.customAdvanceValue || 0)
                          : 0;
                        const deductionAmount = worker.hasDeduction
                          ? ((worker.deductionDays || 0) * worker.dailyRate) + (worker.customDeductionValue || 0)
                          : 0;
                        const subtotal = baseAmount + advanceAmount - deductionAmount;

                        if (days === 0 && advanceAmount === 0 && deductionAmount === 0) return null;

                        return (
                          <div key={worker.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-black text-slate-800 uppercase text-xs">{worker.name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{worker.role} • Diária: R$ {worker.dailyRate.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-slate-900 italic">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>

                            <div className="space-y-1.5 mb-4 border-t border-slate-200/50 pt-3">
                              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                                <span className="uppercase tracking-tight">{days} dias trabalhados</span>
                                <span>R$ {baseAmount.toFixed(2).replace('.', ',')}</span>
                              </div>
                              
                              {advanceAmount > 0 && (
                                <div className="flex justify-between text-[11px] font-bold text-green-600 bg-green-50/50 px-2 py-1 rounded">
                                  <span className="uppercase tracking-tight">
                                    (+) Adiantamento 
                                    {worker.advanceDays && worker.customAdvanceValue 
                                      ? ` (${worker.advanceDays}d + R$ ${worker.customAdvanceValue})` 
                                      : worker.advanceDays 
                                        ? ` (${worker.advanceDays}d)` 
                                        : ` (R$ ${worker.customAdvanceValue})`}
                                  </span>
                                  <span>R$ {advanceAmount.toFixed(2).replace('.', ',')}</span>
                                </div>
                              )}

                              {deductionAmount > 0 && (
                                <div className="flex justify-between text-[11px] font-bold text-red-600 bg-red-50/50 px-2 py-1 rounded">
                                  <span className="uppercase tracking-tight">
                                    (-) Desc. Adiantamento 
                                    {worker.deductionDays && worker.customDeductionValue 
                                      ? ` (${worker.deductionDays}d + R$ ${worker.customDeductionValue})` 
                                      : worker.deductionDays 
                                        ? ` (${worker.deductionDays}d)` 
                                        : ` (R$ ${worker.customDeductionValue})`}
                                  </span>
                                  <span>R$ {deductionAmount.toFixed(2).replace('.', ',')}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1 overflow-x-auto pb-1">
                              {DAYS_OF_WEEK.map(day => (
                                <div key={day.key} className={`text-[8px] px-2 py-1 rounded font-bold uppercase whitespace-nowrap ${
                                  worker.attendance[day.key as keyof Attendance] 
                                    ? 'bg-yellow-400 text-white shadow-sm' 
                                    : day.key === 'saturday'
                                      ? 'bg-slate-200 text-slate-400 opacity-50'
                                      : 'bg-white text-slate-200 border border-slate-100'
                                }`}>
                                  {day.label}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 p-4 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => selectedPayment && handleGenerateReceipt(selectedPayment)}
                      disabled={isProcessing}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>PROCESSANDO...</span>
                        </div>
                      ) : (
                        <>
                          <Share2 className="w-5 h-5" />
                          SALVAR / COMPARTILHAR
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => selectedPayment && handleDeleteHistory(selectedPayment.id)}
                      className="px-6 bg-white hover:bg-red-50 text-red-600 py-4 rounded-xl border border-red-100 shadow-md active:scale-90 transition-all flex items-center justify-center group"
                      title="Apagar este registro"
                    >
                      <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest">Lista de Materiais</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Para comprar na loja posteriormente</p>
              </div>
              {materials.length > 0 && (
                <button 
                  type="button"
                  onClick={handleClearAllMaterials}
                  className="text-red-500 text-[10px] font-black uppercase flex items-center gap-1 hover:text-red-700 transition-colors py-2 px-3 bg-red-50/50 rounded-lg border border-red-100"
                >
                  <Trash2 className="w-3 h-3" /> Limpar Lista
                </button>
              )}
            </div>

            {/* Form de Inserção Rápida */}
            <form onSubmit={handleAddMaterial} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome do Material</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Cimento, Areia, Tijolo, Torneira..."
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                />
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantidade / Medida</label>
                <input 
                  type="text"
                  placeholder="Ex: 5 sacos, 2m³, 20m..."
                  value={newMaterialQty}
                  onChange={(e) => setNewMaterialQty(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                />
              </div>
              <button 
                type="submit"
                className="h-11 sm:mt-5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-6 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> Adicionar
              </button>
            </form>

            {/* Lista de Itens */}
            {materials.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-slate-200">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckSquare className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-800 text-sm font-bold">Sua lista está vazia</p>
                <p className="text-slate-400 text-xs mt-1">Adicione materiais e as quantidades que precisa comprar posteriormente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div ref={materialsRef} className="bg-white rounded-2xl border-2 border-yellow-400 shadow-2xl p-6">
                  {/* Cabeçalho do Print */}
                  <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Lista de Materiais</h2>
                      <p className="text-xs font-bold text-slate-400">Materiais para compra</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Data de Emissão</p>
                      <p className="text-sm font-black text-yellow-600">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {materials.map(item => (
                      <div 
                        key={item.id}
                        className={`bg-white rounded-xl border p-4 flex justify-between items-center transition-all shadow-sm ${
                          item.checked 
                            ? 'border-slate-100 bg-slate-50/50 opacity-70' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleMaterial(item.id)}>
                          <div className="flex-shrink-0">
                            {item.checked ? (
                              <div className="w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center text-slate-900 border border-yellow-600 shadow-sm">
                                <span className="text-xs font-bold">✓</span>
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg" />
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold text-slate-800 truncate ${item.checked ? 'line-through text-slate-400 italic' : ''}`}>
                              {item.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 ml-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                            item.checked 
                              ? 'bg-slate-100 text-slate-400 line-through' 
                              : 'bg-yellow-100 text-yellow-850'
                          }`}>
                            {item.quantity}
                          </span>
                          <button 
                            data-html2canvas-ignore="true"
                            onClick={() => handleDeleteMaterial(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50/50 hover:bg-red-50 border border-slate-100/50 hover:border-red-100/50 transition-colors"
                            title="Apagar item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botão de salvar/enviar */}
                <button 
                  onClick={handleShareMaterials}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>PROCESSANDO...</span>
                    </div>
                  ) : (
                    <>
                      <Share2 className="w-5 h-5" />
                      SALVAR / COMPARTILHAR LISTA
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 text-center pb-8 opacity-40">
        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Leonardo • Gestão de Obra</p>
        <p className="text-[9px] text-slate-400 font-medium mt-1">Última atualização: 09/07/2026 às 22:07</p>
      </footer>

      {/* Modal de Confirmação para Deletar Item Individual */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center uppercase tracking-tight">Apagar Registro</h3>
            <p className="text-slate-500 text-xs text-center mt-2">Deseja apagar este registro de pagamento permanentemente? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmationId(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setHistory(prev => prev.filter(item => item.id !== deleteConfirmationId));
                  setSelectedHistoryId(null);
                  setDeleteConfirmationId(null);
                  setToastMessage("Registro excluído!");
                  setTimeout(() => setToastMessage(''), 3000);
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/10 active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Limpar Todo o Histórico */}
      {showClearAllConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center uppercase tracking-tight">Limpar Histórico</h3>
            <p className="text-slate-500 text-xs text-center mt-2">Deseja apagar TODO o histórico de pagamentos? Esta ação é irreversível e apagará tudo.</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowClearAllConfirmation(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setHistory([]);
                  setSelectedHistoryId(null);
                  setShowClearAllConfirmation(false);
                  setToastMessage("Histórico apagado!");
                  setTimeout(() => setToastMessage(''), 3000);
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/10 active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;