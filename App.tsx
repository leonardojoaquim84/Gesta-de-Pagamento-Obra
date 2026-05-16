import React, { useState, useEffect, useRef } from 'react';
import { Worker, WorkerType, WeeklyPayment, DAYS_OF_WEEK, Attendance } from './types';
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
  AlertCircle
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

  const [view, setView] = useState<'current' | 'history'>('current');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showClipboardNotice, setShowClipboardNotice] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('current_week_workers', JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('payment_history', JSON.stringify(history));
  }, [history]);

  const toggleAttendance = (workerId: string, day: keyof Attendance) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { ...w, attendance: { ...w.attendance, [day]: !w.attendance[day] } }
        : w
    ));
  };

  const updateAdvance = (workerId: string, hasAdvance: boolean, days?: number) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { ...w, hasAdvance, advanceDays: days !== undefined ? days : w.advanceDays || 0 }
        : w
    ));
  };

  const updateDeduction = (workerId: string, hasDeduction: boolean, days?: number) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId 
        ? { ...w, hasDeduction, deductionDays: days !== undefined ? days : w.deductionDays || 0 }
        : w
    ));
  };

  const calculateWorkerTotal = (worker: Worker) => {
    const daysWorked = Object.values(worker.attendance).filter(Boolean).length;
    const advanceAmount = (worker.hasAdvance && worker.advanceDays) ? worker.advanceDays * worker.dailyRate : 0;
    const deductionAmount = (worker.hasDeduction && worker.deductionDays) ? worker.deductionDays * worker.dailyRate : 0;
    return (daysWorked * worker.dailyRate) + advanceAmount - deductionAmount;
  };

  const calculateGrandTotal = () => {
    return workers.reduce((acc, w) => acc + calculateWorkerTotal(w), 0);
  };

  const handleSaveWeek = () => {
    const total = calculateGrandTotal();
    if (total === 0) {
      alert("Selecione os dias trabalhados antes de salvar.");
      return;
    }

    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

    const newPayment: WeeklyPayment = {
      id: Date.now().toString(),
      startDate: lastMonday.toLocaleDateString('pt-BR'),
      endDate: today.toLocaleDateString('pt-BR'),
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
    alert("Semana salva com sucesso!");
  };

  const handleDeleteHistory = (id: string) => {
    if (!id) return;
    if (window.confirm("Deseja apagar este registro permanentemente?")) {
      setHistory(prev => prev.filter(item => item.id !== id));
      setSelectedHistoryId(null);
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Deseja apagar TODO o histórico de pagamentos? Esta ação não pode ser desfeita.")) {
      setHistory([]);
      setSelectedHistoryId(null);
    }
  };

  const handleGenerateReceipt = async (payment: WeeklyPayment) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Gerar o texto do recibo via IA
      const text = await generateReceiptText(payment);
      
      // 2. Capturar o "print" da tela do histórico (área do recibo)
      let imageBlob: Blob | null = null;
      if (captureRef.current) {
        try {
          const canvas = await html2canvas(captureRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          });
          imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        } catch (e) {
          console.error("Erro ao capturar imagem:", e);
        }
      }

      // 3. Download the image (for "Salvar")
      if (imageBlob) {
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `demonstrativo_${payment.startDate.replace(/\//g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

      // 4. Tentar compartilhar imagem + texto via API nativa (funciona melhor em Mobile)
      if (navigator.share && imageBlob) {
        const file = new File([imageBlob], `recibo_${payment.startDate.replace(/\//g, '-')}.png`, { type: 'image/png' });
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Demonstrativo de Obra',
              text: text,
              files: [file]
            });
            setIsProcessing(false);
            return;
          }
        } catch (shareErr) {
          console.warn("Navegador recusou compartilhamento de arquivo, tentando fallback", shareErr);
        }
      }

      // 5. Fallback: Copiar imagem para o clipboard e abrir WhatsApp com o texto
      if (imageBlob && navigator.clipboard && navigator.clipboard.write) {
        try {
          const data = [new ClipboardItem({ 'image/png': imageBlob })];
          await navigator.clipboard.write(data);
          setShowClipboardNotice(true);
          setTimeout(() => setShowClipboardNotice(false), 4000);
        } catch (clipErr) {
          console.warn("Erro ao copiar para clipboard:", clipErr);
        }
      }

      window.open(waUrl, '_blank');

    } catch (error) {
      console.error("Erro geral no envio:", error);
      alert("Ocorreu um erro ao preparar o envio.");
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
            <h1 className="text-xl font-bold tracking-tight">Obra do Acidio</h1>
          </div>
          <nav className="flex bg-yellow-600 rounded-lg p-1">
            <button 
              onClick={() => { setView('current'); setSelectedHistoryId(null); }}
              className={`px-4 py-1.5 text-sm rounded-md transition-all ${view === 'current' ? 'bg-yellow-400 font-bold shadow-sm' : 'text-yellow-100'}`}
            >
              Semana
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-4 py-1.5 text-sm rounded-md transition-all ${view === 'history' ? 'bg-yellow-400 font-bold shadow-sm' : 'text-yellow-100'}`}
            >
              Histórico
            </button>
          </nav>
        </div>
      </header>

      {showClipboardNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-yellow-500 animate-in fade-in zoom-in duration-300">
          <Copy className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-tight">Print copiado! Cole no WhatsApp</span>
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
                      
                      {worker.hasAdvance && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Dias:</span>
                          <div className="relative flex items-center">
                            <select 
                              value={worker.advanceDays || 0}
                              onChange={(e) => updateAdvance(worker.id, true, parseFloat(e.target.value) || 0)}
                              className="appearance-none w-14 h-8 px-2 text-center text-xs font-black bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-yellow-400 cursor-pointer shadow-sm"
                            >
                              {Array.from({ length: 8 }, (_, i) => i).map(val => (
                                <option key={val} value={val}>{val}</option>
                              ))}
                            </select>
                            <ChevronRight className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none rotate-90" />
                          </div>
                          <span className="text-[10px] font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                            + R$ {((worker.advanceDays || 0) * worker.dailyRate).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 border-t border-slate-100/50 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={worker.hasDeduction || false}
                          onChange={(e) => updateDeduction(worker.id, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-700 transition-colors">Desconto de Adiantamento?</span>
                      </label>
                      
                      {worker.hasDeduction && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Dias:</span>
                          <div className="relative flex items-center">
                            <select 
                              value={worker.deductionDays || 0}
                              onChange={(e) => updateDeduction(worker.id, true, parseFloat(e.target.value) || 0)}
                              className="appearance-none w-14 h-8 px-2 text-center text-xs font-black bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 cursor-pointer shadow-sm"
                            >
                              {Array.from({ length: 8 }, (_, i) => i).map(val => (
                                <option key={val} value={val}>{val}</option>
                              ))}
                            </select>
                            <ChevronRight className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none rotate-90" />
                          </div>
                          <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
                            - R$ {((worker.deductionDays || 0) * worker.dailyRate).toFixed(2)}
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
        ) : (
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
                            <p className="font-bold text-sm text-slate-800">{item.startDate} — {item.endDate}</p>
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
                        <p className="text-xs font-bold text-slate-400">{selectedPayment?.startDate} até {selectedPayment?.endDate}</p>
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
                        const advanceAmount = (worker.hasAdvance && worker.advanceDays) ? worker.advanceDays * worker.dailyRate : 0;
                        const deductionAmount = (worker.hasDeduction && worker.deductionDays) ? worker.deductionDays * worker.dailyRate : 0;
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
                                  <span className="uppercase tracking-tight">(+) Adiantamento ({worker.advanceDays}d)</span>
                                  <span>R$ {advanceAmount.toFixed(2).replace('.', ',')}</span>
                                </div>
                              )}

                              {deductionAmount > 0 && (
                                <div className="flex justify-between text-[11px] font-bold text-red-600 bg-red-50/50 px-2 py-1 rounded">
                                  <span className="uppercase tracking-tight">(-) Desc. Adiantamento ({worker.deductionDays}d)</span>
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
                          <Download className="w-5 h-5" />
                          SALVAR DEMONSTRATIVO
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
        )}
      </main>

      <footer className="mt-12 text-center pb-8 opacity-40">
        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Leonardo • Gestão de Obra</p>
      </footer>
    </div>
  );
};

export default App;